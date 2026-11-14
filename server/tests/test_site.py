# Serving the built site: compressed twins, cache rules, and no way out of the folder.
# Written with Claude Code (Anthropic) assistance.

from spherex_api import site


def make(tmp_path):
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<html>shell</html>")
    (tmp_path / "assets" / "app-abc123.js").write_text("console.log('plain')")
    (tmp_path / "assets" / "app-abc123.js.br").write_bytes(b"brotli-bytes")
    (tmp_path / "assets" / "app-abc123.js.gz").write_bytes(b"gzip-bytes")
    (tmp_path / "assets" / "logo.png").write_bytes(b"png")
    (tmp_path.parent / "secret.txt").write_text("not part of the site")
    return tmp_path


def test_hashed_assets_are_kept_for_good_and_sent_compressed(tmp_path):
    root = make(tmp_path)
    best = site.respond(root, "assets/app-abc123.js", "gzip, deflate, br")
    assert best.path.name == "app-abc123.js.br"
    assert best.headers["content-encoding"] == "br"
    assert best.headers["cache-control"] == site.FOREVER
    assert best.media_type in ("text/javascript", "application/javascript")
    assert site.respond(root, "assets/app-abc123.js", "gzip;q=1.0").headers["content-encoding"] == "gzip"
    plain = site.respond(root, "assets/app-abc123.js", "")
    assert plain.path.name == "app-abc123.js" and "content-encoding" not in plain.headers


def test_a_file_without_a_twin_is_sent_as_it_is(tmp_path):
    root = make(tmp_path)
    image = site.respond(root, "assets/logo.png", "br, gzip")
    assert image.path.name == "logo.png" and "content-encoding" not in image.headers


def test_the_shell_is_checked_every_time(tmp_path):
    root = make(tmp_path)
    assert site.respond(root, "index.html", "br").headers["cache-control"] == "no-cache"


def test_nothing_outside_the_folder_is_served(tmp_path):
    root = make(tmp_path)
    assert site.respond(root, "../secret.txt", "") is None
    assert site.respond(root, "assets/../../secret.txt", "") is None
    assert site.respond(root, "no-such-file.js", "") is None
    assert site.respond(root, "", "") is None
