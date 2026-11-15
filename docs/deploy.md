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
- Deploys freeze at 11:00 pm Eastern on Nov 15, an hour before the 11:59 pm submission deadline (`FREEZE_AT` in `deploy.yml`). The hour leaves time to check the last deploy. A commit pushed before the freeze still deploys when its CI passes. Nothing pushed after it deploys, so the site stays as submitted through judging. Don't deploy by hand after the freeze either.

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
| `SPX_S3_CONCURRENCY` | 32 | Parallel reads from the SPHEREx bucket. More is not faster: see "Speed" below |
| `SPX_INDEX_SEED` | set in the container | A copy of the exposure index inside the image, so a new instance can search at once |
| `SPX_CACHE_DIR` | `/tmp/spherexplorer` | Where file layouts, calibration tables, and color tiles are kept |
| `SPX_CACHE_MAX_MB` | 300 in the container | Ceiling on that folder. Cloud Run keeps `/tmp` in memory, so it must stay small. The oldest files go first |
| `SPX_CPUS` | what the container can see, and 4 on the live site | Processors the server may use, for sizing its compute threads. Cloud Run shows a container more processors than it allows, so `deploy.yml` sets this beside `--cpu`. Keep the two equal |
| `SPX_FRAME_CACHE_MB` | 256, and 1024 on the live site | Memory for finished frames, so a target someone has opened reloads at once. A 5 arcminute frame takes about 8 kB and a 30 arcminute frame about 200 kB, so one 30 arcminute load of 380 images is about 80 MB |

## What starts cold

A new instance answers in under a second. The exposure index (12 MB) ships inside the image, so nothing is downloaded before the first search. The instance then checks for a newer index in the background. The six PSF tables (4 MB each) are read from S3 the first time each detector is used.

The frame memory starts empty too. The first visitor to a target waits for S3. Everyone after that on the same instance gets the frames from memory. `/api/health` reports how full it is and how often it answered.

## Speed

### What limits a first load

