# ADR-0005 — Deploy ด้วยมือผ่าน wrangler; CI ไม่ deploy และไม่มี Cloudflare credential

- Status: accepted (retro-documented)
- Date of evidence: 2026-10-17 (`0063eb6`)

## Decision
- `.github/workflows/ci.yml`: "CI never deploys: the Worker is deployed manually with `npm run deploy`"; build step = `wrangler deploy --dry-run` ("no Cloudflare credentials in CI")
- CI เรียก reusable workflow `bookchaowalit/platform-ci-workflows` `ci-node.yml` และ `security.yml` pin SHA `87dc5e1c…` (v1.1.1) บน GitHub-hosted runner (public repo)
- Secret ตั้งด้วย `wrangler secret put` (README "Owner deploy steps"); token Cloudflare มาจาก Infisical `/cloudflare` (wrangler.toml comment)

## Evidence
`.github/workflows/ci.yml`, `package.json` (`deploy`, `build`), `wrangler.toml`, `README.md`

## Consequences
- ไม่มี CD gate: deploy ทำได้แม้ CI แดง (เช่น run 2026-11-03 15:53Z security fail แต่ version `380307d1` deploy 15:51Z)
- Worker version ไม่ผูก Git SHA อัตโนมัติ (deployments แสดง `Author: undefined`, `Message: -`)
