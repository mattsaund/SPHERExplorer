# Settings for the SPHERExplorer API. Every value can be overridden with an environment variable.
# Written with Claude Code (Anthropic) assistance.

import os
from pathlib import Path

# Public SPHEREx bucket on AWS. Anonymous, CORS-enabled, supports Range requests.
S3_BASE = os.environ.get("SPX_S3_BASE", "https://nasa-irsa-spherex.s3.us-east-1.amazonaws.com/")

# IRSA Simple Image Access v2 endpoint.
IRSA_SIA = os.environ.get("SPX_IRSA_SIA", "https://irsa.ipac.caltech.edu/SIA")

# Collections to search if the IRSA self-description can't be read.
FALLBACK_COLLECTIONS = ("spherex_dr1", "spherex_dr1_deep", "spherex_qr3", "spherex_qr3_deep")

# Where calibration tables and file layouts are kept between runs.
CACHE_DIR = Path(os.environ.get("SPX_CACHE_DIR", Path(__file__).resolve().parent.parent / ".cache"))

# A copy of the exposure index that ships inside the container image. A new instance starts
# from it at once, with no download, and then follows the published index as usual.
INDEX_SEED = os.environ.get("SPX_INDEX_SEED", "")

# A prebuilt exposure index to download when none is on disk. Empty disables the download.
INDEX_URL = os.environ.get(
    "SPX_INDEX_URL",
    "https://github.com/mattsaund/SPHERExplorer/releases/download/exposure-index/exposures.npz",
)

# Upper bounds on parallel work. More is not faster: measured on a first load of 334 frames,
# 32 parallel reads finished in a third of the time that 128 took, because past that point
# the reads only compete with each other.
S3_CONCURRENCY = int(os.environ.get("SPX_S3_CONCURRENCY", "32"))
FRAME_CONCURRENCY = int(os.environ.get("SPX_FRAME_CONCURRENCY", "32"))

# Memory for finished frames, in megabytes. A target that was opened before reloads from here.
FRAME_CACHE_MB = int(os.environ.get("SPX_FRAME_CACHE_MB", "256"))

# Ceiling on the cache folder, in megabytes. The oldest files go first. The index is never deleted.
CACHE_MAX_MB = int(os.environ.get("SPX_CACHE_MAX_MB", "2000"))

# Sent to upstream services. Kept generic by default.
USER_AGENT = os.environ.get("SPX_USER_AGENT", "spherex-viewer/0.1")

# SPHEREx detector geometry.
DETECTOR_SIZE = 2040
PIXEL_SCALE = 6.15  # arcsec per pixel, nominal

# Folder holding the built web app (web/dist). When it exists, the API serves the site too,
# so one container runs everything. Leave unset in development, where Vite serves the site.
STATIC_DIR = os.environ.get("SPX_STATIC_DIR", "")