- The server reads only part of each 65 MB file from the bucket: about 1 MB per image for a 5 arcminute field, 2.5 MB for 15, and 5 MB for 30. S3 serves whole rows of an image, so a wider field costs more.
- Google caps every Cloud Run instance at 600 Mbps and 64,000 packets a second, both directions together (https://cloud.google.com/run/quotas). Measured on Nov 15, the server takes in 62 to 77 MB a second from the bucket, which is that cap.
- At the cap the instance uses about 1.3 processors. More processors do not make a first load faster. That was measured with 2 and with 4.
- So a first load takes as long as its bytes take to arrive: the number of images, times the megabytes per image, at about 65 MB a second.
- The first image arrives in under half a second in every case, and the film can play while the rest come in.

### Measured on the live site

First loads of fields that nothing had cached, on Nov 15. Fields differ in how many images they have.

| Field | Images | First image | All images | Images a second |
|---|---|---|---|---|
| 5 arcmin | 297 | 0.45 s | 4.4 s | 68 |
| 15 arcmin | 301 | 0.12 s | 11.9 s | 25 |
| 30 arcmin | 254 | 0.42 s | 20.9 s | 12 |

- The same 30 arcminute field again, on the same instance: about 1 s. Finished frames stay in memory, already packed.
- Before the reading path was rewritten on Nov 14, the same kinds of load took 6.8 s, 19 s, and 34 s, and the repeat took 11 s.

### What the server does to get there

| Step | Before | After | What changed |
|---|---|---|---|
| First call on a cold instance | 15 s | under 0.01 s | The index ships in the image instead of being downloaded |
| Processor time per image, 5 arcmin | 24 ms | 5.1 ms | The bucket is read on worker threads over plain sockets, not with httpx. Each frame is packed once and kept packed. Photometry looks at a small box only |
| Processor time per image, 30 arcmin | 36 ms | 23 ms | The same, measured after httpx was already gone |
| Work on the event loop per image | most of it | 1.1 to 1.7 ms | Reading and math run on threads, on every processor |
| The same load again | 1.3 s | under 0.01 s | A finished frame is kept as the bytes that go to the browser |
| Page download, first visit | 1.01 MB | 0.78 MB | Files are compressed once at build time with Brotli, not on every request |
| Page download, later visits | 1.01 MB, revalidated | 0.004 MB | Files with a hash in their name are cached for good |

Processor times are from a development machine. The live instance takes three to five times as long for the same work.

- A file's layout is predicted from the first file of the same release and detector, and checked against the file's own table. That saves a read per image.
- A view of the sky map asks for its object list once, and the browser keeps the answer for an hour.
- After a deploy, open each of NASA's five test targets once. Their images then sit in the instance's memory for everyone who follows, as long as the instance lives.

### What the browser does

- Sums of images are three times faster than they were and are made in the background, so the page does not freeze on a wide field. The numbers are in `docs/methods.md`, section 6.
- A larger computer loads more images of a wide field. See `docs/methods.md`, section 18.

### What would make a first load faster still

- Keeping one instance running (`--min-instances 1`). Its memory then outlives quiet hours, so targets opened before stay instant. See "Cost".
- Spreading one load over several instances, each with its own network limit. Not built. It would need the browser to split a load and the frame memory to be shared.
- Reading less of each file is not possible without dropping the flags or part of the field.

## Size

Matt chose these on Nov 14, after loads of larger fields were slow on the live site. `deploy.yml` sets them on every deploy.

Measured after the change, on Nov 15: small fields load about a third faster, and large fields no faster. The instance's network limit binds before its processors do (see "Speed"). Two processors would do the same work at half the price per second, and four instances of that size would carry twice the traffic of two. Going back to 2 processors and 4 instances is open for Matt to decide.

| Setting | Value | Why |
|---|---|---|
| `--execution-environment gen2` | second generation | Google's newer runtime has the faster processor and network. A first load is mostly reading the archive, so that is where the time goes. It costs the same as the first generation and starts a little slower |
| `--cpu 4` | 4 processors | One target's reads and math run on every processor at once. Measured: a first load only uses about 1.3 of them, because the network limit binds first |
| `--memory 4Gi` | 4 GB | Room for a larger frame memory (`SPX_FRAME_CACHE_MB=1024`), so more large fields stay ready |
| `--max-instances 2` | 2 instances | Keeps the worst-case cost where four 2-processor instances had it. It also means a returning visitor more often meets the instance that holds their images. Each instance has its own network limit, so two instances carry half the traffic that four would |

Session affinity is off. It would send a visitor back to the same instance, and so to the images already in its memory. Google does that with a cookie that lasts 30 days, and the site sets no cookies today. Turning it on is a decision for Matt and Austin.

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
- The free tier covers about 12.5 busy hours a month of one instance. A faster instance finishes a load sooner, so one load costs about the same as it did on 2 processors.
- Past that, each busy instance costs about $0.38 an hour.
- Both instances busy around the clock would cost about $18 a day. The budget alert is there for that case.
- `--min-instances 1` removes the cold start for judges. One instance is then billed around the clock at the idle rate, about $1.73 a day.
- Data sent to visitors is billed apart, at about $0.12 per GB after the first GB each month.
- The trial credit pays for all of it. If the credit ran out, Google would stop the site, not charge the card.

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

## Until judging ends on Jan 26, 2027

Deploys freeze on Nov 15, so these are the things that can still go wrong by themselves.

- **The index refresh can switch itself off.** GitHub pauses scheduled workflows in a public repository after 60 days with no activity in it. With nothing pushed after the freeze, that falls about Jan 14. A small commit in early January, or the Enable button on the workflow's page under Actions, keeps new exposures coming in. A commit that touches only docs still deploys nothing after the freeze.
- **The first scheduled run is Tue Nov 17.** Until one run has passed, the refresh is unproven. It can be started by hand from the Actions tab (Refresh exposure index, then Run workflow).
- **The trial credit.** If it ran out, Google would stop the site. Billing, then Reports, shows what is left. See "Cost".
- **The solar system marks** are good to a fraction of a degree for months. `scripts/update_solar.py` renews them, but that needs a deploy, so they stay as they are through judging.

## Check after deploying

- `https://<address>/api/health` answers with `"status": "ok"`.
- `https://<address>/?target=WISE%200855-0714&mode=visits&det=56` shows the brown dwarf at the marker.
- https://spherexplorer.earth and https://www.spherexplorer.earth load with no certificate warning.
- Open it from a phone on mobile data, to be sure it is public.
- Request a FortiGuard Web Filter Classification for the address (see `docs/submission-checklist.md`).
