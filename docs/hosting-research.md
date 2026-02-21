# Hosting Research: Reflog PWA

- **Date**: 2026-02-21
- **Domain**: reflog.microcode.io
- **Current State**: Client-side-only PWA (static files ~3 MB)
- **Future Plans**: Secure online storage + multi-device syncing (backend/API needed)

## Constraints

- Cheapest option preferred
- Must support custom domain: `reflog.microcode.io`
- Must be portable to homelab hardware
- AWS account available
- Domain `microcode.io` managed via AWS Route 53

---

## Options Evaluated

### 1. AWS S3 + CloudFront

Monthly cost: $0 (within free CloudFront bundle)

AWS's free CloudFront plan includes 1 million requests/month, 100 GB data transfer, and 5 GB S3 storage. For a ~3 MB PWA with under 10K visits/month, this stays well within the free tier.

| Aspect           | Details                                                                       |
| ---------------- | ----------------------------------------------------------------------------- |
| Backend later?   | No. Would need Lambda@Edge, API Gateway, or a separate service                |
| Homelab portable | No. Locked into AWS infrastructure                                            |
| DNS setup        | Route 53 Alias record to CloudFront distribution (free, no query charges)     |
| SSL/TLS          | Free via ACM (must request cert in `us-east-1` for CloudFront)                |
| Setup complexity | Medium-High. S3 bucket, bucket policy, CloudFront distribution, ACM cert     |

Pros: Truly free at low traffic. Fast CDN. AWS-native. Route 53 Alias records avoid CNAME limitations and query charges.

Cons: Not portable. Adding a backend requires stitching together multiple AWS services. Complex initial setup.

---

### 2. AWS Amplify Hosting

Monthly cost: ~$0-0.50 (after free tier credits)

Amplify pricing: $0.023/GB storage, $0.15/GB transfer, $0.01/build minute. New AWS accounts get $200 in credits. At very low traffic (~1-2 GB transfer/month), ongoing cost is ~$0.15-0.30/month.

| Aspect           | Details                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------- |
| Backend later?   | Yes, via Amplify backend (Lambda, DynamoDB, Cognito). Opinionated and vendor-locked.          |
| Homelab portable | No. Entirely AWS-managed                                                                      |
| DNS setup        | Route 53 Alias record to Amplify domain. Amplify console auto-configures if using Route 53.   |
| SSL/TLS          | Automatic. Free provisioning and renewal                                                      |
| Setup complexity | Low. Connect Git repo, auto-builds and deploys                                                |

Pros: Simplest AWS option. Git-push deploys. Automatic SSL. Seamless Route 53 integration.

Cons: Not portable. $0.15/GB transfer is expensive if traffic grows. Amplify backend is opinionated.

---

### 3. AWS Lightsail ($3.50/month VPS)

Monthly cost: $3.50 ($0 for first 3 months)

The $3.50/month plan includes 512 MB RAM, 2 vCPUs, 20 GB SSD, 1 TB data transfer, and a static IPv4 address.

| Aspect           | Details                                                                   |
| ---------------- | ------------------------------------------------------------------------- |
| Backend later?   | Yes. Full Linux server. Run anything                                      |
| Homelab portable | Yes. Whatever runs on Lightsail runs identically on homelab               |
| DNS setup        | Route 53 A record pointing to Lightsail static IP                         |
| SSL/TLS          | Manual. Let's Encrypt with Certbot                                        |
| Setup complexity | Medium. You manage the server: OS updates, security, firewall, SSL        |

Pros: Full server. Run anything. Perfectly portable. Generous 1 TB transfer. Predictable cost.

Cons: $3.50/month is not free. You are the sysadmin. 512 MB RAM is tight for Node.js API + database.

---

### 4. Cloudflare Pages (Free Tier)

Monthly cost: $0 (perpetual, not a trial)

Free tier includes unlimited bandwidth, unlimited static requests, 500 builds/month, 100 custom domains per project, free SSL, and a global CDN with 300+ edge locations.

