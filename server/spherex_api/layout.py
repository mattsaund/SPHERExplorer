# Maps the inside of a remote SPHEREx Level 2 file: where each extension's data starts.
# A file is described once, with a few small Range reads, then remembered.
#
# Files of one pipeline version and detector are laid out alike, so after the first one the
# layout of the next is predicted, not read. The prediction is checked against the file's own
# table of FLAGS rows, which is needed anyway, so a file that differs is still mapped the slow way.
# Written with Claude Code (Anthropic) assistance.

import asyncio
import re
from dataclasses import dataclass, field

import numpy as np

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

# The only cards read from each header. Reading every card of these long headers costs
# several times as much, and a first load opens hundreds of files.
_HEAD_KEYS = frozenset(META_KEYS) | {"EXTNAME", "NAXIS1", "NAXIS2"}
_TAIL_KEYS = frozenset((
    "EXTNAME", "NAXIS", "NAXIS1", "NAXIS2", "NAXIS3", "BITPIX", "GCOUNT", "PCOUNT", "THEAP", "TFIELDS",
    "TFORM1", "ZCMPTYPE", "ZTILE1", "ZTILE2", "ZVAL1", "ZVAL2",
))


def _primary_key(key: str) -> bool:
    return key == "SIMPLE" or key == "VERSION"


def _head_key(key: str) -> bool:
    return key in _HEAD_KEYS or WCS_KEY.match(key) is not None


def _tail_key(key: str) -> bool:
    return key in _TAIL_KEYS


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

    # Which of the six detectors this file is from.
    @property
    def detector(self) -> int:
        return int(self.cards["DETECTOR"])

    # The file's pixel-to-sky transform, made on first use.
    @property
    def wcs(self) -> TanSip:
        if self._wcs is None:
            self._wcs = TanSip(self.cards)
        return self._wcs

    # This description as plain data, for the cache on disk. The header cards are not copied,
    # because the result is written out at once and never changed.
    def to_json(self) -> dict:
        return {
            "key": self.key, "total": self.total, "version": self.version, "nx": self.nx, "ny": self.ny,
            "image_off": self.image_off, "cards": self.cards, "calib": self.calib, "mapped": self.mapped,
            "flags_table_off": self.flags_table_off, "flags_heap_off": self.flags_heap_off,
            "flags_desc": self.flags_desc, "flags_rice": list(self.flags_rice), "flags_ok": self.flags_ok,
            "var_off": self.var_off, "zodi_off": self.zodi_off, "epsf_hdr_off": self.epsf_hdr_off,
            "wave_hdr_off": self.wave_hdr_off,
        }

    # The description read back from the cache on disk.
    @classmethod
    def from_json(cls, data: dict) -> "FileInfo":
        data = dict(data)
        data["flags_rice"] = tuple(data.get("flags_rice", (32, 4)))
        return cls(**data)


@dataclass(frozen=True)
class Template:
    """What repeats from file to file within one pipeline version and detector."""

    flags_hdr: int       # bytes of the FLAGS header
    theap: int           # bytes from the first FLAGS row descriptor to the compressed heap
    flags_desc: int      # bytes per row descriptor
    flags_rice: tuple    # RICE block size and bytes per pixel
    var_hdr: int         # bytes of the VARIANCE header
    zodi_hdr: int        # bytes of the ZODI header
    after_zodi: int      # bytes from the end of the ZODI data to the end of the file
    wave_total: int      # bytes from the WCS-WAVE header to the end of the file


# The layout of the first file seen for each pipeline version and detector.
_templates: dict[tuple[str, int], Template] = {}

_memory = cache.LRU(6000)
_inflight: dict[str, asyncio.Future] = {}
# The FLAGS row descriptors of files mapped lately, 16 kB each, so the frame that caused the
# mapping does not read them a second time.
_tables = cache.LRU(1500)
# Writes to the cache folder that are still under way. Kept so they are not dropped half done.
_saving: set[asyncio.Future] = set()
# How the tails of files were mapped, for /api/health: predicted from a template, or read.
tail_counts = {"predicted": 0, "read": 0}


def flags_table(key: str) -> np.ndarray | None:
    """The FLAGS row descriptors of a file as (length, offset) pairs, when they were read lately."""
    return _tables.get(key)


def _descriptors(buf: bytes, size: int) -> np.ndarray:
    """Row descriptors as an array of (length, offset) pairs."""
    return np.frombuffer(buf, dtype=">i4" if size == 8 else ">i8").reshape(-1, 2).astype(np.int64)


async def _header_at(key: str, offset: int, guess: int):
    """Read and parse the header that starts at offset. Grows the read until END appears."""
    size = guess
    while True:
        buf = await net.s3_bytes(key, offset, offset + size)
        parsed = parse_header(buf, _tail_key)
        if parsed is not None:
            return parsed
        if size > 40 * 2880:
            raise ValueError(f"No END card found at byte {offset} of {key}")
        size *= 2


