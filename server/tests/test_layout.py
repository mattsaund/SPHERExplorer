# Predicting where the parts of a Level 2 file are from the first file of its kind, and the
# check that catches a file that differs.
# Written with Claude Code (Anthropic) assistance.

import numpy as np

from spherex_api import layout, net
from spherex_api.fitshdr import padded, parse_header
from spherex_api.layout import FileInfo, Template

PLANE = padded(2040 * 2040 * 4)
TEMPLATE = Template(flags_hdr=17280, theap=16320, flags_desc=8, flags_rice=(32, 4), var_hdr=11520, zodi_hdr=11520, after_zodi=3873600, wave_total=40320)


def a_file(heap_used: int, extra_after_flags: int = 0):
    """A file laid out like the template, with a FLAGS heap of the given size. Returns (info, row table)."""
    image_off = 2880 + 23040
    table_off = image_off + PLANE + TEMPLATE.flags_hdr
    var_hdr_off = table_off + padded(TEMPLATE.theap + heap_used) + extra_after_flags
    total = var_hdr_off + TEMPLATE.var_hdr + PLANE + TEMPLATE.zodi_hdr + PLANE + TEMPLATE.after_zodi
    info = FileInfo(key="dr1/level2/x.fits", total=total, version="7.0.5", image_off=image_off, cards={"DETECTOR": 3})
    # Rows of equal length that fill the heap exactly.
    lengths = np.full(2040, heap_used // 2040, dtype=">i4")
    lengths[-1] += heap_used - int(lengths.sum())
    offsets = np.concatenate(([0], np.cumsum(lengths[:-1]))).astype(">i4")
    return info, np.stack([lengths, offsets], axis=1).astype(">i4").tobytes(), table_off, var_hdr_off


async def test_a_file_like_the_template_is_laid_out_without_reading_its_headers(monkeypatch):
    info, table, table_off, var_hdr_off = a_file(heap_used=11_600_123)
    reads = []

    async def fake(key, start, end):
        reads.append((start, end))
        return table

    monkeypatch.setattr(net, "s3_bytes", fake)
    assert await layout._predict_tail(info, TEMPLATE)
    # One read: the row table, which the frame needs anyway.
    assert reads == [(table_off, table_off + 16320)]
    assert info.mapped and info.flags_ok
    assert info.flags_table_off == table_off and info.flags_heap_off == table_off + 16320
    assert info.var_off == var_hdr_off + 11520
    assert info.zodi_off == info.var_off + PLANE + 11520
    assert info.epsf_hdr_off == info.total - TEMPLATE.after_zodi
    assert info.wave_hdr_off == info.total - TEMPLATE.wave_total
    rows = layout.flags_table(info.key)
    assert rows.shape == (2040, 2) and int((rows[:, 0] + rows[:, 1]).max()) == 11_600_123


async def test_a_file_that_differs_is_not_trusted(monkeypatch):
    # One more block somewhere after FLAGS: the VARIANCE header is not where the template puts it.
    info, table, _, _ = a_file(heap_used=11_600_123, extra_after_flags=2880)

    async def fake(key, start, end):
        return table

    monkeypatch.setattr(net, "s3_bytes", fake)
    assert not await layout._predict_tail(info, TEMPLATE)
    assert not info.mapped

    # A table that is not a table (header text, say) is refused too.
    info, table, _, _ = a_file(heap_used=11_600_123)

    async def text(key, start, end):
        return b"XTENSION= 'BINTABLE'" * 816

    monkeypatch.setattr(net, "s3_bytes", text)
    assert not await layout._predict_tail(info, TEMPLATE)


def test_only_wanted_cards_are_read_and_strings_keep_their_quotes():
    def card(text: str) -> bytes:
        return text.ljust(80).encode()

    header = b"".join([
        card("SIMPLE  =                    T / conforms"),
        card("NAXIS1  =                 2040"),
        card("OBSID   = '2025W23_2B_0123_1'  / it's an id"),
        card("NOTE    = 'it''s quoted'"),
        card("CRVAL1  =   1.335E+02 / degrees"),
        card("HIERARCH L2 N_PERSIST = 12"),
        card("HISTORY [CALIB] epsf v9"),
        card("END"),
    ]).ljust(2880)
    cards, history, length = parse_header(header)
    assert cards == {"SIMPLE": True, "NAXIS1": 2040, "OBSID": "2025W23_2B_0123_1", "NOTE": "it's quoted", "CRVAL1": 133.5, "L2 N_PERSIST": 12}
    assert history == ["[CALIB] epsf v9"] and length == 2880
    some, history, length = parse_header(header, lambda key: key in ("NAXIS1", "NOTE"))
    assert some == {"NAXIS1": 2040, "NOTE": "it's quoted"} and history == ["[CALIB] epsf v9"] and length == 2880
    assert parse_header(header[:300]) is None


def test_a_file_description_survives_the_cache_on_disk():
    info = FileInfo(key="k", total=9, version="7.0.5", image_off=5, cards={"DETECTOR": 2, "CRVAL1": 1.5}, calib={"epsf": "v9"})
    info.mapped, info.flags_rice, info.var_off = True, (32, 4), 77
    again = FileInfo.from_json(info.to_json())
    assert again == info and again.flags_rice == (32, 4)
