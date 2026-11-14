# Deployment

One container runs everything: the API and the built web app. It runs on Google Cloud Run (Austin's decision, see `docs/decisions.md`).

## Live site

| Item | Value |
|---|---|
| Address | https://spherexplorer-112779026983.us-east4.run.app |
| Service | `spherexplorer` on Cloud Run, region `us-east4` |
| First deployed | Nov 14, 2026 |
| Custom domain | Claimed, not connected yet |
| Paid by | The Google Cloud Free Trial from the Space Apps Global Offers |

The trial gives $300 for 90 days. It ends about Feb 12, 2027, after judging ends on Jan 26. When it ends, Google stops the site unless the account is upgraded to a paid one. The free tier only keeps the site running after that upgrade.

## Why one container

- One address, so the browser never needs cross-origin calls.
- Cloud Run scales to zero when nobody is using the site, so idle hours cost nothing.
- The S3 bucket with the SPHEREx files is in AWS us-east-1 (Northern Virginia). Deploy to `us-east4`, also Northern Virginia, so reads are fast.

## Google Cloud account

1. Start the Free Trial from the Space Apps Global Offers page, or at https://cloud.google.com/free. The card gets a temporary hold, not a charge. An account that has paid for Google Cloud, Maps, or Firebase before does not qualify.
2. Create the project under "No organization". New trial accounts get an organization made for them. New organizations block grants to anyone outside them, which breaks `--allow-unauthenticated` and stops a teammate's Gmail account from being added.
3. Add each teammate under IAM & Admin with the Owner role. They accept an email invitation.
4. Set a budget alert under Billing, then Budgets & alerts. It only sends email. `--max-instances` is the real ceiling on cost.

A project already inside such an organization still works. Deploy with `--no-invoker-iam-check` in place of `--allow-unauthenticated`. To add a teammate, an organization policy administrator turns off `iam.allowedPolicyMemberDomains` for the project.

## First deploy

Run it from Cloud Shell, the terminal in the Google Cloud console (the `>_` button). It already has `gcloud`, `git`, and Docker, so nothing needs installing.

```sh
gcloud config set project <project id>
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
git clone https://github.com/mattsaund/SPHERExplorer.git
cd SPHERExplorer

gcloud run deploy spherexplorer \
  --source . \
  --region us-east4 \
  --allow-unauthenticated \
  --memory 2Gi --cpu 2 \
  --concurrency 40 --min-instances 0 --max-instances 4 \
  --timeout 300
```

Cloud Build runs the `Dockerfile`, which takes several minutes. The command then prints the public address.

If the build stops with a permission error for `<number>-compute@developer.gserviceaccount.com`, give that account the build role, wait two minutes, and deploy again.

```sh
PROJECT_NUMBER=$(gcloud projects describe <project id> --format='value(projectNumber)')
gcloud projects add-iam-policy-binding <project id> \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role=roles/run.builder
```

## Later deploys

In Cloud Shell, run `cd ~/SPHERExplorer && git pull`, then the same `gcloud run deploy` command. Each deploy makes a new revision. To roll back, open the service in the console, then Revisions, then Manage traffic.

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

## Cost

These are rough figures from Google's list prices. Check https://cloud.google.com/run/pricing before relying on them.

- The free tier covers about 25 busy hours a month of one instance with 2 CPUs. Idle time costs nothing.
- Past that, each busy instance costs about $0.19 an hour.
- All four instances busy around the clock would cost about $18 a day. The budget alert is there for that case.
- `--min-instances 1` removes the cold start for judges. One instance is then billed around the clock at the idle rate.

## Custom domain

The domain comes from the Space Apps Global Offers (GoDaddy Registry, claimed at https://www.spaceapps.earth/). Registration finishes at Porkbun, so Porkbun is the registrar and holds the DNS records. It is free for one year. Keep "NASA" out of the name. Don't turn on the hosting that comes with it, because it rewrites the DNS records.

1. Prove ownership. Open Google Search Console (https://search.google.com/search-console) with the account that runs `gcloud`. Add a Domain property for the bare domain. Add its `google-site-verification=...` value at Porkbun as a TXT record with a blank Host, then click Verify.
2. Clear the parking records. Porkbun points new domains at a parking page. Delete every A, AAAA, ALIAS, and CNAME record on the bare domain, `www`, and `*`.
3. Map both names to the service in Cloud Shell.

   ```sh
   D=<domain>
   gcloud domains list-user-verified
   gcloud beta run domain-mappings create --service spherexplorer --domain "$D" --region us-east4
   gcloud beta run domain-mappings create --service spherexplorer --domain "www.$D" --region us-east4
   gcloud beta run domain-mappings describe --domain "$D" --region us-east4 --format='yaml(status.resourceRecords)'
   gcloud beta run domain-mappings describe --domain "www.$D" --region us-east4 --format='yaml(status.resourceRecords)'
   ```

4. Copy the printed records into Porkbun exactly. The bare domain usually gets four A and four AAAA records with a blank Host. `www` gets a CNAME to `ghs.googlehosted.com`.
5. Wait for the certificate. It usually takes 15 minutes and can take 24 hours. `gcloud beta run domain-mappings list --region us-east4` shows a check mark when it is ready. If it never arrives, look for a CAA record at Porkbun that leaves out Google.

Add each teammate as an Owner in Search Console too, under Settings, then Users and permissions. Only verified owners can change the mappings.

Why domain mapping: it is free and works in `us-east4`. Google calls it a preview and does not recommend it for production because of latency, which is fine for a hackathon. Firebase Hosting was rejected because it ends every request at 60 seconds, and the service allows 300 for the `/api/cutouts` stream. A global load balancer adds about $18 a month in fixed fees. Moving to one later only changes the DNS records.

## Check after deploying

- `https://<address>/api/health` answers with `"status": "ok"`.
- `https://<address>/?target=WISE%200855-0714&mode=visits&det=56` shows the brown dwarf at the marker.
- Open it from a phone on mobile data, to be sure it is public.
- Request a FortiGuard Web Filter Classification for the address (see `docs/submission-checklist.md`).
