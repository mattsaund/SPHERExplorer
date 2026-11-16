# Deployment

One container runs everything: the API and the built web app. It runs on Google Cloud Run.

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

Set up once.

1. Start the Free Trial, linked from the Space Apps Global Offers page or at https://cloud.google.com/free. An account that has paid for Google Cloud before does not qualify.
2. Create the project under "No organization". A new trial account comes with an organization whose policies block public access and outside members.
3. Add teammates under IAM & Admin as Owners.
4. Set a budget alert under Billing. It only sends email. `--max-instances` is what caps the cost.

A project inside such an organization still works: deploy with `--no-invoker-iam-check` in place of `--allow-unauthenticated`, and turn off `iam.allowedPolicyMemberDomains` for the project to add teammates.

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
  --execution-environment gen2 \
  --memory 4Gi --cpu 4 --cpu-boost \
  --concurrency 40 --min-instances 0 --max-instances 2 \
  --timeout 300 \
  --update-env-vars SPX_FRAME_CACHE_MB=1024,SPX_CPUS=4
```

The first deploy offers to create a `cloud-run-source-deploy` repository for the built images. Answer Y. Cloud Build then runs the `Dockerfile`, which takes several minutes, and the command prints the public address.

- `--execution-environment gen2`, `--cpu 4`, `--memory 4Gi`, and `--max-instances 2` are explained under "Size" below.
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

A push to `main` deploys itself once CI passes (see "Continuous deployment" below). To deploy by hand, run `cd ~/SPHERExplorer && git pull` in Cloud Shell, then the same `gcloud run deploy` command. Each deploy makes a new revision. To roll back, open the service in the console, then Revisions, then Manage traffic.

## Continuous deployment

`.github/workflows/deploy.yml` waits for the CI workflow to finish on a push to `main`. If every CI job passed, it deploys that exact commit with `gcloud run deploy --source`, then checks `/api/health`. A failed CI run deploys nothing, and pull requests never deploy.

- Each deploy sets the code and the size of the service: the runtime, processors, memory, the instance ceiling, and the frame memory. Change those in `deploy.yml`, because a value set by hand lasts only until the next deploy.
- Settings the workflow does not name (public access, concurrency, the timeout, the instance minimum) carry over to each new revision.
- If Google refuses a size, the deploy fails and the revision already running keeps serving. Trial accounts cannot ask for a larger quota.
- If the new container fails to start, Cloud Run keeps the old revision serving and the job fails.
- GitHub signs in to Google Cloud with Workload Identity Federation. No key is stored anywhere. Google accepts tokens only from this repository's `main` branch.
- Each deploy runs Cloud Build for a few minutes and stores one more image in Artifact Registry.
- To pause deploys, disable the Deploy workflow in the repository's Actions tab. Deploying by hand still works.
- Deploys freeze at 11:30 pm Eastern on Nov 15, with the repo, half an hour before the 11:59 pm submission deadline (`FREEZE_AT` in `deploy.yml`). A commit pushed before the freeze still deploys when its CI passes. Nothing pushed after it deploys, so the site stays as submitted through judging. Don't deploy by hand after the freeze either.

### One-time setup

Run this in Cloud Shell with the project ID filled in.

```sh
PROJECT_ID=<project id>
PROJECT_NUMBER=112779026983
SA="github-deploy@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud services enable iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com

# The account GitHub acts as. It can deploy Cloud Run services from source.
gcloud iam service-accounts create github-deploy --display-name="GitHub Actions deploy"
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$SA" --role=roles/run.sourceDeveloper --condition=None
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$SA" --role=roles/serviceusage.serviceUsageConsumer --condition=None
gcloud iam service-accounts add-iam-policy-binding "${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --member="serviceAccount:$SA" --role=roles/iam.serviceAccountUser

# Trust tokens from GitHub, but only from deploy.yml on this repository's main branch.
gcloud iam workload-identity-pools create github --location=global --display-name="GitHub Actions"
gcloud iam workload-identity-pools providers create-oidc spherexplorer \
  --location=global --workload-identity-pool=github --display-name="SPHERExplorer repo" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_id=assertion.repository_id,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository_id == '1457824978' && assertion.ref == 'refs/heads/main' && assertion.workflow_ref == 'mattsaund/SPHERExplorer/.github/workflows/deploy.yml@refs/heads/main'"
