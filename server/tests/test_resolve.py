# Name resolution: Sesame parsing, epoch propagation, and the built-in test targets.
# Written with Claude Code (Anthropic) assistance.

from spherex_api.objects import resolve

SESAME_ANSWER = """<?xml version="1.0" encoding="UTF-8"?>
<Sesame><Target option="SNV"><name>eps Ind B</name>
  <Resolver name="Sc=Simbad (CDS, via client/server)">
    <otype>BD*</otype>
    <jpos>22:04:10.59 -56:46:58.2</jpos>
    <jradeg>331.04414659</jradeg>
    <jdedeg>-56.7828442</jdedeg>
    <pm><v>4684.165</v><pmRA>3981.977</pmRA><pmDE>-2466.832</pmDE></pm>
    <plx><v>270.6580</v></plx>
    <spType>T1V+T6V</spType>
    <oname>* eps Ind B</oname>
  </Resolver>
</Target></Sesame>"""


def test_parse_sesame():
    found = resolve.parse_sesame(SESAME_ANSWER)
    assert found["name"] == "* eps Ind B"
    assert found["kind"] == "Brown dwarf"
    assert found["pmRa"] == 3981.977 and found["pmDec"] == -2466.832
    assert found["parallax"] == 270.658
    assert found["source"] == "Simbad"
    assert found["oid"] is None and found["redshift"] is None and found["parallaxError"] is None
    assert resolve._finish(found, "eps ind b")["url"].endswith("Ident=%2A%20eps%20Ind%20B")
    assert resolve.parse_sesame("<Sesame><Target><name>x</name></Target></Sesame>") is None
    assert resolve.parse_sesame("not xml") is None


def test_propagation_reaches_the_2026_position():
    found = resolve.parse_sesame(SESAME_ANSWER)
    ra, dec, _, _ = resolve.propagate(found["ra"], found["dec"], found["pmRa"], found["pmDec"])
    # Gaia DR3 carried to 2026.0 gives 331.096656, -56.800664.
    assert abs(ra - 331.096656) * 3600 * 0.547 < 0.1   # arcseconds on the sky
    assert abs(dec + 56.800664) * 3600 < 0.1
    # No motion means no change.
    assert resolve.propagate(10.0, 20.0, None, None) == (10.0, 20.0, None, None)


def test_names_are_tidied():
    found = resolve.parse_sesame(SESAME_ANSWER)
    assert resolve._finish(found, "eps ind b")["name"] == "eps Ind B"
    assert resolve._tidy("NAME Barnard's star") == "Barnard's star"
    assert resolve._tidy("M  31") == "M 31"


def test_built_in_targets_and_names():
    assert resolve.built_in("Barnard's Star")["name"] == "Barnard's Star"
    assert resolve.built_in("  wise 0855-0714 ")["ra"] == 133.759765
    assert resolve.built_in("R Dra")["kind"].startswith("Pulsating")
    assert resolve.built_in("Vega") is None
    barnard = resolve.built_in("NAME Barnard's star")   # the name SIMBAD uses also matches
    assert barnard["name"] == "Barnard's Star" and barnard["simbadId"] == "NAME Barnard's star"
    assert abs(barnard["distance"]["parsecs"] - 1.8282) < 0.001
    assert barnard["url"].endswith("Ident=NAME%20Barnard%27s%20star")
    assert resolve.built_in("RW Aur")["distance"] is None
    assert resolve.kind_of("QSO") == "Quasar"
    assert resolve.kind_of("zz*") == "Star"
    assert resolve.kind_of("") is None
