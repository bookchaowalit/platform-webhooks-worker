# Core 22 SDLC diagram pack — platform-webhooks-worker

ชุด diagram 22 รายการตาม SDLC Diagram Catalog v2 วาดจาก code และ config จริงของ Cloudflare Worker `solo-empire-hooks` (`hooks.bookchaowalit.com`, Stripe-only slice, ADR-0008 queue plane M1) ณ `origin/main` `4f8eb72` (2026-11-03)

| # | Item | Status | File | Sources read |
|---|---|---|---|---|
| 01 | Business process (As-Is / To-Be) | done | [01-business-process.md](01-business-process.md) | `src/worker.ts`, `wrangler.toml`, `README.md`, `PRODUCT.md`, ADR-0008 |
| 02 | Use cases | done | [02-use-cases.md](02-use-cases.md) | `src/worker.ts`, `wrangler.toml`, `README.md`, uptime `src/targets.ts` |
| 03 | User flows | done | [03-user-flows.md](03-user-flows.md) | `src/worker.ts`, `wrangler.toml`, `tests/` |
| 04 | Traceability (RTM) | done | [04-traceability.md](04-traceability.md) | `PRODUCT.md`, `README.md`, `src/`, `tests/`, `ci.yml`, wrangler deployments |
| 05 | C4 Context | done | [05-c4-context.md](05-c4-context.md) | `wrangler.toml`, `src/`, `README.md`, uptime Worker |
| 06 | C4 Container | done | [06-c4-container.md](06-c4-container.md) | `wrangler.toml`, `src/`, `package.json`, `wrangler queues info` |
| 07 | C4 Component | done | [07-c4-component.md](07-c4-component.md) | `src/worker.ts`, `src/sentry.ts` |
| 08 | ADRs | done (5) | [08-adr/](08-adr/) | `wrangler.toml`, `src/`, `ci.yml`, `package.json`, `README.md`, ADR-0008 |
| 09 | ERD / data model | done (R2 + Queue bindings) | [09-erd.md](09-erd.md) | `wrangler.toml`, `src/worker.ts`, `tests/events.test.ts` |
| 10 | Sequences | done | [10-sequences.md](10-sequences.md) | `src/worker.ts`, `tests/`, uptime `src/monitor.ts` |
| 11 | State machines | done | [11-state-machines.md](11-state-machines.md) | `src/worker.ts`, `wrangler.toml` |
| 12 | API and integrations | done | [12-api-integration.md](12-api-integration.md) | `src/worker.ts`, `wrangler.toml`, `README.md`, `domains.yaml` |
| 13 | Threat model | done | [13-threat-model.md](13-threat-model.md) | `src/`, `wrangler.toml`, `package.json`, `renovate.json`, `ci.yml`, `tests/` |
| 14 | Backup and DR | done | [14-backup-dr.md](14-backup-dr.md) | `README.md`, `wrangler.toml`, R2 lifecycle list, ADR-0008 |
| 15 | CI/CD pipeline | done | [15-cicd-pipeline.md](15-cicd-pipeline.md) | `ci.yml`, reusable `ci-node.yml` / `security.yml` @87dc5e1c, `renovate.json`, `gh run list` |
| 16 | Deployment | done | [16-deployment.md](16-deployment.md) | `wrangler.toml`, `README.md`, wrangler deployments, `domains.yaml` |
| 17 | Test coverage matrix | done | [17-test-coverage-matrix.md](17-test-coverage-matrix.md) | `tests/*.test.ts`, `package.json`, `ci.yml` |
| 18 | Git / release workflow | done | [18-git-release-workflow.md](18-git-release-workflow.md) | `git log`, `gh run list`, wrangler deployments, GitHub branch protection API |
| 19 | Service dependency map | done | [19-service-dependency-map.md](19-service-dependency-map.md) | `src/worker.ts`, `wrangler.toml`, `README.md` |
| 20 | Observability | done | [20-observability.md](20-observability.md) | `src/`, `README.md`, `PRODUCT.md`, uptime Worker |
| 21 | Incident response | done | [21-incident-response.md](21-incident-response.md) | `README.md`, `src/worker.ts`, uptime `src/monitor.ts` |
| 22 | DORA | done (recovery time not computable) | [22-dora.md](22-dora.md) | wrangler deployments, `git log`, `gh run list` |

Existing docs ที่เกี่ยวข้อง (link, ไม่ copy): [`../../README.md`](../../README.md), [`../../PRODUCT.md`](../../PRODUCT.md), central [ADR-0008](https://github.com/bookchaowalit/architecture-docs/blob/main/docs/architecture/decisions/ADR-0008-messaging-queue-and-event-broker.md)

External sources ที่อ้าง: `bookchaowalit/platform-uptime-worker` (`src/targets.ts`, `src/monitor.ts`, `wrangler.toml`), `bookchaowalit/platform-ops-cli:infra/platform/domains.yaml`, `bookchaowalit/platform-ci-workflows@87dc5e1c`, ops records messaging-layer-adr-0008 และ prod-baseline-monitoring-backups (2026-11-03)