gcloud iam service-accounts add-iam-policy-binding "$SA" --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository/mattsaund/SPHERExplorer"
```

`1457824978` is the numeric ID of `mattsaund/SPHERExplorer`, so no other repository with the same name can take its place. Other workflows on `main` cannot act as the deploy account. If the repository or `deploy.yml` is renamed, deploys stop until the condition is updated.

The deploy job also checks that its commit is still the newest on `main`. CI runs can finish out of order, and an old run can be re-run, so without this check an older commit could replace a newer one.

Then the repository owner adds two Actions secrets, under Settings, then Secrets and variables, then Actions. On a personal repository only the owner can add them. Secrets keep the project ID out of the public Actions logs.

| Secret | Value |
|---|---|
| `GCP_WIF_PROVIDER` | `projects/112779026983/locations/global/workloadIdentityPools/github/providers/spherexplorer` |
| `GCP_DEPLOY_SA` | `github-deploy@<project id>.iam.gserviceaccount.com` |

GitHub only runs `deploy.yml` from `main`, so the first automatic deploy is the CI-passing push that merges it. Set up both sides before that merge. Google can take up to 5 minutes to accept a new trust setting.

## Settings

All optional. Set with `--set-env-vars NAME=value`.

| Name | Default | Meaning |
|---|---|---|
| `SPX_USER_AGENT` | `spherex-viewer/0.1` | How the API names itself to IRSA, AWS, SIMBAD, and MAST |
| `SPX_INDEX_URL` | this repo's `exposure-index` release | Where to download the exposure index |
| `SPX_FRAME_CONCURRENCY` | 32 | Frames built at once per request |
| `SPX_S3_CONCURRENCY` | 32 | Parallel reads from the SPHEREx bucket. More is not faster. See `docs/performance.md` |
| `SPX_INDEX_SEED` | set in the container | A copy of the exposure index inside the image, so a new instance can search at once |
| `SPX_CACHE_DIR` | `/tmp/spherexplorer` | Where file layouts, calibration tables, and color tiles are kept |
| `SPX_CACHE_MAX_MB` | 300 in the container | Ceiling on that folder. Cloud Run keeps `/tmp` in memory, so it must stay small. The oldest files go first |
| `SPX_CPUS` | what the container can see, and 4 on the live site | Processors the server may use, for sizing its compute threads. Cloud Run shows a container more processors than it allows, so `deploy.yml` sets this beside `--cpu`. Keep the two equal |
| `SPX_FRAME_CACHE_MB` | 256, and 1024 on the live site | Memory for finished frames, so a target someone has opened reloads at once. A 5 arcminute frame takes about 8 kB and a 30 arcminute frame about 200 kB, so one 30 arcminute load of 380 images is about 80 MB |

## What starts cold

A new instance answers in under a second. The exposure index (12 MB) ships inside the image, so nothing is downloaded before the first search. The instance then checks for a newer index in the background. The six PSF tables (4 MB each) are read from S3 the first time each detector is used.

The frame memory starts empty too. The first visitor to a target waits for S3. Everyone after that on the same instance gets the frames from memory. `/api/health` reports how full it is and how often it answered.

## Size

`deploy.yml` sets these on every deploy. They are the fastest size measured, and the measurements are in `docs/performance.md`.

| Setting | Value | Why |
|---|---|---|
| `--execution-environment gen2` | second generation | The fastest in the comparison in `docs/performance.md`. The first generation spent about twice the processor time on the same bytes, and loaded the same fields more slowly |
| `--cpu 4` | 4 processors | The size the fastest runs were measured on. One first load uses about one of them, so several visitors can load at once |
| `--memory 4Gi` | 4 GB | Room for 1024 MB of frame memory (`SPX_FRAME_CACHE_MB=1024`), so more large fields stay ready. Memory costs a tenth of what a processor does |
| `--max-instances 2` | 2 instances | At the worst they cost $18 a day, what the service cost before Nov 15 |

- The price of the second generation is a slower start. Google documents the first generation as the quicker of the two to start a new instance (https://docs.cloud.google.com/run/docs/about-execution-environments). On the second, a request that found no instance running waited 6.1 s on Nov 15. That was before the server's own start was trimmed the same day, so it may be a little less now. Measuring it again needs 15 minutes with no visitor at all, then one run of `curl -s -o /dev/null -w '%{time_total}\n' https://spherexplorer.earth/api/health`.
- `--min-instances 1` removes that wait. See "Cost".

