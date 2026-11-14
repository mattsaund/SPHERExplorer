# Catalog shaping for map annotations.
# Written with Claude Code (Anthropic) assistance.

from spherex_api import catalogs


def test_clean_name():
    assert catalogs.clean_name("NAME Orion-KL") == "Orion-KL"
    assert catalogs.clean_name("M  42") == "M 42"
    assert catalogs.clean_name("* alf Lyr") == "alf Lyr"
    assert catalogs.clean_name("V* RW Aur") == "RW Aur"
    assert catalogs.clean_name("NGC  1068") == "NGC 1068"


def test_shape_moves_fast_stars_to_today():
    # Barnard's Star as SIMBAD lists it at J2000.
    row = ["NAME Barnard's star", 269.45207, 4.69339, "BY*", -801.551, 10362.394, 546.976, -0.00037, "M4V", 1500, 9.51, 4.52]
    shaped = catalogs._shape(row)
    assert shaped["name"] == "Barnard's star"
    assert shaped["kind"] == "Spotted variable star"
    assert abs((shaped["dec"] - 4.69339) * 3600 - 26 * 10.362394) < 0.01   # 26 years of motion north
    assert shaped["epoch"] == 2026.0
    assert shaped["url"].endswith("NAME%20Barnard%27s%20star")
    # No motion listed: position unchanged.
    still = catalogs._shape(["M  31", 10.6847, 41.26875, "AGN", None, None, None, -0.001, None, 13836, 3.44, None])
    assert still["ra"] == 10.6847 and still["dec"] == 41.26875 and still["kind"].startswith("Galaxy")


def test_shape_uses_vetted_positions_for_nasa_targets():
    # SIMBAD lists WISE 0855 where it was in 2010. Carrying that forward from J2000 would overshoot.
    row = ["WISEA J085510.74-071442.5", 133.795129, -7.245147, "BD*", -8123.7, 673.2, 439.0, None, "Y2", 300, None, None]
    shaped = catalogs._shape(row)
    assert abs(shaped["ra"] - 133.759765) < 1e-6 and abs(shaped["dec"] + 7.242182) < 1e-6
