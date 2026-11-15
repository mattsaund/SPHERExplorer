# Reading SkyBoT's answers about known solar system bodies.
# Written with Claude Code (Anthropic) assistance.

from spherex_api.objects import skybot

# Two rows in the shape SkyBoT sends, trimmed to the fields that are read.
ROWS = [
    {"Num": 289553, "Name": "2005 EE241", "RA (hms)": "11 59 42.5388", "DEC (dms)": "+01 31 52.314", "Class": "MB>Outer", "VMag (mag)": 20.3,
     "Err (arcsec)": 0.196, "d (arcsec)": 284.9, "dRA (arcsec/h)": 17.7593, "dDEC (arcsec/h)": -17.544, "dg (ua)": 1.9001, "dh (ua)": 2.47},
    {"Num": "-", "Name": "2014 HZ693", "RA (hms)": "12 00 0.0421", "DEC (dms)": "-01 25 12.841", "Class": "NEA>Apollo", "VMag (mag)": 23.8,
     "Err (arcsec)": 0.0, "d (arcsec)": 22.7, "dRA (arcsec/h)": 0.0, "dDEC (arcsec/h)": 30.0, "dg (ua)": 0.5, "dh (ua)": 1.4},
    {"Num": "-", "Name": "C/2025 N1", "RA (hms)": "10 00 00", "DEC (dms)": "+10 00 00", "Class": "Comet", "VMag (mag)": None,
     "Err (arcsec)": None, "d (arcsec)": 60.0, "dRA (arcsec/h)": -10.0, "dDEC (arcsec/h)": 0.0, "dg (ua)": None, "dh (ua)": None},
    {"Name": "broken row"},
]


def test_rows_become_bodies_nearest_first():
    bodies = skybot.parse(ROWS)
    assert [body["name"] for body in bodies] == ["2014 HZ693", "C/2025 N1", "(289553) 2005 EE241"]
    near = bodies[0]
    assert near["kind"] == "Near-Earth asteroid (apollo)"
    assert abs(near["ra"] - 180.000175) < 1e-5 and abs(near["dec"] + 1.420234) < 1e-5
    assert near["rate"] == 30.0 and near["angle"] == 0.0           # straight north
    assert near["query"] == "asteroid 2014 HZ693"
    comet = bodies[1]
    assert comet["kind"] == "Comet" and comet["query"] == "comet C/2025 N1"
    assert comet["magnitude"] is None and comet["angle"] == 270.0  # straight west
    far = bodies[2]
    assert far["kind"] == "Main-belt asteroid (outer)" and far["query"] == "asteroid 289553"
    assert abs(far["rate"] - 24.96) < 0.01 and 134 < far["angle"] < 136


def test_class_names():
    assert skybot.kind_of("MB>Inner") == "Main-belt asteroid (inner)"
    assert skybot.kind_of("KBO>Classical>Inner") == "Kuiper belt object (classical>inner)"
    assert skybot.kind_of("Dwarf Planet") == "Dwarf planet"
    assert skybot.kind_of("") == "Solar system body"
    assert skybot.kind_of("Something New") == "Solar system body"


def test_nothing_found_is_an_empty_list():
    assert skybot.parse([]) == []