Session affinity is off. It would send a visitor back to the same instance, and so to the images already in its memory. Google does that with a cookie that lasts 30 days, and the site sets no cookies today. Turning it on would add that cookie.

## Memory

An instance uses about 2 GB at most: 1024 MB of frames, 300 MB of cache folder, and the rest for the index, the PSF tables, Python, and images being built. The 4 GB setting leaves room for several large requests in flight.

## Security

What is in place.

- The API holds no secrets, no accounts, and no cookies. It only reads public data, so there is nothing to steal from it.
- Every input is checked: file keys must match the layout of the SPHEREx bucket, numbers have ranges, text has a length limit, and requests that ask for too much are refused (HTTP 413).
- The server only ever calls a fixed list of public services. No request can make it fetch an address of the visitor's choosing.
- Every answer carries `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`, and `Permissions-Policy`. There is no `X-Frame-Options` on purpose, because other sites are meant to embed this one.
- The container runs as a user with no rights, from a fixed installer version, with nothing private in its build context.
- `.gitignore` keeps keys, tokens, environment files, and cloud credentials out of the repository. The history was scanned and holds none. GitHub's secret scanning and push protection are on.
- `npm audit` reports no known vulnerabilities in the web app's libraries.
- `--max-instances 2` caps what a flood of requests can cost.

For Matt or Austin to switch on, since they are account settings.

- Dependabot alerts on GitHub (Settings, Code security). They watch both the npm and the Python libraries for new advisories.
- Branch protection on `main` that forbids force pushes and deletion.
- A budget alert in Google Cloud Billing, so a surprise in cost is seen early.

## Cost

These are rough figures from Google's list prices. Check https://cloud.google.com/run/pricing before relying on them.

- An instance is billed per second that it is handling a request, for its 4 processors and 4 GB. Idle time costs nothing.
- The free tier covers about 12 busy hours a month of one instance.
- Past that, each busy instance costs about $0.38 an hour. A 30 arcminute first load, about 21 seconds, costs about a fifth of a cent.
- Both instances busy around the clock would cost about $18 a day. The budget alert is there for that case.
- `--min-instances 1` removes the cold start for judges. One instance is then billed around the clock at the idle rate, about $1.70 a day.
- Data sent to visitors is billed apart, at about $0.12 per GB after the first GB each month.
- The trial credit pays for all of it. If the credit ran out, Google would stop the site, not charge the card.

## Custom domain

