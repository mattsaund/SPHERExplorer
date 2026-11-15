# Settings for the SPHERExplorer API. Every value can be overridden with an environment variable.
# Written with Claude Code (Anthropic) assistance.

import math
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

# Upper bounds on parallel work. More is not faster. On a home connection, 32 parallel reads
# finished in a third of the time that 128 took, because past that point the reads only compete
# with each other. On Cloud Run, 32 already fill the instance's network limit of 600 Mbps.
S3_CONCURRENCY = int(os.environ.get("SPX_S3_CONCURRENCY", "32"))
FRAME_CONCURRENCY = int(os.environ.get("SPX_FRAME_CONCURRENCY", "32"))

# Memory for finished frames, in megabytes. A target that was opened before reloads from here.
FRAME_CACHE_MB = int(os.environ.get("SPX_FRAME_CACHE_MB", "256"))

# Ceiling on the cache folder, in megabytes. The oldest files go first. The index is never deleted.
CACHE_MAX_MB = int(os.environ.get("SPX_CACHE_MAX_MB", "2000"))

def usable_cpus(root: str = "/sys/fs/cgroup") -> int:
    """How many processors this process may really use.

    A container is often shown every processor of its host and allowed only a few of them.
    The allowance is in the container's control group. More worker threads than that only
    take turns, so the thread pools are sized from this number.
    """
    try:
        count = len(os.sched_getaffinity(0))
    except (AttributeError, OSError):
        count = os.cpu_count() or 2
    quota = period = None
    try:
        # Control groups, version 2: "400000 100000" allows four processors, "max ..." has no limit.
        first, second = Path(root, "cpu.max").read_text().split()[:2]
        if first != "max":
            quota, period = int(first), int(second)
    except (OSError, ValueError):
        try:
            # Version 1 keeps the two numbers in two files, with -1 for no limit.
            quota = int(Path(root, "cpu", "cpu.cfs_quota_us").read_text())
            period = int(Path(root, "cpu", "cpu.cfs_period_us").read_text())
        except (OSError, ValueError):
            quota = period = None
    if quota and period and quota > 0 and period > 0:
        count = min(count, max(1, math.ceil(quota / period)))
    return max(1, count)


# Processors this process may use. Thread pools that compute are sized from it.
CPUS = usable_cpus()

# Sent to upstream services. Kept generic by default.
USER_AGENT = os.environ.get("SPX_USER_AGENT", "spherex-viewer/0.1")

# SPHEREx detector geometry.
DETECTOR_SIZE = 2040
PIXEL_SCALE = 6.15  # arcsec per pixel, nominal

# Folder holding the built web app (web/dist). When it exists, the API serves the site too,
# so one container runs everything. Leave unset in development, where Vite serves the site.
STATIC_DIR = os.environ.get("SPX_STATIC_DIR", "")
