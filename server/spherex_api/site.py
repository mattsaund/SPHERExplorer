# Serves the built web app from one folder.
# Files with a hash in their name never change, so browsers may keep them for good. Where the
# build left a compressed twin beside a file (.br or .gz), that twin is sent to browsers that
# accept it, so nothing is compressed again on every request.
# Written with Claude Code (Anthropic) assistance.

import mimetypes
from pathlib import Path

from fastapi.responses import FileResponse

FOREVER = "public, max-age=31536000, immutable"
# Preferred first. Brotli is about a fifth smaller than gzip on script files.
CODINGS = (("br", ".br"), ("gzip", ".gz"))


def respond(root: Path, path: str, accept_encoding: str = "") -> FileResponse | None:
    """The file at `path` inside `root`, or None when there is no such file there."""
    base = root.resolve()
    candidate = (base / path).resolve()
    # The second test keeps a crafted path from climbing out of the site's folder.
    if not path or not candidate.is_file() or base not in candidate.parents:
        return None
    headers = {
        # Everything under assets/ has a hash in its name. The shell and the rest are checked each time.
        "Cache-Control": FOREVER if path.startswith("assets/") else "no-cache",
        "Vary": "Accept-Encoding",
        "X-Content-Type-Options": "nosniff",
    }
    media = mimetypes.guess_type(candidate.name)[0] or "application/octet-stream"
    offered = {token.split(";")[0].strip().lower() for token in accept_encoding.split(",")}
    for coding, suffix in CODINGS:
        twin = candidate.with_name(candidate.name + suffix)
        if coding in offered and twin.is_file():
            return FileResponse(twin, media_type=media, headers={**headers, "Content-Encoding": coding})
    return FileResponse(candidate, media_type=media, headers=headers)