For a future backend, Cloudflare Workers free tier provides 100,000 requests/day (~3M/month), and D1 (SQLite database) offers 5 GB free storage.

| Aspect           | Details                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| Backend later?   | Yes. Workers + D1 (SQLite). Free tier: 100K requests/day. Paid: $5/month for 10M requests         |
| Homelab portable | Partial. Static hosting not portable, but Workers code can adapt to a standard Node.js server      |
| DNS setup        | Route 53 CNAME record for `reflog.microcode.io` pointing to the Pages project domain               |
| SSL/TLS          | Automatic. Zero configuration                                                                     |
| Setup complexity | Very Low. Connect GitHub repo, set build command and output directory                              |

Pros: Truly $0 forever. Unlimited bandwidth. Fastest CDN. Workers provide a solid backend path. Dead simple setup.

Cons: Workers runtime has quirks (no native Node.js APIs, V8 isolates). Static site portion is not homelab-portable.

---

### 5. Docker Container (nginx) on AWS

Monthly cost: $3.50+ minimum

| AWS Service                | Cheapest Config           | Monthly Cost                       |
| -------------------------- | ------------------------- | ---------------------------------- |
| Lightsail (Docker yourself)| 512 MB / 2 vCPU           | $3.50/month                        |
| Lightsail Container Service| Micro (free 3 months)     | $10/month                          |
| ECS on Fargate             | 0.25 vCPU / 0.5 GB       | ~$9-13/month                       |
| App Runner                 | 0.25 vCPU / 0.5 GB       | ~$5-7/month                        |
| EC2 t4g.micro              | 1 vCPU / 1 GB (free tier) | $0 first 12 months, ~$6/month after|

| Aspect           | Details                                                                       |
| ---------------- | ----------------------------------------------------------------------------- |
| Backend later?   | Yes. Full Docker environment                                                  |
| Homelab portable | Yes, perfectly. `docker-compose up` works the same everywhere                 |
| DNS setup        | Route 53 A record to server IP                                                |
| SSL/TLS          | Let's Encrypt via Certbot or reverse proxy (Traefik/Caddy)                    |
| Setup complexity | Higher. Must manage Docker, orchestration, SSL, backups, security             |

Pros: Maximum portability. Docker is the gold standard for cloud-to-homelab migration.

Cons: Minimum $3.50/month. You manage everything. Overkill for static files today.

---

### 6. Coolify or Dokku (Self-Hosted PaaS)

Monthly cost: $0 (software) + server cost ($3.50-5/month cloud, $0 homelab)

#### Coolify

