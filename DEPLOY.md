# Frontend deployment

Images are built in **GitHub Actions** and pushed to **Amazon ECR**. The EC2 host
only pulls and swaps containers — it never runs `npm install`, `vite build`, or
`docker compose build`.

**Pushing to main ships to production.** The build gates it: `npm test` must pass and the
image must reach ECR, and only then does `deploy.yml` fire — chained on `workflow_run`, not
on `push`, so the image provably exists before the host tries to pull it.

```
push to main → build.yml:  npm ci → npm test → docker build → ECR
                              │ on success (workflow_run)
                              ▼
                deploy.yml: SSM → EC2: deploy.sh <tag> → pull → up -d → health gate
```

A red suite, a failed build, or a build cancelled by a newer push all conclude as
something other than `success`, so they stop before the server is touched.

Every image is tagged with the short commit SHA, so rollback is a re-deploy of an
older tag rather than a rebuild.

For the history of *why* it works this way — what the old setup was, what broke, and
what was removed — see [DEPLOYMENT_MIGRATION.md](DEPLOYMENT_MIGRATION.md).

---

## Day-to-day

| Action | Command |
| --- | --- |
| Build **and deploy** | push to `main` — nothing else to run |
| Roll back | `git deploy <previous-sha>` — or Actions → *Deploy to EC2* → Run workflow |
| Re-deploy a specific build | `git deploy a84f6d2` |
| Watch a run | `gh run watch` |
| List available images | `aws ecr describe-images --repository-name aadml-frontend --region us-west-1 --query 'sort_by(imageDetails,&imagePushedAt)[].imageTags' --output text` |
| Deploy from the box directly | `./deploy.sh <sha>` in `/opt/aadml-frontend` |
| See what's running | `grep IMAGE_TAG /opt/aadml-frontend/.deploy.env` |
| Logs | `docker compose --env-file .deploy.env logs -f frontend` |

A deploy is roughly **10 seconds** of downtime — the container swap plus the health
gate.

`deploy.sh` waits for the container healthcheck. If the new image never turns
healthy it dumps the last 50 log lines, restores the previous tag, brings it back
up, and exits non-zero — so a bad build fails the pipeline instead of taking the
site down.

> **On the automatic path there is nothing to wait for** — the deploy is triggered *by* the
> build finishing, so the image always exists. That race only applies to a MANUAL `git deploy`
> with no argument: it targets the current `main` SHA, and if `build.yml` hasn't published that
> image yet the pull fails. The site is unaffected, but `.deploy.env` is left pointing at a tag
> that doesn't exist. For rollbacks, always pass an explicit tag.

Build locally (dev only — never on the prod host):

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

---

## Setting up `git deploy` on a new machine

Optional — normal shipping is just a push to `main`. This alias is for **rollbacks and
re-deploys** of an existing tag.

`git deploy` is a git alias wrapping the GitHub CLI. One-time per machine:

```powershell
winget install --id GitHub.cli -e
gh auth login          # GitHub.com → HTTPS → login with a web browser
```

Then create the alias. **Use Git Bash, not PowerShell** — PowerShell strips the
inner double quotes when passing the value to `git`:

```bash
git config --global alias.deploy '!f() { gh workflow run deploy.yml -R datatrader-space/agentic-system-frontend ${1:+-f image_tag="$1"}; }; f'
```

Verify with `git config --global --get alias.deploy`. The alias runs through git's
bundled `sh`, so it works from PowerShell, Git Bash, or the VS Code terminal alike.

You don't strictly need any of this — **Actions → Deploy to EC2 → Run workflow**
does the same thing from the browser, with an optional tag field.

---

## Troubleshooting

**`gh: command not found` / `git deploy` fails with it**
The installer updates the *machine* PATH, but any already-running terminal keeps
the copy it was born with. This includes **VS Code's integrated terminal**, which
inherits from the VS Code process — opening a new terminal *tab* won't help, you
have to restart VS Code. Quick patch for one session:

```powershell
$env:Path += ";C:\Program Files\GitHub CLI"
```

**`could not find any workflows named deploy.yml`**
`workflow_dispatch` is only registered from the default branch. Push the workflow
to `main` first.

**Deploy job fails with `not authorized to perform: ssm:SendCommand`**
The `ssm-deploy` inline policy is missing from the `gh-actions-aadml-frontend`
role. Check with `aws iam list-role-policies --role-name gh-actions-aadml-frontend`
— it should list both `ecr-push` and `ssm-deploy`.

**Deploy job fails with `Invalid length for parameter InstanceIds[0]`**
The `EC2_INSTANCE_ID` repository *variable* is missing (Variables tab, not Secrets).

**Container stuck `unhealthy`**
The healthcheck must use `http://127.0.0.1/healthz`, never `localhost` — inside the
container `localhost` resolves to `::1` first and nginx `listen 80` is IPv4-only,
so busybox wget gets `ECONNREFUSED` forever.

**Port conflict on `docker compose up`**
Something else is holding `8002` — usually a container from an older Compose
project. `docker ps` to find it, then `docker compose down` in its directory.

---

## Infrastructure reference

Live values for this deployment.

| | |
| --- | --- |
| AWS account | `627073650116` |
| Region | `us-west-1` |
| EC2 instance | `i-0cf64bf864021d64c` (t2.small) |
| Host | `54.219.25.248` — also serves sztax.ca |
| Instance role | `SSMInstanceRole` (SSM + ECR read-only) |
| ECR registry | `627073650116.dkr.ecr.us-west-1.amazonaws.com` |
| ECR repository | `aadml-frontend` (untagged images expire after 7d) |
| CI role | `arn:aws:iam::627073650116:role/gh-actions-aadml-frontend` |
| Backend | `172.31.6.43:8000` (separate instance) |
| Published port | `8002`, fronted by host nginx for aadml.com |

