# Search box suggestions: reading Small-Body Database answers, and what is never looked up.
# Written with Claude Code (Anthropic) assistance.

from spherex_api.objects import suggest


def test_a_list_of_matches_becomes_rows():
    data = {"list": [
        {"name": "1 Ceres (A801 AA)", "pdes": "1"},
        {"name": "807 Ceraskia (A915 HF)", "pdes": "807"},
        {"name": "9P/Tempel 1", "pdes": "9P"},
        {"name": "C/2015 X7 (ATLAS)", "pdes": "2015 X7"},
        {"name": "", "pdes": "x"},
    ]}
    rows = suggest.parse_bodies(data)
    assert rows[0] == {"label": "1 Ceres", "detail": "Asteroid", "query": "asteroid 1", "group": "solar"}
    assert rows[1]["label"] == "807 Ceraskia"
    assert rows[2] == {"label": "9P/Tempel 1", "detail": "Comet", "query": "comet 9P", "group": "solar"}
    # A comet keeps the discoverer's name in brackets. It is part of how the comet is known.
    assert rows[3] == {"label": "C/2015 X7 (ATLAS)", "detail": "Comet", "query": "comet 2015 X7", "group": "solar"}
    assert len(rows) == 4


def test_a_single_match_becomes_one_row():
    data = {"object": {"fullname": "99942 Apophis (2004 MN4)", "des": "99942", "kind": "an"}}
    assert suggest.parse_bodies(data) == [{"label": "99942 Apophis", "detail": "Asteroid", "query": "asteroid 99942", "group": "solar"}]
    comet = {"object": {"fullname": "67P/Churyumov-Gerasimenko", "des": "67P", "kind": "cn"}}
    assert suggest.parse_bodies(comet)[0]["query"] == "comet 67P"


def test_no_match_and_odd_answers_give_nothing():
    assert suggest.parse_bodies({"message": "specified object was not found"}) == []
    assert suggest.parse_bodies({}) == []
    assert suggest.parse_bodies({"list": "nonsense"}) == []


def test_the_list_is_capped():
    data = {"list": [{"name": f"{i} Name{i} (X)", "pdes": str(i)} for i in range(1, 40)]}
    assert len(suggest.parse_bodies(data)) == suggest.MAX_BODIES


async def test_text_that_cannot_be_a_name_is_never_sent_to_jpl():
    # Too short, no run of three letters, or characters that have no place in a name.
    for text in ("ab", "12 34", "133.79 -7.24", "a;b*c", "x" * 60):
        assert await suggest.small_bodies(text) == []
