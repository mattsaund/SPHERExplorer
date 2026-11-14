# Other-mission data: unit conversion and catalog parsing.
# Written with Claude Code (Anthropic) assistance.

from spherex_api import missions

VIZIER_ANSWER = """#
#   VizieR Astronomical Server
#Coosys	J2000:	eq_FK5 J2000
#Column	RAJ2000	(F10.6)	Right ascension
RAJ2000\tDEJ2000\t2MASS\tJmag\te_Jmag\tHmag\te_Hmag\tKmag\te_Kmag\tJD
deg\tdeg\t\tmag\tmag\tmag\tmag\tmag\tmag\td
----------\t----------\t----------------\t------\t-----\t------\t-----\t------\t-----\t------------
331.044113\t-56.782829\t22041058-5646581\t11.908\t0.024\t11.306\t0.024\t11.208\t0.023\t2451404.6875
331.100000\t-56.800000\t22042400-5648000\t      \t     \t15.100\t0.080\t      \t     \t2451404.6875

"""


def test_flux_conversion():
    # A zero-magnitude star has the zero-point flux.
    flux, error = missions.flux_ujy("J", 0.0, None)
    assert abs(flux - 1594.0e6) < 1 and error is None
    # Eps Ind B: J = 11.908 is about 27.4 mJy. An error of 0.024 mag is about 2.2 percent.
    flux, error = missions.flux_ujy("J", 11.908, 0.024)
    assert abs(flux - 27.4e3) < 100 and abs(error / flux - 0.0221) < 0.0005
    assert missions.flux_ujy("W2", None, 0.1) == (None, None)


def test_parse_tsv():
    rows = missions.parse_tsv(VIZIER_ANSWER)
    assert len(rows) == 2
    assert rows[0]["2MASS"] == "22041058-5646581" and rows[0]["Jmag"] == "11.908"
    assert rows[1]["Jmag"] == ""            # blank cells stay blank
    assert missions.parse_tsv("# nothing here\n") == []


def test_band_table():
    assert set(missions.BANDS) == {"J", "H", "Ks", "W1", "W2"}
    for band in missions.BANDS.values():
        assert 0.7 < band["wavelength"] < 5.1 and band["zero"] > 0