- Open source, self-hostable alternative to Vercel/Netlify
- Git push deploys, automatic SSL (Let's Encrypt), Docker support, 280+ one-click services
- Minimum: ~2 GB RAM recommended
- Works on: VPS, Raspberry Pi, homelab

#### Dokku

- Open source, smallest PaaS ("mini Heroku")
- Git push deploys using Heroku buildpacks or Dockerfiles
- Automatic SSL via Let's Encrypt plugin
- Plugin ecosystem for databases (PostgreSQL, Redis, etc.)
- Minimum: ~1 GB RAM recommended
- Works on: Any hardware that runs Docker

| Aspect           | Details                                                                               |
| ---------------- | ------------------------------------------------------------------------------------- |
| Backend later?   | Yes. Deploy any app, any language, any framework. Add databases with one command       |
| Homelab portable | Yes. This is the primary use case                                                     |
| DNS setup        | Route 53 A record to server IP. Both support custom domains per app                   |
| SSL/TLS          | Automatic Let's Encrypt                                                               |
| Setup complexity | Medium initial (~10 minutes), low ongoing (`git push` to deploy)                      |

Recommendation between the two: Dokku for $3.50/month Lightsail (lighter weight), Coolify for $5/month+ or homelab with 2+ GB RAM (nicer UI, more features).

---

## Comparison Summary

| Option              | Monthly Cost | Backend Later     | Homelab Portable | Setup Complexity | SSL            |
| ------------------- | ------------ | ----------------- | ---------------- | ---------------- | -------------- |
| **Cloudflare Pages** | **$0**      | Yes (Workers)     | Partial          | **Very Low**     | Auto           |
| S3 + CloudFront     | $0           | No                | No               | Medium-High      | Free (ACM)     |
| AWS Amplify         | ~$0-0.50     | Yes (opinionated) | No               | Low              | Auto           |
| Lightsail VPS       | $3.50        | Yes (full server) | Yes              | Medium           | Let's Encrypt  |
| Docker on AWS       | $3.50+       | Yes (full Docker) | **Yes**          | High             | Let's Encrypt  |
| Dokku on VPS        | $3.50+       | Yes (anything)    | **Yes**          | Medium           | Auto           |
| Coolify on VPS      | $5+          | Yes (anything)    | **Yes**          | Medium           | Auto           |

---

## DNS Setup for `reflog.microcode.io`

DNS is managed via AWS Route 53 (existing hosted zone for `microcode.io`).

### Record Types by Hosting Option

For AWS services (CloudFront, Amplify), use **Alias records** in Route 53. Alias records are free (no per-query charges) and resolve at the DNS level without exposing a CNAME chain:

```text
reflog.microcode.io  A (Alias)  → CloudFront distribution / Amplify domain
```

For non-AWS services (Cloudflare Pages) or servers, use standard records:

```text
reflog.microcode.io  CNAME  → reflog-xyz.pages.dev     (Cloudflare Pages)
reflog.microcode.io  A      → 3.92.45.123              (Lightsail / VPS / homelab)
```

Since `reflog` is a subdomain (not the apex `microcode.io`), CNAME records work without issues.

### Route 53 Cost

The existing hosted zone for `microcode.io` is $0.50/month. Adding a record for `reflog.microcode.io` costs nothing extra -- Route 53 charges per hosted zone, not per record. Query charges are $0.40 per million queries (negligible at low traffic).

---

## Recommendation: Phased Approach

### Phase 1 (Now) -- Cloudflare Pages: $0/month

Deploy the static PWA to Cloudflare Pages. Unlimited bandwidth, automatic SSL, global CDN, git-push deploys, all free.

Setup steps:

1. Create free Cloudflare account
2. Connect GitHub repo to Cloudflare Pages
3. Set build command: `yarn build`
4. Set output directory: `dist/client`
5. Add custom domain: `reflog.microcode.io`
6. In Route 53, add a CNAME record: `reflog.microcode.io` → Pages project domain

### Phase 2 (Backend needed) -- Two paths

**Path A: Cloudflare Workers + D1 ($0-5/month)** --
Use Workers for the sync API and D1 (SQLite) for storage. Free tier handles 100K requests/day. Cheapest option but Workers runtime has limitations (no native Node.js APIs, limited CPU time per request).

**Path B: Dokku on Lightsail ($3.50/month)** --
Keep Cloudflare Pages for the static frontend (free CDN). Deploy the backend API to a Lightsail VPS running Dokku at `api.reflog.microcode.io`. Full Node.js/Docker environment with zero runtime limitations. Add an A record in Route 53 for the API subdomain.

### Phase 3 (Homelab migration) -- $0/month

1. Install Dokku (or Coolify) on homelab hardware
2. `git push` to deploy
3. Use Cloudflare Tunnel (free) to expose the homelab without opening ports
4. Point `reflog.microcode.io` to the Cloudflare Tunnel
5. Total cost: electricity only

---

## Bottom Line

Start with Cloudflare Pages -- free, fast, trivial to set up. When a backend is needed, add either Workers (cheapest) or a Dokku VPS (most portable). Either path migrates cleanly to homelab hardware at $0/month via Cloudflare Tunnel.

The only scenario where AWS makes more sense is wanting everything in one ecosystem. For cost optimization with homelab portability, the Cloudflare + Dokku combination is the best fit.