### GitHub repository settings

**Variables** (Settings → Secrets and variables → Actions → Variables):

| Name | Value |
| --- | --- |
| `AWS_REGION` | `us-west-1` |
| `ECR_REPOSITORY` | `aadml-frontend` |
| `EC2_INSTANCE_ID` | `i-0cf64bf864021d64c` |

**Secrets:**

| Name | Value |
| --- | --- |
| `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::627073650116:role/gh-actions-aadml-frontend` |

No `EC2_HOST` / `EC2_USER` / `EC2_SSH_KEY` — the deploy job reaches the box over
**AWS SSM**, so no private key is stored in GitHub and port 22 never has to accept
GitHub runner IPs.

### The host

`/opt/aadml-frontend/` is the entire deploy surface — three files, no source tree,
no `node_modules`, no git clone:

```
docker-compose.yml     pull-only compose file
deploy.sh              executable, LF line endings
.deploy.env            chmod 600, ubuntu-owned
```

```env
ECR_REGISTRY=627073650116.dkr.ecr.us-west-1.amazonaws.com
ECR_REPOSITORY=aadml-frontend
IMAGE_TAG=061b9d0        # rewritten by deploy.sh on every deploy
BACKEND_URL=172.31.6.43:8000
APP_PORT=8002
```

The box needs the AWS CLI and `docker compose` v2. It authenticates to ECR through
the instance role — no AWS credentials on disk.

---

## Rebuilding this from scratch

Only needed for a new environment or a lost account.

### 1. ECR repository

```bash
aws ecr create-repository --repository-name aadml-frontend --region us-west-1 \
  --image-scanning-configuration scanOnPush=true

aws ecr put-lifecycle-policy --repository-name aadml-frontend --region us-west-1 \
  --lifecycle-policy-text '{"rules":[{"rulePriority":1,"description":"expire untagged","selection":{"tagStatus":"untagged","countType":"sinceImagePushed","countUnit":"days","countNumber":7},"action":{"type":"expire"}}]}'
```

### 2. GitHub → AWS trust (OIDC, no long-lived keys)

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

Role `gh-actions-aadml-frontend`, trust policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::627073650116:oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
      "StringLike": { "token.actions.githubusercontent.com:sub": "repo:datatrader-space/agentic-system-frontend:*" }
    }
  }]
}
```

Keep the `sub` condition pinned to the one repository — a wildcard would let any
repo in the org assume the role.

Inline policy `ecr-push`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Sid": "EcrAuth", "Effect": "Allow", "Action": "ecr:GetAuthorizationToken", "Resource": "*" },
    { "Sid": "EcrPush", "Effect": "Allow",
      "Action": ["ecr:BatchCheckLayerAvailability","ecr:BatchGetImage","ecr:GetDownloadUrlForLayer",
                 "ecr:InitiateLayerUpload","ecr:UploadLayerPart","ecr:CompleteLayerUpload","ecr:PutImage"],
      "Resource": "arn:aws:ecr:us-west-1:627073650116:repository/aadml-frontend" }
  ]
}
```

Inline policy `ssm-deploy` — scoped to one instance and one document:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Sid": "SsmSend", "Effect": "Allow", "Action": "ssm:SendCommand",
      "Resource": ["arn:aws:ec2:us-west-1:627073650116:instance/i-0cf64bf864021d64c",
                   "arn:aws:ssm:us-west-1::document/AWS-RunShellScript"] },
    { "Sid": "SsmRead", "Effect": "Allow",
      "Action": ["ssm:GetCommandInvocation","ssm:ListCommandInvocations"], "Resource": "*" }
  ]
}
```

### 3. EC2 host

Attach `AmazonEC2ContainerRegistryReadOnly` to the instance's **existing** role.

> ⚠️ Do **not** create and swap in a new instance profile. `SSMInstanceProfile` is
> what provides SSM connectivity; replacing it cuts off both SSM and the deploy
> path. Add the policy to the role that's already attached.

Then create `/opt/aadml-frontend/` with the three files above, and install the AWS
CLI if missing.

### 4. GitHub settings

Set the variables and secret listed under *Infrastructure reference*.

---

## Environment variables

Vite inlines `VITE_*` at **build** time, the same trap as `NEXT_PUBLIC_*`. Right
now that costs us nothing: every `import.meta.env` use in `src/` has a runtime
fallback (`window.location.origin` / `window.location.host`), and the backend host
is injected at **container start** via `BACKEND_URL` → `envsubst` → `nginx.conf`.
So **one image is valid in every environment** and no build-time secrets exist.

Keep it that way. If you ever add a `VITE_*` var with no runtime fallback, the
image stops being environment-agnostic: you would have to pass it as a build arg in
the workflow and build a separate image per environment. Prefer extending the
`BACKEND_URL`/nginx pattern instead. Never put a secret in a `VITE_*` var — it
ships to the browser.

---

## Later: zero-downtime

The container swap is ~10s. Since a host-level nginx already terminates TLS in
front of this container, blue/green is cheap when you want it: start the new tag on
a second port, flip the host nginx upstream, `docker rm` the old one. Full ECS/ALB
only becomes worth it when you need horizontal scaling and health-based
auto-rollback across instances.
