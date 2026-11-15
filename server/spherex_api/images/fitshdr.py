# Minimal FITS header and binary-table parsing for remote reads.
# Astropy can do this too, but its Header objects cost milliseconds each and we parse thousands.
# Written with Claude Code (Anthropic) assistance.

import re

import numpy as np

BLOCK = 2880  # FITS files are built from 2880-byte blocks
# A quoted string value. A doubled quote inside stands for one quote.
_QUOTED = re.compile(r"'((?:[^']|'')*)'?")


def padded(nbytes: int) -> int:
    """Round a size up to a whole number of FITS blocks."""
    return -(-nbytes // BLOCK) * BLOCK


def _value(text: str):
    """Convert the value part of a header card to a Python value."""
    text = text.strip()
    if not text:
        return None
    if text[0] == "'":
        return _QUOTED.match(text).group(1).replace("''", "'").rstrip()
    token = text.split("/", 1)[0].strip()
    if token == "T":
        return True
    if token == "F":
        return False
    try:
        return int(token)
    except ValueError:
        pass
    try:
        return float(token.replace("D", "E"))
    except ValueError:
        return token


def parse_header(buf: bytes, want=None):
    """Parse header cards from the start of buf.

    Returns (cards, history, header_length) or None when buf ends before the END card.
    HIERARCH keys keep their full name, for example "L2 N_PERSIST".
    `want` is a test on a key. When given, only the keys that pass are read, which is several
    times cheaper on the long headers of a Level 2 file. HISTORY lines are always kept.
    """
    cards: dict[str, object] = {}
    history: list[str] = []
    text = buf.decode("ascii", "replace")
    for start in range(0, len(text) - 79, 80):
        key = text[start:start + 8].rstrip()
        if key == "END":
            return cards, history, padded(start + 80)
        if key == "HISTORY":
            history.append(text[start + 8:start + 80].strip())
        elif key == "HIERARCH":
            name, sep, rest = text[start + 9:start + 80].partition("=")
            if sep and (want is None or want(name.strip())):
                cards[name.strip()] = _value(rest)
        elif text[start + 8:start + 10] == "= " and (want is None or want(key)):
            cards[key] = _value(text[start + 10:start + 80])
    return None


def data_size(cards: dict) -> int:
    """Unpadded size in bytes of the data that follows a header."""
    naxis = int(cards.get("NAXIS", 0))
    if naxis == 0:
        return 0
    count = 1
    for axis in range(1, naxis + 1):
        count *= int(cards[f"NAXIS{axis}"])
    bytes_per = abs(int(cards["BITPIX"])) // 8
    return bytes_per * int(cards.get("GCOUNT", 1)) * (int(cards.get("PCOUNT", 0)) + count)


# FITS binary table type codes mapped to big-endian NumPy types.
_TFORM = {"L": "u1", "B": "u1", "I": ">i2", "J": ">i4", "K": ">i8", "E": ">f4", "D": ">f8", "A": "S1"}


def table_dtype(cards: dict) -> np.dtype:
    """Build a NumPy record type for the fixed-width rows of a binary table."""
    fields = []
    for index in range(1, int(cards["TFIELDS"]) + 1):
        form = str(cards[f"TFORM{index}"]).strip()
        # The repeat count is the leading run of digits. The type code follows it.
        lead = 0
        while lead < len(form) and form[lead].isdigit():
            lead += 1
        repeat = int(form[:lead]) if lead else 1
        code = form[lead]
        if code not in _TFORM:
            raise ValueError(f"Unsupported table column type {form}")
        name = str(cards.get(f"TTYPE{index}", f"col{index}")).strip()
        tdim = cards.get(f"TDIM{index}")
        if tdim:
            # TDIM lists axes fastest-first. NumPy wants slowest-first.
            dims = [int(part) for part in str(tdim).strip("() ").split(",")]
            fields.append((name, _TFORM[code], tuple(reversed(dims))))
        elif repeat != 1:
            fields.append((name, _TFORM[code], (repeat,)))
        else:
            fields.append((name, _TFORM[code]))
    dtype = np.dtype(fields)
    if dtype.itemsize != int(cards["NAXIS1"]):
        raise ValueError("Table row size does not match NAXIS1")
    return dtype
