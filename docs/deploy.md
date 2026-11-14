# Deployment

One container runs everything: the API and the built web app. The plan is Google Cloud Run (Austin's decision, see `docs/decisions.md`).

## Why one container

- One address, so the browser never needs cross-origin calls.
- Cloud Run scales to zero when nobody is using the site, and the free tier covers light traffic after the credit ends.
- The S3 bucket with the SPHEREx files is in AWS us-east-1 (Northern Virginia). Deploy to `us-east4`, also Northern Virginia, so reads are fast.

## First deploy

Needs the `gcloud` CLI, a project with billing set up, and the Cloud Run and Cloud Build APIs switched on.

```sh
gcloud auth login
gcloud config set project <project id>
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

gcloud run deploy spherexplorer \
  --source . \
  --region us-east4 \
  --allow-unauthenticated \
  --memory 2Gi --cpu 2 --cpu-boost \
  --concurrency 40 --min-instances 0 --max-instances 4 \
  --timeout 300
```

The command prints the public address. Later deploys are the same command.

- `--cpu-boost` gives a starting instance more processor until it is ready, which shortens a cold start.
- `--min-instances 1` keeps one instance always running. Then nobody meets a cold start, and the images of a target someone has opened stay in memory for the next visitor. It costs money all day, so use it for the judging weeks (early December through January 26) and go back to 0 after.

## Settings

All optional. Set with `--set-env-vars NAME=value`.

| Name | Default | Meaning |
|---|---|---|
| `SPX_USER_AGENT` | `spherex-viewer/0.1` | How the API names itself to IRSA, AWS, SIMBAD, and MAST |
| `SPX_INDEX_URL` | this repo's `exposure-index` release | Where to download the exposure index |
| `SPX_FRAME_CONCURRENCY` | 32 | Frames built at once per request |
| `SPX_S3_CONCURRENCY` | 32 | Parallel reads from the SPHEREx bucket. More is not faster: see "Speed" below |
| `SPX_INDEX_SEED` | set in the container | A copy of the exposure index inside the image, so a new instance can search at once |
| `SPX_CACHE_DIR` | `/tmp/spherexplorer` | Where file layouts, calibration tables, and color tiles are kept |
| `SPX_CACHE_MAX_MB` | 300 in the container | Ceiling on that folder. Cloud Run keeps `/tmp` in memory, so it must stay small. The oldest files go first |
| `SPX_FRAME_CACHE_MB` | 256 | Memory for finished frames. About 40,000 frames fit, so a target someone has opened reloads at once |

## What starts cold

A new instance answers in under a second. The exposure index (12 MB) ships inside the image, so nothing is downloaded before the first search. The instance then checks for a newer index in the background. The six PSF tables (4 MB each) are read from S3 the first time each detector is used.

The frame memory starts empty too. The first visitor to a target waits for S3. Everyone after that on the same instance gets the frames from memory. `/api/health` reports how full it is and how often it answered.

## Speed

Measured on a development machine, on a first load of 334 images that nothing had cached. In the cloud the network is much faster, so processor time is what counts there.

| Step | Before | After | What changed |
|---|---|---|---|
| First call on a cold instance | 15 s | under 0.01 s | The index ships in the image instead of being downloaded |
| Processor time for the first load | 8.1 s | 2.2 s | The bucket is read with aiohttp. httpx spent most of its time rescanning its connection pool |
| Wall time for the first load | 17 s | 6 to 11 s, set by the home network | 32 parallel reads instead of 128, which only competed with each other |
| The same load again | 0.1 s | 0.1 s | Finished frames stay in memory |
| Page download, first visit | 1.01 MB | 0.77 MB | Files are compressed once at build time with Brotli, not on every request |
| Page download, later visits | 1.01 MB, revalidated | 0.02 MB | Files with a hash in their name are cached for good |

- A first load reads about 0.9 MB from the bucket per image, because S3 only serves whole rows of an image. That is why a target's first load takes seconds and its second is instant.
- After a deploy, open each of NASA's five test targets once. Their images then sit in the instance's memory for everyone who follows, as long as the instance lives.

## Memory

With the defaults an instance uses about 1 GB at most: 256 MB of frames, 300 MB of cache folder, and the rest for the index, the PSF tables, and Python. The 2 GB setting leaves room for requests in flight.

## Security

What is in place.

- The API holds no secrets, no accounts, and no cookies. It only reads public data, so there is nothing to steal from it.
- Every input is checked: file keys must match the layout of the SPHEREx bucket, numbers have ranges, text has a length limit, and requests that ask for too much are refused (HTTP 413).
- The server only ever calls a fixed list of public services. No request can make it fetch an address of the visitor's choosing.
- Every answer carries `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`, and `Permissions-Policy`. There is no `X-Frame-Options` on purpose, because other sites are meant to embed this one.
- The container runs as a user with no rights, from a fixed installer version, with nothing private in its build context.
- `.gitignore` keeps keys, tokens, environment files, and cloud credentials out of the repository. The history was scanned and holds none. GitHub's secret scanning and push protection are on.
- `npm audit` reports no known vulnerabilities in the web app's libraries.
- `--max-instances 4` caps what a flood of requests can cost.

For Matt or Austin to switch on, since they are account settings.

- Dependabot alerts on GitHub (Settings, Code security). They watch both the npm and the Python libraries for new advisories.
- Branch protection on `main` that forbids force pushes and deletion.
- A budget alert in Google Cloud Billing, so a surprise in cost is seen early.

## Custom domain

Map the free domain to the service with `gcloud beta run domain-mappings create --service spherexplorer --domain <domain> --region us-east4`, then add the DNS records it prints. Keep "NASA" out of the domain name.

## Check after deploying

- `https://<address>/api/health` answers with `"status": "ok"`.
- `https://<address>/?target=WISE%200855-0714&mode=visits&det=56` shows the brown dwarf at the marker.
- Open it from a phone on mobile data, to be sure it is public.
- Request a FortiGuard Web Filter Classification for the address (see `docs/submission-checklist.md`).