`spherexplorer.earth` and `www.spherexplorer.earth` come from the Space Apps Global Offers (GoDaddy Registry, claimed at https://www.spaceapps.earth/). Porkbun is the registrar and holds the DNS records. The first year is free.

Set up once:

1. Verify the domain in Google Search Console (https://search.google.com/search-console) with the account that runs `gcloud`, through a TXT record at Porkbun.
2. Delete Porkbun's parking records: every A, AAAA, ALIAS, and CNAME record on the bare domain, `www`, and `*`.
3. Map both names to the service in Cloud Shell.

   ```sh
   D=spherexplorer.earth
   gcloud domains list-user-verified
   gcloud beta run domain-mappings create --service spherexplorer --domain "$D" --region us-east4
   gcloud beta run domain-mappings create --service spherexplorer --domain "www.$D" --region us-east4
   gcloud beta run domain-mappings describe --domain "$D" --region us-east4 --format='yaml(status.resourceRecords)'
   gcloud beta run domain-mappings describe --domain "www.$D" --region us-east4 --format='yaml(status.resourceRecords)'
   ```

4. Enter the records from the `describe` output at Porkbun, as in the table below. The bare-domain records take a blank Host. The `create` output prints `spherexplorer` as their name, which is not a host.
5. Wait for the certificate, usually 15 minutes and at most 24 hours. `gcloud beta run domain-mappings list --region us-east4` shows a check mark when it is ready.
6. Ask FortiGuard to classify the new domain (https://www.fortiguard.com/faq/wfratingsubmit), so filtered networks don't block it.

Only verified owners of the domain can change the mappings. Add one in Search Console from the property's Verified owners list, with Add an owner. "Add user" under Users and permissions is not enough.

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

Domain mapping is free and works in `us-east4`. Google calls it a preview and does not recommend it for production because of latency. Firebase Hosting was rejected because it ends every request at 60 seconds, and a global load balancer adds about $18 a month.

## Until judging ends on Jan 26, 2027

Deploys freeze on Nov 15, so these are the things that can still go wrong by themselves.

- **The repo is locked.** From 11:30 pm Eastern on Nov 15, a ruleset named "Frozen for judging" (Settings, Rules, Rulesets) stops every push, merge, and branch change, for everyone. Matt asked for it. Nothing below needs a commit. The index refresh still runs, because it publishes a release file and changes no branch.

- **The index refresh can switch itself off.** GitHub pauses scheduled workflows in a public repository after 60 days with no activity in it. With nothing pushed after Nov 15, that falls about Jan 14. The Enable button on the workflow's page under Actions keeps new exposures coming in. Use the button and not a commit: Matt's reading of the rules, on Nov 15, is that the repo does not change after the form closes at 11:59 pm that day, while the site's data may keep updating. He set the repo's own freeze at 11:30 pm to be safe.
- **The refresh has run once on GitHub.** Matt had it started by hand on Nov 15 at 12:17 pm. It passed in 26 s, found no new exposures, and republished the same 273,367 rows, which a search of the new file confirmed. The first scheduled run is Tue Nov 17. It can be started by hand again from the Actions tab (Refresh exposure index, then Run workflow).
- **Not yet seen: a run where IRSA names the releases.** IRSA's list of releases timed out on Nov 15, on Matt's machine and on GitHub, so the refresh used its built-in list of DR1 and QR3. New exposures in those two are picked up either way. A new release is picked up on the first run when IRSA answers.
- **What was done to make that run safe, Nov 15.** The refresh was run on Matt's machine against a copy of the published index, with nothing published. It took 34 s, found no new exposures, and left all 273,367 rows as they were. IRSA's list of releases timed out during the run, and the refresh carried on with its built-in list, as designed. Two guards were added the same day. A refresh that would lose more than 2 percent of the index stops before it saves anything, so the job fails and publishes nothing (`size_check` in `index_build.py`). And a server that meets a damaged index file keeps the index it has in memory (`get_index` in `exposures.py`).
- **If a refresh fails because the index would shrink.** That can happen when the archive retires a release. The job publishes nothing, the site keeps the index it has, and images from the retired files stop loading. The fix needs no commit. On a machine with `uv` and `gh`, in `server/`:

  ```sh
  mkdir -p .cache/index
  gh release download exposure-index --pattern exposures.npz --dir .cache/index --clobber
  uv run python -m spherex_api.index_build --allow-shrink
  gh release upload exposure-index .cache/index/exposures.npz --clobber
  ```

  Read what the build says it dropped before the last line publishes it. A new instance loads the published file a minute or two after it starts, and a running one within 12 hours.
- **The trial credit.** If it ran out, Google would stop the site. Billing, then Reports, shows what is left. See "Cost".
- **The solar system marks** are good to a fraction of a degree for months. `scripts/update_solar.py` renews them, but that needs a deploy, so they stay as they are through judging.

## Check after deploying

These links are for the live domain. To check the Cloud Run address instead, put https://spherexplorer-112779026983.us-east4.run.app in place of https://spherexplorer.earth.

- [https://spherexplorer.earth/api/health](https://spherexplorer.earth/api/health) answers with `"status": "ok"`.
- [The WISE 0855 view](https://spherexplorer.earth/?target=WISE%200855-0714&mode=visits&det=56) shows the brown dwarf at the marker.
- https://spherexplorer.earth and https://www.spherexplorer.earth load with no certificate warning.
- Open it from a phone on mobile data, to be sure it is public.
