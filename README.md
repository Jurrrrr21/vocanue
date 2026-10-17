# Vocanue — Phase 2A

Call intake backend for an Australian trades receptionist.

**Twilio → Vapi → Next.js webhook → Prisma → Neon PostgreSQL**

Implemented locally: authenticated webhook, validation, transcript formatting, call extraction, idempotent persistence, migration, and mocked tests. **Neon connectivity, hosted deployment, and a real phone call remain unverified until account setup is completed.** No booking system, dashboard, user authentication, billing, or tenancy is included.

## Setup decisions

- One Next.js App Router application, TypeScript, ESLint, Tailwind CSS, and `@/*` imports. The landing page is a minimal placeholder; it never reads call data.
- Next.js 16.4.2, React 19.2.8, and Prisma 7.10.1. Prisma client, CLI, and PostgreSQL adapter use the same exact version; `package-lock.json` pins the dependency tree. Use Node.js 24 LTS (22.12+ also supported).
- Prisma 7 uses `prisma.config.ts` for CLI connections, a generated client under `generated/prisma`, and `@prisma/adapter-pg` for runtime connections. These are intentional version-specific choices.
- Runtime connections use Neon's pooled URL and a small connection pool per application instance. Migration commands use the direct URL for the same database. No connection is opened during a build.
- Only the Vapi call ID is required for persistence. Unknown details stay `NULL`, with no fabricated status, phone number, summary, or dates. Duration is fractional seconds calculated from the provided timestamps. Timestamps use PostgreSQL `timestamptz`.
- `businessId` is intentionally deferred until a real `Business` table and ownership model exist; introduce the relation and index in a future migration. This release is for one business/test deployment only.

## Local installation

```powershell
npm ci
Copy-Item .env.example .env
```

Edit `.env` locally, without sharing its contents in chat or committing it:

| Variable | Purpose | Local | Vercel |
| --- | --- | --- | --- |
| `DATABASE_URL` | Neon pooled PostgreSQL URL, including SSL parameters | Yes | Yes, server runtime |
| `DIRECT_URL` | Neon direct URL to the same database, for migrations | Yes | Only in the trusted environment that runs migrations |
| `VAPI_WEBHOOK_TOKEN` | Random private token, at least 32 characters | Yes | Yes, server runtime |

Generate a token locally with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Store it in `.env` and in the matching Vapi credential. This is a dedicated webhook token, not your Vapi API key. No `NEXT_PUBLIC_` secret variables are used. Example credentials are placeholders and cannot connect to Neon.

Create/select a **development Neon project or branch**, copy its pooled and direct connection strings, and preserve Neon's required SSL options. Do not disable certificate verification. Production and development should use separate credentials/databases.

```powershell
npm run db:generate
npm run db:deploy
npm run dev
```

`db:deploy` requires your real `DIRECT_URL` and applies the checked-in initial migration, creating `Call`. It changes that database; verify the target first. The localhost fallback in `prisma.config.ts` permits credential-free client generation only; it is not a provisioned database. `db:migrate -- --name description` is for later development schema changes and may require a disposable shadow database. Do not use it against production. Use `db:deploy` for production migrations and run it once from a trusted release environment, before releasing code that depends on the schema.

Inspect records locally using `npm run db:studio`; keep Studio private. No public call-list endpoint is provided.

## Code map

| File | Responsibility |
| --- | --- |
| `app/api/vapi/webhook/route.ts` | Node.js route and dependency wiring |
| `lib/vapi/webhook.ts` | Authentication, bounded body reading, HTTP responses |
| `lib/vapi/validation.ts` | Event envelope and report field validation |
| `lib/vapi/handlers.ts` | Normalize and process completed calls |
| `lib/vapi/transcript.ts` | Label spoken customer/assistant messages |
| `lib/vapi/persistence.ts` | Single upsert keyed by `vapiCallId` |
| `lib/db.ts` | Lazy server-only Prisma client with pool reuse |
| `prisma/schema.prisma` | `Call` model |
| `prisma/migrations/` | Versioned PostgreSQL migration |
| `tests/` | Synthetic events and mocked storage tests |

## Webhook contract

