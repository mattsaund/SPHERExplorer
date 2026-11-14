# The full-color sky tile set: recipe parsing, properties, and tile bounds.
# Written with Claude Code (Anthropic) assistance.

import asyncio

import pytest

from spherex_api import colorhips


def test_parse_recipe():
    assert colorhips.parse_recipe("90-47-22") == (90, 47, 22)
    for bad in ("90-47", "a-b-c", "90-47-102", "50-47-22", "90_47_22", ""):
        with pytest.raises(ValueError):
            colorhips.parse_recipe(bad)


def test_properties_describe_a_plain_image_tile_set():
    text = colorhips.properties("90-47-22")
    fields = dict(line.split("=", 1) for line in text.strip().splitlines())
    fields = {key.strip(): value.strip() for key, value in fields.items()}
    assert fields["dataproduct_type"] == "image"
    assert fields["hips_tile_format"] == "png"
    assert fields["hips_order"] == "5"
    assert "hips_cube_depth" not in fields
    assert "NASA/SPHEREx" in fields["obs_copyright"]


def test_tile_bounds_are_checked_before_any_download():
    for order, npix in ((6, 0), (-1, 0), (0, 12), (2, 12 * 16)):
        with pytest.raises(ValueError):
            asyncio.run(colorhips.tile("90-47-22", order, npix))
