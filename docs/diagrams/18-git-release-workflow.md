# 18 — Git and release workflow

จาก `git log`: 14 commits บน `main`, มีเพียง PR #1 (`0063eb6`, branch `ci/devsecops-phase1`) ผ่าน pull request ที่เหลือ commit/push ตรงเข้า `main`; `main` ไม่มี branch protection หรือ ruleset (GitHub API, 2026-11-03) Deploy แยกจาก Git: รัน `wrangler deploy` จาก working tree ด้วยมือ (deploy เกิดก่อน commit ที่ตรงกันราว 13–138 วินาที)

```mermaid
gitGraph
  commit id: "c1f75d3 feat: hooks worker"
  commit id: "fe67f5b chore: license"
  branch ci/devsecops-phase1
  commit id: "shared CI"
  checkout main
  merge ci/devsecops-phase1 id: "0063eb6 PR #1"
  commit id: "9719421 feat: Sentry"
  commit id: "15b1f0a fix(sentry)"
  commit id: "986656e deploy: domain" tag: "v384e13fc"
  commit id: "f58434d docs: Stripe live"
  commit id: "ac2c288 feat(queue)" tag: "v380307d1"
  commit id: "1ecca28 feat(health)" tag: "v10426a30"
  commit id: "101a732 fix(deps)"
  commit id: "4f8eb72 fix(queue)" tag: "v03d4e656"
```

```mermaid
flowchart LR
  e["Edit locally"] --> t["npm test, npm run typecheck"]
  t --> d["npx wrangler deploy (manual)"]
  d --> s["Smoke: signed synthetic event, wrangler tail"]
  s --> c["git commit on main"]
  c --> p["git push origin main"]
  p --> ci["CI runs after the fact"]
  r["Codex review Stop hook"] -.-> c
```

tags ในกราฟ (`v…`) คือ Worker version id ที่ deploy ใกล้ commit นั้น ไม่ใช่ Git tag จริง — repo ไม่มี Git tag หรือ GitHub release

Sources: `git log --format='%h %ad %s' --date=iso-strict`, `gh run list -R bookchaowalit/platform-webhooks-worker -L 50`, `wrangler deployments list --name solo-empire-hooks` (2026-11-03), `.github/workflows/ci.yml`, `README.md`; commit `4f8eb72` message "(Codex review)"
