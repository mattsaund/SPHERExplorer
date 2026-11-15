# Deployment

One container runs everything: the API and the built web app. It runs on Google Cloud Run (Austin's decision, see `docs/decisions.md`).

## Live site

| Item | Value |
|---|---|
| Address | https://spherexplorer-112779026983.us-east4.run.app |
| Service | `spherexplorer` on Cloud Run, region `us-east4` |
| First deployed | Nov 14, 2026 |
| Custom domain | https://spherexplorer.earth and https://www.spherexplorer.earth. Live with HTTPS since Nov 14. Google renews the certificates on its own |
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
  --memory 2Gi --cpu 2 --cpu-boost \
  --concurrency 40 --min-instances 0 --max-instances 4 \
  --timeout 300
```

The first deploy offers to create a `cloud-run-source-deploy` repository for the built images. Answer Y. Cloud Build then runs the `Dockerfile`, which takes several minutes, and the command prints the public address.

- `--cpu-boost` gives a starting instance more processor until it is ready, which shortens a cold start.
- `--min-instances 1` keeps one instance always running. Then nobody meets a cold start, and the images of a target someone has opened stay in memory for the next visitor. It costs money all day, so use it for the judging weeks (early December through January 26) and go back to 0 after.

If the build stops with a permission error for `<number>-compute@developer.gserviceaccount.com`, give that account the build role, wait two minutes, and deploy again. Our project did not need this.

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

## Cost

These are rough figures from Google's list prices. Check https://cloud.google.com/run/pricing before relying on them.

- The free tier covers about 25 busy hours a month of one instance with 2 CPUs. Idle time costs nothing.
- Past that, each busy instance costs about $0.19 an hour.
- All four instances busy around the clock would cost about $18 a day. The budget alert is there for that case.
- `--min-instances 1` removes the cold start for judges. One instance is then billed around the clock at the idle rate.

## Custom domain

The domain is `spherexplorer.earth`. It comes from the Space Apps Global Offers (GoDaddy Registry, claimed at https://www.spaceapps.earth/). Registration finishes at Porkbun, so Porkbun is the registrar and holds the DNS records. It is free for one year. Keep "NASA" out of the name. Don't turn on the hosting that comes with it, because it rewrites the DNS records.

1. Prove ownership. Open Google Search Console (https://search.google.com/search-console) with the account that runs `gcloud`. Add a Domain property for the bare domain. Add its `google-site-verification=...` value at Porkbun as a TXT record with a blank Host, then click Verify.
2. Clear the parking records. Porkbun points new domains at a parking page. Delete every A, AAAA, ALIAS, and CNAME record on the bare domain, `www`, and `*`.
3. Map both names to the service in Cloud Shell.

   ```sh
   D=spherexplorer.earth
   gcloud domains list-user-verified
   gcloud beta run domain-mappings create --service spherexplorer --domain "$D" --region us-east4
   gcloud beta run domain-mappings create --service spherexplorer --domain "www.$D" --region us-east4
   gcloud beta run domain-mappings describe --domain "$D" --region us-east4 --format='yaml(status.resourceRecords)'
   gcloud beta run domain-mappings describe --domain "www.$D" --region us-east4 --format='yaml(status.resourceRecords)'
   ```

4. Copy the records into Porkbun, as in the table below. Go by the `describe` output. The `create` output shows `spherexplorer` in the NAME column of the bare-domain records, but that is not a host. Typed as a Host, it would make `spherexplorer.spherexplorer.earth`.
5. Wait for the certificate. It usually takes 15 minutes and can take 24 hours. `gcloud beta run domain-mappings list --region us-east4` shows a check mark when it is ready. If it never arrives, look for a CAA record at Porkbun that leaves out Google.

Only verified owners of the domain can change the mappings. To make a teammate one, open the property in Search Console (https://search.google.com/search-console/welcome), open the Verified owners list, click Add an owner, and enter their Google account. "Add user" under Users and permissions is not enough.

### DNS records at Porkbun

| Host | Type | Answer |
|---|---|---|
| (blank) | A | `216.239.32.21` |
| (blank) | A | `216.239.34.21` |
| (blank) | A | `216.239.36.21` |
| (blank) | A | `216.239.38.21` |
| (blank) | AAAA | `2001:4860:4802:32::15` |
| (blank) | AAAA | `2001:4860:4802:34::15` |
| (blank) | AAAA | `2001:4860:4802:36::15` |
| (blank) | AAAA | `2001:4860:4802:38::15` |
| `www` | CNAME | `ghs.googlehosted.com` |
| (blank) | TXT | The `google-site-verification=...` value. Keep it, because Google checks it again later |

Why domain mapping: it is free and works in `us-east4`. Google calls it a preview and does not recommend it for production because of latency, which is fine for a hackathon. Firebase Hosting was rejected because it ends every request at 60 seconds, and the service allows 300 for the `/api/cutouts` stream. A global load balancer adds about $18 a month in fixed fees. Moving to one later only changes the DNS records.

## Check after deploying

- `https://<address>/api/health` answers with `"status": "ok"`.
- `https://<address>/?target=WISE%200855-0714&mode=visits&det=56` shows the brown dwarf at the marker.
- https://spherexplorer.earth and https://www.spherexplorer.earth load with no certificate warning.
- Open it from a phone on mobile data, to be sure it is public.
- Request a FortiGuard Web Filter Classification for the address (see `docs/submission-checklist.md`).