async def _read_head(key: str) -> FileInfo:
    """First touch of a file: primary and IMAGE headers in one read."""
    buf, total = await net.s3_range(key, 0, HEAD_BYTES)
    primary = parse_header(buf, _primary_key)
    if primary is None or primary[0].get("SIMPLE") is not True:
        raise ValueError(f"{key} is not a FITS file")
    offset = primary[2]
    parsed = parse_header(buf[offset:], _head_key)
    if parsed is None:
        # A longer header than any seen so far. Read on until its END card.
        size = HEAD_BYTES * 2
        while parsed is None:
            parsed = parse_header(await net.s3_bytes(key, offset, offset + size), _head_key)
            if parsed is None and size > 40 * 2880:
                raise ValueError(f"No END card found at byte {offset} of {key}")
            size *= 2
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


async def _predict_tail(info: FileInfo, template: Template) -> bool:
    """Lay out the tail of a file from the template of its kind, and check it. True when it holds.

    The check costs one read of the FLAGS row descriptors, which the frame needs in any case.
    The rows say how long the compressed heap is. If the VARIANCE header then starts exactly
    where the template puts it, counted back from the end of the file, every size in between
    is as predicted.
    """
    plane = padded(info.nx * info.ny * 4)
    table_off = info.image_off + plane + template.flags_hdr
    epsf_hdr_off = info.total - template.after_zodi
    var_off = epsf_hdr_off - plane - template.zodi_hdr - plane
    var_hdr_off = var_off - template.var_hdr
    table_bytes = info.ny * template.flags_desc
    if var_hdr_off <= table_off + template.theap or template.theap < table_bytes:
        return False
    buf = await net.s3_bytes(info.key, table_off, table_off + table_bytes)
    if len(buf) != table_bytes:
        return False
    rows = _descriptors(buf, template.flags_desc)
    lengths, offsets = rows[:, 0], rows[:, 1]
    if lengths.min() < 0 or offsets.min() < 0:
        return False
    used = int((offsets + lengths).max())
    if table_off + padded(template.theap + used) != var_hdr_off:
        return False
    info.flags_table_off = table_off
    info.flags_heap_off = table_off + template.theap
    info.flags_desc = template.flags_desc
    info.flags_rice = template.flags_rice
    info.flags_ok = True
    info.var_off = var_off
    info.zodi_off = var_off + plane + template.zodi_hdr
    info.epsf_hdr_off = epsf_hdr_off
    info.wave_hdr_off = info.total - template.wave_total
    info.mapped = True
    _tables.put(info.key, rows)
    return True


async def _map_tail(info: FileInfo) -> None:
    """Find the FLAGS, VARIANCE, ZODI, EPSF, and WCS-WAVE offsets."""
    template = _templates.get((info.version, info.detector))
    if template is not None and await _predict_tail(info, template):
        tail_counts["predicted"] += 1
        return
    tail_counts["read"] += 1

    # No template yet, or this file differs. Walk the headers one by one.
    plane = padded(info.nx * info.ny * 4)
    flags_hdr_off = info.image_off + plane
    cards, _, flags_hdr = await _header_at(info.key, flags_hdr_off, 20160)
    if cards.get("EXTNAME") != "FLAGS":
        raise ValueError(f"{info.key}: expected FLAGS, found {cards.get('EXTNAME')}")
    info.flags_table_off = flags_hdr_off + flags_hdr
    table_bytes = int(cards["NAXIS1"]) * int(cards["NAXIS2"])
    theap = int(cards.get("THEAP", table_bytes))
    info.flags_heap_off = info.flags_table_off + theap
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
    # Only a file whose FLAGS rows can be read back is a model for the next one.
    if info.flags_ok and table_bytes == info.ny * info.flags_desc:
        _templates[(info.version, info.detector)] = Template(
            flags_hdr=flags_hdr, theap=theap, flags_desc=info.flags_desc, flags_rice=info.flags_rice,
            var_hdr=var_hdr, zodi_hdr=zodi_hdr,
            after_zodi=info.total - info.epsf_hdr_off, wave_total=info.total - info.wave_hdr_off,
        )


def _save_later(info: FileInfo) -> None:
    """Write a file's description to the cache folder without holding up the frame that needs it."""
    task = asyncio.ensure_future(asyncio.to_thread(cache.save_json, "layout", info.key, info.to_json()))
    _saving.add(task)
    task.add_done_callback(_saving.discard)


# Describe a file from memory, from disk, or by reading it. The tail is mapped only when asked for.
async def _load(key: str, need_tail: bool) -> FileInfo:
    info = _memory.get(key)
    if info is None:
        stored = cache.load_json("layout", key)
        info = FileInfo.from_json(stored) if stored else await _read_head(key)
        _memory.put(key, info)
    if need_tail and not info.mapped:
        await _map_tail(info)
        _save_later(info)
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
