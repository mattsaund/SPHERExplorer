# Partner data shaping: NEOSSat images from the Canadian Astronomy Data Centre.
# Written with Claude Code (Anthropic) assistance.

from spherex_api.telescopes import partners


def test_shape_keeps_the_best_version_and_sorts_newest_first():
    rows = [
        {"observationID": "2019337012448", "productID": "raw", "time_bounds_lower": "58820.0589", "time_exposure": "1.1005", "target_name": "BarnardStar"},
        {"observationID": "2019337012448", "productID": "cord", "time_bounds_lower": "58820.0589", "time_exposure": "1.1005", "target_name": "BarnardStar"},
        {"observationID": "2022318120952", "productID": "raw", "time_bounds_lower": "59897.5069", "time_exposure": "0.8005", "target_name": ""},
        {"observationID": "broken", "productID": "raw", "time_bounds_lower": "", "time_exposure": "", "target_name": ""},
    ]
    shaped = partners.shape(rows)
    assert shaped["count"] == 2 and shaped["agency"] == "Canadian Space Agency"
    assert [image["id"] for image in shaped["images"]] == ["2022318120952", "2019337012448"]
    assert shaped["first"] == 58820.0589 and shaped["last"] == 59897.5069
    newest, oldest = shaped["images"]
    assert newest["target"] is None and newest["fits"].endswith("NEOS_SCI_2022318120952.fits")
    assert oldest["product"] == "cord"
    assert oldest["thumbnail"].endswith("2019337012448_cord_prev_256.png")
    assert oldest["fits"].endswith("NEOS_SCI_2019337012448_cord.fits")
    assert "Open Government Licence" in shaped["credit"]


def test_shape_of_nothing():
    shaped = partners.shape([])
    assert shaped["count"] == 0 and shaped["first"] is None and shaped["images"] == []
