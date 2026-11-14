# Distances from parallax, published values, and redshift.
# Written with Claude Code (Anthropic) assistance.

from spherex_api import distance


def test_parallax():
    barnard = distance.from_parallax(546.976)
    assert barnard["method"] == "parallax" and abs(barnard["parsecs"] - 1.8282) < 0.0005
    # A parallax smaller than five times its error is not trusted (3C 273 in Gaia: 0.0108 +/- 0.0408).
    assert distance.from_parallax(0.0108, 0.0408) is None
    assert distance.from_parallax(15.42, 6.0) is None
    assert distance.from_parallax(0.2) is None and distance.from_parallax(None) is None and distance.from_parallax(-1.0) is None


def test_redshift_matches_planck_cosmology():
    # 3C 273 at z = 0.158: light travel time about 2.0 billion years, about 2.2 billion light-years away now.
    quasar = distance.from_redshift(0.15756751)
    assert quasar["method"] == "redshift"
    assert 1.95e9 < quasar["lightTravelYears"] < 2.10e9
    assert 2.15e9 < quasar["parsecs"] * distance.LIGHT_YEARS_PER_PARSEC < 2.30e9
    # At z = 1 the light has traveled about 7.9 billion years.
    assert 7.8e9 < distance.from_redshift(1.0)["lightTravelYears"] < 8.1e9
    # Small redshifts say more about a galaxy's own motion than about its distance.
    assert distance.from_redshift(0.001) is None and distance.from_redshift(-0.001) is None and distance.from_redshift(None) is None


def test_published_values_with_units():
    assert distance.from_measurement(761, "kpc ")["parsecs"] == 761e3
    assert distance.from_measurement(14.7, "Mpc ")["parsecs"] == 14.7e6
    assert distance.from_measurement(8.2, "pc")["method"] == "measured"
    assert distance.from_measurement(5, "furlongs") is None and distance.from_measurement(None, "pc") is None
