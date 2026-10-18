# Job Application Tracker

A job-application tracker whose backend keeps itself up to date from Gmail: recruiter emails flow through a signed webhook into a MySQL-backed job queue, and a background worker creates or advances applications (applied → screening → interview → offer / rejected).

**[Live demo](https://yashashviarora.github.io/job-tracker-api/)** · **[API health](https://job-tracker-api-mh92.onrender.com/health)**

Register with any email to try the demo. The API runs on Render's free tier, so the first request after a quiet spell can take 30–50 seconds while it wakes up.

Node.js · Express 5 · MySQL (TiDB in production) · MongoDB · JWT · Zod · React · Docker · GitHub Actions

## Architecture

```
Recruiter email ──► Gmail ──► Google Apps Script (every 10 min: sign + POST)
                                   │
                                   ▼
          POST /events/email ──► HMAC + timestamp check ──► inbound_events + jobs  (one transaction)
                                                                 │
                                                                 ▼
          worker (polls every 2 s) ──► claim job (SELECT … FOR UPDATE) ──► classify email
                                                                 │
                    ┌────────────────────────────────────────────┼─────────────────────────┐
                    ▼                                            ▼                         ▼
       create / update application (MySQL)       activity log (MongoDB)      failure ──► back-off retry
                                                                              5th failure ──► dead_letter
                                                                                                │
                                                                         admin: GET /dead-letter, POST …/replay

React frontend (GitHub Pages) ──► REST API ──► applications, stats, activity feed
```

## Stack

| Concern | Choice | Why |
|---|---|---|
| HTTP | Express 5 | Minimal, ubiquitous, async-aware |
| Validation | Zod | One schema validates body, query and params, with coercion and defaults |
| Relational data | MySQL 8 via `mysql2/promise` (TiDB Serverless in production) | Users, applications, tokens, the job queue; needs transactions, row locks and foreign keys |
| Audit log | MongoDB via mongoose | Append-only, read newest-first, never joined |
| Auth | bcryptjs + jsonwebtoken | Access token (15m, stateless) + refresh token (7d, stored, rotated) |
| Hardening | helmet, cors | Security headers |
| Frontend | React + Vite (`web/`) | Dashboard, filters, activity feed |

## Running it locally

Both databases run in Docker.

```bash
docker run -d --name jobtracker-mysql -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=root -e MYSQL_USER=app -e MYSQL_PASSWORD=app -e MYSQL_DATABASE=job_tracker \
  -v jobtracker-mysql-data:/var/lib/mysql mysql:8.4

docker run -d --name jobtracker-mongo -p 27017:27017 \
  -v jobtracker-mongo-data:/data/db mongo:7
```

Then:

```bash
cp .env.example .env        # fill in MYSQL_*, two JWT secrets and WEBHOOK_SECRET
npm install
npm run db:migrate          # creates all tables
npm run dev                 # API + background worker, restarts on change
```

Generate each secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The app validates every environment variable at startup and refuses to boot if one is missing or malformed.

| Variable | Purpose |
|---|---|
| `WEBHOOK_SECRET` | Shared HMAC secret for `/events/email` |
| `WORKER_ENABLED` | `true` runs the queue worker in this process (default); `false` for API-only instances |
| `WORKER_POLL_MS` | How often the worker checks for jobs (default 2000) |

Send a signed test email to the local API:

```bash
node scripts/sendEmailEvent.js --id evt-1 --to you@example.com --from hr@acme.com --subject "Interview invitation"
node scripts/sendEmailEvent.js --id evt-1              # same id again → duplicate: true
node scripts/sendEmailEvent.js --id evt-2 --bad-sig    # → 401
node scripts/sendEmailEvent.js --id evt-3 --old        # timestamp 10 min old → 401
```

## Endpoints

`/applications`, `/activity`, `/admin` and `/dead-letter` require `Authorization: Bearer <accessToken>`.

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | Pings MySQL and MongoDB; 503 if either is down |
| POST | `/auth/register` | `{ email, password }` → user + token pair |
| POST | `/auth/login` | Same shape; identical error for wrong email or password |
| POST | `/auth/refresh` | `{ refreshToken }` → new pair; the old token is single-use |
| POST | `/auth/logout` | `{ refreshToken }` → 204; deletes the server-side record |
| GET | `/auth/me` | Current user |
| GET | `/applications` | Keyset-paginated list, see below |
| POST | `/applications` | Create; `status` defaults to `applied` |
| GET | `/applications/stats` | `{ total, byStatus: { applied, screening, … } }` |
| GET | `/applications/:id` | 404 if missing **or** owned by someone else |
| PATCH | `/applications/:id` | Partial update; at least one field; unknown keys rejected |
| DELETE | `/applications/:id` | 204, then 404 on repeat |
| GET | `/activity` | Recent changes from MongoDB; `?limit=&application_id=` |
| GET | `/admin/users` | Admin only |
| POST | `/events/email` | Inbound email webhook. HMAC-signed, no JWT. 200 `{ received, duplicate }` |
| GET | `/dead-letter` | Admin only. Jobs that failed 5 times and haven't been replayed |
| POST | `/dead-letter/:id/replay` | Admin only. Re-queues the job: 202, 404, or 409 if already replayed |

### Pagination and filters

```
GET /applications?limit=20&sort=created_at&order=desc&status=interview&company=Str&cursor=...
```

- `sort` is allowlisted to `created_at`, `company`, `id`. Anything else is a 400.
- `company` is a prefix match.
- The response is `{ data, nextCursor }`. Pass `nextCursor` back for the next page; `null` means the last page.
- Cursors are opaque base64url. Tampered or malformed cursors return 400.

### Error shape

Every error, from validation to 500, has the same shape and carries the request id that is also in the `X-Request-Id` response header:

```json
{ "error": { "message": "Invalid body", "details": [{ "field": "email", "message": "Invalid email address" }], "requestId": "…" } }
```

## The email pipeline

**1. Gmail → webhook.** A Google Apps Script in the user's Google account runs every 10 minutes. It searches the inbox for job-related mail (ATS senders, subjects like "interview" or "application"), then signs each message and POSTs it as `{ event_id, from, to, subject, text }`. `event_id` is Gmail's message id. A `LAST_RUN` cursor with a 15-minute overlap gives at-least-once delivery, and the API deduplicates. The webhook contract is provider-agnostic: anything that can sign a request can feed it; `scripts/sendEmailEvent.js` does the same for testing.

**2. Ingestion (`POST /events/email`).**
- The signature is `HMAC-SHA256(secret, "<timestamp>.<raw body>")`, sent in `X-Signature` with `X-Timestamp`. It's verified over the exact raw bytes (captured by `express.json({ verify })`), compared with `crypto.timingSafeEqual`, and rejected if the timestamp is more than 5 minutes off. A captured request can't be replayed later.
- The signature is checked before the body is validated, so an unsigned caller gets a 401 and learns nothing about the schema.
- The event and its job are inserted in **one transaction**. A redelivered email hits the unique `event_id` index (`ER_DUP_ENTRY`) and gets 200 `duplicate: true`, so the sender stops retrying.
- The response is sent as soon as the email is stored; processing happens later.

**3. The worker** (`src/worker/worker.js`) runs in the API process and polls every 2 seconds, using a `setTimeout` chain so ticks never overlap.
- **Claim:** `SELECT … FOR UPDATE` on the oldest runnable job, mark it `processing` with `attempts + 1`, commit. The transaction holds the lock for milliseconds; the slow work happens after commit, and the status column marks ownership.
- **Crash recovery:** jobs stuck in `processing` for over 5 minutes are put back in the queue.
- **Process** (`src/services/emailProcessor.js`):
  1. find the user by `to`
  2. skip known newsletter and alert senders
  3. detect the status from the subject first, then the body
  4. match an application by sender domain, or by the company name in the text
  5. if nothing matches and the email is an application confirmation, **create** the application
  6. otherwise **advance** it, forward only, with a compare-and-set update (`WHERE status = <what we read>`) so a user's manual edit is never overwritten
  7. write the activity log
- **Outcomes:** "nothing to do" (unknown sender, no match, backward move) is marked done with a note in `last_error`. Exceptions are retried with exponential back-off (1, 2, 4, 8 s via `run_after`). The 5th failure moves the job to `dead_letter`, where an admin can list and replay it.

**Shutdown.** On SIGTERM (Render redeploys) the server stops accepting requests, lets the in-flight job finish, then closes the database pools. The container runs `exec node`, so Node is PID 1 and actually receives the signal.

## Structure

```
src/
  config/env.js              dotenv + zod; exits on invalid config
  db/mysql.js, mongo.js      connection pool / mongoose, ping
  db/schema.sql, migrate.js  tables + indexes, idempotent migration
  middleware/                requestId, validate, auth (requireAuth, requireRole), errorHandler
  utils/AppError.js          operational errors with status codes
  utils/asyncHandler.js      forwards rejected promises to next(err)
  utils/tokens.js            the only file that touches JWT secrets
  utils/cursor.js            encode/decode keyset cursors
  utils/signature.js         webhook HMAC sign/verify
  utils/emailClassifier.js   pure functions: status detection, company matching, guessing company/role
  schemas/                   zod schemas per resource
  routes/                    URL → validate → controller/service
  controllers/               thin: read req.validated, call service, send
  services/                  business rules, transactions, email processing
  repositories/              SQL and Mongo queries, nothing else (incl. jobs and dead_letter)
  models/ActivityLog.js      mongoose model for activity_log
  worker/worker.js           queue polling loop, retries, dead-lettering
  server.js                  connects DBs, listens, starts/stops the worker
scripts/sendEmailEvent.js    signs and sends test webhook events
web/                         React frontend (see web/README.md)
```

Each layer only calls the layer below it. Controllers never write SQL; repositories never throw HTTP errors.

## Design decisions worth asking me about

**Refresh-token rotation with reuse detection.** The refresh token carries a `jti` stored in `refresh_tokens`. On refresh the row is deleted in one statement; `affectedRows === 0` means the token was already used or revoked, which revokes every session for that user. Access tokens are never stored, so verifying one is a pure HMAC check with no database round trip.

**Ownership in the WHERE clause.** Every applications query is `WHERE id = ? AND user_id = ?`. Another user's row is indistinguishable from a missing one: both are 404.

**Keyset over offset.** `WHERE (sort_col < ? OR (sort_col = ? AND id < ?)) ORDER BY sort_col, id LIMIT n+1`. It's stable under inserts, served by the `(user_id, status, created_at, id)` index, and the extra row says whether a next page exists without a `COUNT`.

**A database table as the queue.** The event and its job are written in the same transaction, so "stored but never queued" can't happen, and no Redis or broker is needed. At higher volume this would move to SQS or BullMQ; the worker's claim, retry and dead-letter logic is the same pattern.

**At-least-once delivery, idempotent processing.** Emails can arrive twice. The unique `event_id` and compare-and-set updates make a second copy harmless. Exactly-once delivery isn't achievable over a network; idempotency is.

**Keep the raw event.** Every email is stored before it's processed. When the classifier improved, the jobs that had been ignored were re-queued with one `UPDATE` and re-run through the new rules, with nothing fetched from Gmail again.

**Best-effort audit log.** MongoDB writes are wrapped so an outage degrades the audit trail rather than failing the MySQL write.

**Fail fast.** Invalid env, unreachable Mongo, or a bad secret stops the process at startup with a clear message instead of failing on the first request.

## Deployment

| Piece | Where |
|---|---|
| API + worker | Render (Docker, free tier). Runs migrations, then `exec node src/server.js`; auto-deploys on push to `main` |
| MySQL | TiDB Serverless (MySQL-compatible, TLS: `MYSQL_SSL=true`) |
| MongoDB | MongoDB Atlas M0 |
| Frontend | GitHub Pages, built by `.github/workflows/web.yml` |
| CI | `.github/workflows/ci.yml`: syntax check, migrations against throwaway MySQL/Mongo containers, and a smoke test covering health, register, create, activity, a signed webhook, a duplicate, and a bad signature |

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | nodemon with restarts |
| `npm start` | migrate, then serve |
| `npm run db:migrate` | apply `schema.sql` |
| `npm run check` | `node --check` on every file in `src/` |

## Known limitations

- Status detection is keyword-based. It handles common recruiter phrasing, and the rules live in one pure module so they can be replaced with an ML or LLM classifier without touching the pipeline.
- Some platforms (e.g. Wellfound) don't include the role in their confirmation emails, so auto-created applications can say "Unknown role" until edited.
- Gmail is polled every 10 minutes; Gmail push notifications via Pub/Sub would make it real-time.
- The frontend keeps the refresh token in `localStorage`; an `httpOnly` cookie would be stricter.
