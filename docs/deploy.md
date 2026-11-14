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
  --memory 2Gi --cpu 2 \
  --concurrency 40 --min-instances 0 --max-instances 4 \
  --timeout 300
```

The command prints the public address. Later deploys are the same command.

## Settings

All optional. Set with `--set-env-vars NAME=value`.

| Name | Default | Meaning |
|---|---|---|
| `SPX_USER_AGENT` | `spherex-viewer/0.1` | How the API names itself to IRSA, AWS, SIMBAD, and MAST |
| `SPX_INDEX_URL` | this repo's `exposure-index` release | Where to download the exposure index |
| `SPX_FRAME_CONCURRENCY` | 48 | Frames built at once per request |
| `SPX_S3_CONCURRENCY` | 128 | Parallel reads from the SPHEREx bucket |
| `SPX_CACHE_DIR` | `/tmp/spherexplorer` | Where file layouts, calibration tables, and color tiles are kept |
| `SPX_CACHE_MAX_MB` | 300 in the container | Ceiling on that folder. Cloud Run keeps `/tmp` in memory, so it must stay small. The oldest files go first |
| `SPX_FRAME_CACHE_MB` | 256 | Memory for finished frames. About 40,000 frames fit, so a target someone has opened reloads at once |

## What starts cold

A new instance downloads the exposure index (12 MB) and loads Astropy. That takes a few seconds. The six PSF tables (4 MB each) are read from S3 the first time each detector is used.

The frame memory starts empty too. The first visitor to a target waits for S3. Everyone after that on the same instance gets the frames from memory. `/api/health` reports how full it is and how often it answered.

## Memory

With the defaults an instance uses about 1 GB at most: 256 MB of frames, 300 MB of cache folder, and the rest for the index, the PSF tables, and Python. The 2 GB setting leaves room for requests in flight.

## Custom domain

Map the free domain to the service with `gcloud beta run domain-mappings create --service spherexplorer --domain <domain> --region us-east4`, then add the DNS records it prints. Keep "NASA" out of the domain name.

## Check after deploying

- `https://<address>/api/health` answers with `"status": "ok"`.
- `https://<address>/?target=WISE%200855-0714&mode=visits&det=56` shows the brown dwarf at the marker.
- Open it from a phone on mobile data, to be sure it is public.
- Request a FortiGuard Web Filter Classification for the address (see `docs/submission-checklist.md`).