`POST /api/vapi/webhook`, with `Content-Type: application/json` and `Authorization: Bearer <VAPI_WEBHOOK_TOKEN>`.

Authenticate before reading the body. Token digests are compared in constant time. The request body is limited to 2 MiB, including streamed bodies without a content length. Known fields on completed reports are validated; unrelated provider metadata is discarded. Other nonempty event types are acknowledged without requiring call-report fields. Unknown event types are also ignored for forward compatibility; acknowledgment does not implement tools or dynamic assistant selection.

| HTTP status | Meaning |
| --- | --- |
| 200 | Saved successfully, or event intentionally ignored |
| 400 | Invalid JSON, envelope, report fields, or date ordering |
| 401 | Missing or incorrect Bearer token |
| 413 | Body exceeds 2 MiB |
| 415 | Unsupported content type |
| 503 | Missing server configuration or persistence failure |

Success is returned only after persistence completes. If a save fails, investigate and redeliver the event after recovery; do not assume provider retries guarantee delivery. There is no durable queue in this phase.

Report fields read: `call.id`, `call.status`, `customer.number` or `call.customer.number`, report-level `startedAt`/`endedAt` with `call` fallbacks, `endedReason`, `analysis.summary`, and `artifact`. Analysis, artifact, and end reason also support the corresponding documented `call` fields. Negative elapsed durations are rejected; one missing timestamp means unknown duration. No undocumented duration property is assumed.

Structured `artifact.messages` are preferred, followed by `messagesOpenAIFormatted`, then the provider's plain transcript. `user` becomes Customer; `assistant`/`bot` become Assistant. System/tool messages are omitted. Plain text is preserved without guessing speaker boundaries. Empty fields are omitted from updates, while zero duration is retained. Recording URLs, raw webhook bodies, and other artifact data are never persisted. A unique database index and a single nonempty native upsert prevent duplicate records, including simultaneous deliveries. A later nonempty value may replace an earlier one; this phase does not merge or version conflicting transcripts.

## Connect Vapi

These steps change external account configuration and should be done after database setup and deployment:

1. In Vapi's Integrations → Server Configuration, create a custom **Bearer Token** credential. Use the private token from your environment, header `Authorization`, and enable the Bearer prefix.
2. On your **saved assistant**, set `server.url` to `https://YOUR-DEPLOYMENT/api/vapi/webhook` and `server.credentialId` to that credential's ID. Do not put a token in a URL.
3. Include `end-of-call-report` in the assistant's `serverMessages`. Subscribe only to this event for Phase 2A. This endpoint does not supply responses for tools or `assistant-request`; assign the saved assistant directly to the phone number.
4. Ensure transcripts/messages are available in the assistant's artifact settings. If you expect a summary, confirm that Vapi's analysis/summary configuration generates `analysis.summary`; missing analysis is stored as unknown. Disable call recordings in Vapi (`artifactPlan.recordingEnabled: false`) and check Twilio recording settings separately.
5. Confirm your Australian Twilio number is connected to Vapi and assigned to this saved assistant. No Twilio or Vapi API key is needed by this receiving backend.
6. Keep the webhook URL on the saved resource. Vapi may withhold organization credentials for URLs passed through transient assistants or per-call overrides; this backend will correctly reject an unauthenticated delivery.

For local calls, a trusted HTTPS tunnel can expose port 3000; configure the tunnel URL on a test assistant. A deployed staging URL is another option. Localhost alone cannot receive Vapi requests.

## Deployment to Vercel

1. Put the project in your GitHub repository; review ignored files before committing. No Git repository or remote is created automatically by this setup.
2. Import the repository in Vercel as a Next.js application. Use Node.js 24, `npm ci` installation, and `npm run build`.
3. Configure runtime `DATABASE_URL` and `VAPI_WEBHOOK_TOKEN` in the intended environment. Keep preview deployments isolated from the production database. Store `DIRECT_URL` only where migrations run.
4. With credentials for the intended Neon database, run `npm run db:deploy` from a trusted release environment. Build/client generation alone does not apply migrations.
5. Deploy and use the public HTTPS route above. Ensure deployment protection permits Vapi to reach this route; application Bearer authentication must remain enabled. Keep private previews protected and use a suitable production/staging endpoint.
6. Update the saved Vapi assistant's URL/credential and verify webhook logs. Redeploy after changing Vercel environment variables.

