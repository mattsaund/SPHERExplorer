# Maps the inside of a remote SPHEREx Level 2 file: where each extension's data starts.
# A file is described once, with a few small Range reads, then remembered.
# Written with Claude Code (Anthropic) assistance.

import asyncio
import re
from dataclasses import asdict, dataclass, field

from . import cache, net
from .fitshdr import data_size, padded, parse_header
from .wcs import TanSip

# Primary header (1 block) plus the IMAGE header (8 blocks in pipeline 7), with margin.
HEAD_BYTES = 31680

# IMAGE header keys worth keeping. The WCS and SIP keys are added by pattern.
META_KEYS = (
    "DETECTOR", "OBSID", "EXPIDN", "BUNIT", "MJD-BEG", "MJD-AVG", "MJD-END", "DATE-AVG",
    "XPOSURE", "PSF_FWHM", "L1DQAFLG", "L2DQAFLG", "FINAST", "OMEGA_MEDIAN", "SPS_EPA",
    "SPS_FLAGS", "SPS_TARGET", "SPS_ELON", "SPS_ELAT", "X_SC", "Y_SC", "Z_SC",
    "HE_AIRGLOW_CONT", "SHUTTLE_GLOW_CONT", "AURORA_CONT", "AURORA_CORR", "SHUTTLE_GLOW_CORR",
    "OBS_IN_SBAND", "SGT_MIN_GCD2SAA", "PXSRCMSK",
)
WCS_KEY = re.compile(r"^(CRPIX[12]|CRVAL[12]|CDELT[12]|PC[12]_[12]|CD[12]_[12]|LONPOLE|[AB]P?_(ORDER|\d_\d))$")
CALIB = re.compile(r"^\[CALIB\]\s+(\S+)\s+(\S+)")


@dataclass
class FileInfo:
    """Everything needed to read pixels out of one Level 2 file."""

    key: str
    total: int = 0            # file size in bytes
    version: str = ""         # pipeline version from the primary header
    nx: int = 2040
    ny: int = 2040
    image_off: int = 0        # first byte of IMAGE data
    cards: dict = field(default_factory=dict)   # trimmed IMAGE header
    calib: dict = field(default_factory=dict)   # calibration name -> id

    # Filled in by get_layout.
    mapped: bool = False
    flags_table_off: int = 0  # first byte of the FLAGS row descriptors
    flags_heap_off: int = 0   # first byte of the FLAGS compressed heap
    flags_desc: int = 8       # bytes per row descriptor (8 for P, 16 for Q)
    flags_rice: tuple = (32, 4)  # RICE block size and bytes per pixel
    flags_ok: bool = False    # True when FLAGS is RICE with one tile per row
    var_off: int = 0          # first byte of VARIANCE data
    zodi_off: int = 0         # first byte of ZODI data
    epsf_hdr_off: int = 0     # first byte of the EPSF header
    wave_hdr_off: int = 0     # first byte of the WCS-WAVE header

    _wcs: TanSip | None = field(default=None, repr=False, compare=False)

    @property
    def detector(self) -> int:
        return int(self.cards["DETECTOR"])

    @property
    def wcs(self) -> TanSip:
        if self._wcs is None:
            self._wcs = TanSip(self.cards)
        return self._wcs

    def to_json(self) -> dict:
        data = asdict(self)
        data.pop("_wcs")
        return data

    @classmethod
    def from_json(cls, data: dict) -> "FileInfo":
        data = dict(data)
        data["flags_rice"] = tuple(data.get("flags_rice", (32, 4)))
        return cls(**data)


# Header sizes repeat within a pipeline version and detector, so the tail of a new file
# can be predicted from the first one seen. Value: (var header, zodi header, bytes after ZODI, bytes from WCS-WAVE header to the end).
_templates: dict[tuple[str, int], tuple[int, int, int, int]] = {}

_memory = cache.LRU(6000)
_inflight: dict[str, asyncio.Future] = {}


async def _header_at(key: str, offset: int, guess: int):
    """Read and parse the header that starts at offset. Grows the read until END appears."""
    size = guess
    while True:
        buf = await net.s3_bytes(key, offset, offset + size)
        parsed = parse_header(buf)
        if parsed is not None:
            return parsed
        if size > 40 * 2880:
            raise ValueError(f"No END card found at byte {offset} of {key}")
        size *= 2


async def _read_head(key: str) -> FileInfo:
    """First touch of a file: primary and IMAGE headers in one read."""
    buf, total = await net.s3_range(key, 0, HEAD_BYTES)
    primary = parse_header(buf)
    if primary is None or primary[0].get("SIMPLE") is not True:
        raise ValueError(f"{key} is not a FITS file")
    offset = primary[2]
    parsed = parse_header(buf[offset:])
    if parsed is None:
        parsed = await _header_at(key, offset, HEAD_BYTES * 2)
    cards, history, length = parsed
    if cards.get("EXTNAME") != "IMAGE":
        raise ValueError(f"{key}: expected IMAGE, found {cards.get('EXTNAME')}")
    calib = {}
    for line in history:
        match = CALIB.match(line)
        if match:
            calib[match.group(1)] = match.group(2)  # later lines win
    keep = {name: value for name, value in cards.items() if name in META_KEYS or WCS_KEY.match(name)}
    return FileInfo(
        key=key,
        total=total,
        version=str(primary[0].get("VERSION", "")),
        nx=int(cards["NAXIS1"]),
        ny=int(cards["NAXIS2"]),
        image_off=offset + length,
        cards=keep,
        calib=calib,
    )


