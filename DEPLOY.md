# Frontend deployment

Images are built in **GitHub Actions** and pushed to **Amazon ECR**. The EC2 host
only pulls and swaps containers — it never runs `npm install`, `vite build`, or
`docker compose build`.

```
push to main → GitHub Actions (npm ci → npm test → docker build) → ECR
                                                                     ↓
                                            EC2: deploy.sh <sha> → pull → up -d
```

Every image is tagged with the short commit SHA, so rollback is a re-deploy of an
older tag rather than a rebuild.

---

## One-time setup

### 1. ECR repository

```bash
aws ecr create-repository \
  --repository-name aadml-frontend \
  --region <AWS_REGION> \
  --image-scanning-configuration scanOnPush=true
```

Optional but recommended — expire untagged images so the repo does not grow forever:

```bash
aws ecr put-lifecycle-policy \
  --repository-name aadml-frontend \
  --region <AWS_REGION> \
  --lifecycle-policy-text '{"rules":[{"rulePriority":1,"description":"expire untagged","selection":{"tagStatus":"untagged","countType":"sinceImagePushed","countUnit":"days","countNumber":7},"action":{"type":"expire"}}]}'
```

### 2. GitHub → AWS trust (OIDC, no long-lived keys)

Create the OIDC provider once per AWS account:

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com
```

Then a role that only this repo can assume, with a trust policy of:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": { "token.actions.githubusercontent.com:aud": "sts.amazonaws.com" },
      "StringLike": { "token.actions.githubusercontent.com:sub": "repo:datatrader-space/agentic-system-frontend:*" }
    }
  }]
}
```

Attach a permissions policy allowing `ecr:GetAuthorizationToken` plus push/pull on
the `aadml-frontend` repository (`AmazonEC2ContainerRegistryPowerUser` is the
quick option; scope it down to the one repo when you have time).

### 3. EC2 host

Give the **frontend instance** an instance profile with
`AmazonEC2ContainerRegistryReadOnly` — that way `deploy.sh` authenticates to ECR
with no AWS keys stored on the box. Then:

```bash
sudo mkdir -p /opt/aadml-frontend
sudo chown "$USER" /opt/aadml-frontend
cd /opt/aadml-frontend

# these three files are all the host needs
curl -O https://raw.githubusercontent.com/datatrader-space/agentic-system-frontend/main/docker-compose.yml
curl -O https://raw.githubusercontent.com/datatrader-space/agentic-system-frontend/main/deploy.sh
chmod +x deploy.sh

cat > .deploy.env <<'EOF'
ECR_REGISTRY=<ACCOUNT_ID>.dkr.ecr.<AWS_REGION>.amazonaws.com
ECR_REPOSITORY=aadml-frontend
IMAGE_TAG=
BACKEND_URL=172.31.6.43:8000
APP_PORT=8002
EOF
```

`.deploy.env` is the host's only config file. `deploy.sh` rewrites `IMAGE_TAG` in
it on every deploy, so it always records what is actually running.

Also make sure the AWS CLI and `docker compose` v2 are installed on the host.

### 4. GitHub repository settings

**Variables** (Settings → Secrets and variables → Actions → Variables):

| Name             | Example          |
| ---------------- | ---------------- |
| `AWS_REGION`     | `us-west-1`      |
| `ECR_REPOSITORY` | `aadml-frontend` |

| `EC2_INSTANCE_ID` | `i-0cf64bf864021d64c` |

**Secrets:**

| Name                  | Value                                               |
| --------------------- | --------------------------------------------------- |
| `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::<ACCOUNT_ID>:role/<gh-actions-role>`  |

The deploy job reaches the box over **AWS SSM**, not SSH — so no private key is
stored in GitHub and port 22 never has to accept GitHub runner IPs. The role in
Step 4 therefore also needs `ssm:SendCommand` on the instance and the
`AWS-RunShellScript` document, plus `ssm:GetCommandInvocation`.

SSM runs commands as root, so the job wraps the call in
`runuser -l ubuntu -c '…'`. That matters: `deploy.sh` rewrites `IMAGE_TAG` with
`sed -i`, which as root would leave `.deploy.env` root-owned and break later
manual runs as `ubuntu`.

---

## Day-to-day

| Action | Command |
| --- | --- |
| Deploy | merge to `main` — the workflow does the rest |
| Deploy a specific build | `./deploy.sh a84f6d2` |
| Roll back | `./deploy.sh <previous-sha>` |
| See what's running | `grep IMAGE_TAG /opt/aadml-frontend/.deploy.env` |
| Logs | `docker compose --env-file .deploy.env logs -f frontend` |

`deploy.sh` waits for the container healthcheck. If the new image never turns
healthy it dumps the last 50 log lines, restores the previous tag, and exits
non-zero — so a bad build fails the pipeline instead of taking the site down.

Build locally (dev only — never on the prod host):

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

---

## Environment variables

Vite inlines `VITE_*` at **build** time, the same trap as `NEXT_PUBLIC_*`. Right
now that costs us nothing: every `import.meta.env` use in `src/` has a runtime
fallback (`window.location.origin` / `window.location.host`), and the backend
host is injected at **container start** via `BACKEND_URL` → `envsubst` →
`nginx.conf`. So **one image is valid in every environment** and no build-time
secrets exist.

Keep it that way. If you ever add a `VITE_*` var with no runtime fallback, the
image stops being environment-agnostic: you would have to pass it as a build arg
in the workflow and build a separate image per environment. Prefer extending the
`BACKEND_URL`/nginx pattern instead. Never put a secret in a `VITE_*` var — it
ships to the browser.

---

## Later: zero-downtime

Swapping a single container is ~1–2s of downtime. Since a host-level nginx
already terminates TLS in front of this container, blue/green is cheap when you
want it: start the new tag on a second port, flip the host nginx upstream,
`docker rm` the old one. Full ECS/ALB only becomes worth it when you need
horizontal scaling and health-based auto-rollback across instances.