The Prisma client is regenerated during installation and build because generated code is ignored. The route explicitly uses the Node.js runtime, not Edge. The homepage renders without database credentials and does not imply that Neon is connected.

## Verification

```powershell
npm test
npm run lint
npm run typecheck
npm run build
```

Tests use synthetic payloads and mocked database operations, never a live customer database. Coverage includes the eight requested scenarios, malformed JSON, content type, timestamp ordering, streamed body limits, alternate transcript formats, sparse duplicate preservation, and the actual Prisma upsert arguments. They do not prove connectivity or PostgreSQL behavior against a live server.

### Dependency audit limitation

The initial audit identified Next.js and Prisma vulnerabilities; both were upgraded to the patched releases above. Five high-severity audit entries remain in the development-only Next.js ESLint dependency chain, all stemming from `braces` stack exhaustion. The registry currently offers no patched `braces` release; the suggested automated fix would downgrade the Next.js lint configuration to an unrelated major version. No forced downgrade or TLS bypass was applied. The webhook does not execute this glob-pattern tooling. Recheck `npm audit` and upgrade the lint dependency chain when a compatible patch is published. ESLint 9 is retained because the bundled React/import/accessibility plugins do not declare ESLint 10 support; the registry marks ESLint 9 as out of support. This is a tooling maintenance limitation, not a clean full dependency audit.

### Real end-to-end acceptance test (requires your accounts)

1. Confirm migrations succeeded and the deployed runtime has the correct pooled database URL and token.
2. Call the connected Australian Twilio number using a test caller, and discuss a fictional plumbing issue with Vapi.
3. Hang up and wait for post-call processing.
4. In Vapi webhook logs, confirm `end-of-call-report` reached the endpoint and received HTTP 200. A 401 suggests a credential mismatch; a 503 requires checking server configuration/database reachability. Do not copy full payloads into public logs or issues.
5. In private Prisma Studio or Neon's SQL editor, find `Call` by the exact Vapi call ID. Check caller number, timestamps, fractional duration, transcript labels, summary (if generated), and end reason.
6. Redeliver the authenticated report using your provider tooling or a private test client. Verify the row count for that `vapiCallId` remains one and `updatedAt` changes.
7. Verify a sparse repeat does not clear the transcript/summary. Delete test call data when finished according to your chosen retention policy.

**Do not mark Phase 2A complete until this real test has passed.** Database creation, external configuration, and real-call verification cannot be inferred from mocked tests or a successful build.

## Personal call data

Phone numbers, transcripts, and summaries are private customer data. Keep database/hosting account access restricted, require MFA, use separate least-privilege runtime and migration roles, and preserve TLS. This app intentionally has no browser access to calls. Before adding a dashboard, implement business ownership and authorization.

Choose and document a retention period with the business before collecting real customer calls. This release does not automatically delete data: schedule an explicit operational deletion process, include backups and provider copies in the policy, and document who can export or delete records. Do not assume deletion in Neon removes data retained by Vapi or Twilio. Configure provider retention independently. Use fictional callers until the business has settled its customer notice and data-handling requirements. Application error logs contain fixed error codes only; do not add payload, header, transcript, phone number, or raw database error logging.

## Official references checked

- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
- [Prisma 7 with Next.js](https://www.prisma.io/docs/guides/v7/frameworks/nextjs)
- [Vapi server events](https://docs.vapi.ai/server-url/events)
- [Vapi server authentication](https://docs.vapi.ai/server-url/server-authentication)
- [Official Vapi report type](https://github.com/VapiAI/server-sdk-typescript/blob/main/src/api/types/ServerMessageEndOfCallReport.ts)
- [Official Vapi call type](https://github.com/VapiAI/server-sdk-typescript/blob/main/src/api/types/Call.ts)
- [Official Vapi artifact type](https://github.com/VapiAI/server-sdk-typescript/blob/main/src/api/types/Artifact.ts)

Provider schemas may evolve. Recheck those sources before expanding accepted fields or changing authentication.