async def _map_tail(info: FileInfo) -> None:
    """Find the FLAGS, VARIANCE, ZODI, EPSF, and WCS-WAVE offsets."""
    plane = padded(info.nx * info.ny * 4)
    flags_hdr_off = info.image_off + plane
    cards, _, length = await _header_at(info.key, flags_hdr_off, 20160)
    if cards.get("EXTNAME") != "FLAGS":
        raise ValueError(f"{info.key}: expected FLAGS, found {cards.get('EXTNAME')}")
    info.flags_table_off = flags_hdr_off + length
    table_bytes = int(cards["NAXIS1"]) * int(cards["NAXIS2"])
    info.flags_heap_off = info.flags_table_off + int(cards.get("THEAP", table_bytes))
    form = str(cards.get("TFORM1", ""))
    info.flags_desc = 16 if "Q" in form else 8
    info.flags_rice = (int(cards.get("ZVAL1", 32)), int(cards.get("ZVAL2", 4)))
    info.flags_ok = (
        cards.get("ZCMPTYPE") == "RICE_1"
        and int(cards.get("ZTILE1", 0)) == info.nx
        and int(cards.get("ZTILE2", 0)) == 1
        and int(cards.get("TFIELDS", 0)) == 1
    )
    var_hdr_off = info.flags_table_off + padded(data_size(cards))

    template = _templates.get((info.version, info.detector))
    if template:
        var_hdr, zodi_hdr, after_zodi, wave_total = template
        zodi_end = var_hdr_off + var_hdr + plane + zodi_hdr + plane
        if info.total - zodi_end == after_zodi:
            info.var_off = var_hdr_off + var_hdr
            info.zodi_off = info.var_off + plane + zodi_hdr
            info.epsf_hdr_off = zodi_end
            info.wave_hdr_off = info.total - wave_total
            info.mapped = True
            return

    # No template yet, or this file differs. Walk the remaining headers one by one.
    cards, _, var_hdr = await _header_at(info.key, var_hdr_off, 14400)
    if cards.get("EXTNAME") != "VARIANCE":
        raise ValueError(f"{info.key}: expected VARIANCE, found {cards.get('EXTNAME')}")
    info.var_off = var_hdr_off + var_hdr
    zodi_hdr_off = info.var_off + padded(data_size(cards))
    cards, _, zodi_hdr = await _header_at(info.key, zodi_hdr_off, 14400)
    if cards.get("EXTNAME") != "ZODI":
        raise ValueError(f"{info.key}: expected ZODI, found {cards.get('EXTNAME')}")
    info.zodi_off = zodi_hdr_off + zodi_hdr
    info.epsf_hdr_off = info.zodi_off + padded(data_size(cards))
    cards, _, epsf_hdr = await _header_at(info.key, info.epsf_hdr_off, 8640)
    if cards.get("EXTNAME") not in ("EPSF", "PSF"):
        raise ValueError(f"{info.key}: expected EPSF, found {cards.get('EXTNAME')}")
    info.wave_hdr_off = info.epsf_hdr_off + epsf_hdr + padded(data_size(cards))
    info.mapped = True
    _templates[(info.version, info.detector)] = (
        var_hdr, zodi_hdr, info.total - info.epsf_hdr_off, info.total - info.wave_hdr_off,
    )


async def _load(key: str, need_tail: bool) -> FileInfo:
    info = _memory.get(key)
    if info is None:
        stored = cache.load_json("layout", key)
        info = FileInfo.from_json(stored) if stored else await _read_head(key)
        _memory.put(key, info)
    if need_tail and not info.mapped:
        await _map_tail(info)
        cache.save_json("layout", key, info.to_json())
    return info


async def _shared(key: str, need_tail: bool) -> FileInfo:
    """Run _load once per file even when many requests ask at the same moment."""
    token = f"{key}|{int(need_tail)}"
    pending = _inflight.get(token)
    if pending is None:
        pending = asyncio.ensure_future(_load(key, need_tail))
        _inflight[token] = pending
        pending.add_done_callback(lambda _: _inflight.pop(token, None))
    return await asyncio.shield(pending)


async def get_head(key: str) -> FileInfo:
    """Header-level info: WCS, metadata, and where IMAGE data starts. One Range read on first use."""
    info = _memory.get(key)
    return info if info is not None else await _shared(key, False)


async def get_layout(key: str) -> FileInfo:
    """Full layout including FLAGS, VARIANCE, and calibration table offsets."""
    info = _memory.get(key)
    return info if info is not None and info.mapped else await _shared(key, True)
