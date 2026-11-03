# 15 — CI/CD pipeline

workflow เดียว `.github/workflows/ci.yml` (name `CI`) เรียก reusable workflow 2 ตัวจาก `bookchaowalit/platform-ci-workflows` pin SHA `87dc5e1c7e0416886a6371d5a101bb2ccba38edd` (v1.1.1) บน GitHub-hosted runner `ubuntu-24.04` (default ของ reusable workflow; repo เป็น public) CI ไม่ deploy

```mermaid
flowchart TD
  t1["push to main"] --> ci["workflow CI"]
  t2["pull_request"] --> ci
  t3["workflow_dispatch"] --> ci
  ci --> wk["job worker: ci-node.yml"]
  ci --> sc["job security: security.yml"]
  subgraph node["worker / node (.)"]
    n1["checkout"] --> n2["detect npm via package-lock.json"] --> n3["setup Node 22"] --> n4["npm ci"]
    n4 --> n5["lint auto - skipped, no lint script or biome"]
    n5 --> n6["typecheck - npm run typecheck"]
    n6 --> n7["test - npm test (tsx --test)"]
    n7 --> n8["build - WRANGLER_SEND_METRICS=false npm run build (wrangler deploy --dry-run)"]
  end
  subgraph secj["security"]
    s1["gitleaks"]
    s2["semgrep p/default"]
    s3["osv-scanner"]
    s4["trivy-fs HIGH,CRITICAL"]
  end
  wk --> node
  sc --> secj
  node -.-> manual["Owner/agent: npx wrangler deploy (manual, not gated on CI)"]
```

- `concurrency: ci-${{ github.ref }}`, `cancel-in-progress: true`; `permissions: contents: read`
- Renovate: weekly "before 9am on monday" (Asia/Bangkok), lockfile maintenance รายเดือน, group `platform-ci-workflows`

Sources: `.github/workflows/ci.yml`, `package.json`, `renovate.json`, `bookchaowalit/platform-ci-workflows:.github/workflows/ci-node.yml@87dc5e1c`, `bookchaowalit/platform-ci-workflows:.github/workflows/security.yml@87dc5e1c`; job names จาก `gh run view 41669997267` (2026-11-03)

## Recent results (`gh run list -R bookchaowalit/platform-webhooks-worker -L 50`)
10 runs ทั้งหมด: 7 success, 3 failure — ทั้ง 3 failure มาจาก `security / osv-scanner` และ `security / trivy-fs` (2026-10-24 09:10Z, 2026-11-03 15:53Z, 16:02Z) แก้ด้วย `101a732` (pin undici 7.30.1); job `worker / node` ผ่านทุกครั้ง
