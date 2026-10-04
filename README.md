# Job Application Tracker API

A backend for tracking job applications, built to learn Node.js and Express properly: layered structure, JWT auth with refresh-token rotation, keyset pagination, MySQL for transactional data and MongoDB for the audit log.

Plain JavaScript (CommonJS). Express 5, Zod 4, mysql2, mongoose.

## Stack

| Concern | Choice | Why |
|---|---|---|
| HTTP | Express 5 | Minimal, ubiquitous, async-aware |
| Validation | Zod | One schema validates body, query and params; types are inferred |
| Relational data | MySQL 8 via `mysql2/promise` | Users, applications, refresh tokens; needs transactions and foreign keys |
| Audit log | MongoDB via mongoose | Append-only, read newest-first, never joined |
| Auth | bcryptjs + jsonwebtoken | Access token (15m, stateless) + refresh token (7d, stored, rotated) |
| Hardening | helmet, cors | Sensible security headers |

## Running it

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
cp .env.example .env        # fill in MYSQL_* and generate two JWT secrets
npm install
npm run db:migrate          # creates users, applications, refresh_tokens
npm run dev                 # nodemon, restarts on change
```

Generate secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

The app validates every environment variable at startup and refuses to boot if one is missing or malformed.

## Endpoints

All `/applications`, `/activity` and `/admin` routes require `Authorization: Bearer <accessToken>`.

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | Pings MySQL and MongoDB; 503 if either is down |
| POST | `/auth/register` | `{ email, password }` → user + token pair |
| POST | `/auth/login` | Same shape; identical error for wrong email or password |
| POST | `/auth/refresh` | `{ refreshToken }` → new pair; old token is single-use |
| POST | `/auth/logout` | `{ refreshToken }` → 204; deletes the server-side record |
| GET | `/auth/me` | Current user |
| GET | `/applications` | Keyset-paginated list, see below |
| POST | `/applications` | Create; `status` defaults to `applied` |
| GET | `/applications/stats` | `{ total, byStatus: { applied, screening, … } }` |
| GET | `/applications/:id` | 404 if missing **or** owned by someone else |
| PATCH | `/applications/:id` | Partial update; at least one field; unknown keys rejected |
| DELETE | `/applications/:id` | 204, then 404 on repeat |
| GET | `/activity` | My recent changes from MongoDB; `?limit=&application_id=` |
| GET | `/admin/users` | Admin role only |

### Pagination and filters

```
GET /applications?limit=20&sort=created_at&order=desc&status=interview&company=Str&cursor=...
```

- `sort` is whitelisted to `created_at`, `company`, `id`. Anything else is a 400.
- `company` is a prefix match.
- The response is `{ data, nextCursor }`. Pass `nextCursor` back to get the next page; `null` means last page.
- Cursors are opaque base64url. Tampered or malformed cursors return 400.

### Error shape

Every error, from validation to 500, has the same shape and carries the request id that is also in the `X-Request-Id` response header:

```json
{ "error": { "message": "Invalid body", "details": [{ "field": "email", "message": "Invalid email address" }], "requestId": "…" } }
```

## Structure

```
src/
  config/env.js            dotenv + zod; exits on invalid config
  db/mysql.js              connection pool, ping
  db/mongo.js              mongoose connect, ping
  db/schema.sql            tables + indexes
  db/migrate.js            runs schema.sql
  middleware/requestId.js  X-Request-Id, honours incoming header
  middleware/validate.js   validate({ body, query, params }) → req.validated
  middleware/auth.js       requireAuth (JWT), requireRole('admin')
  middleware/errorHandler.js  notFound + the single 4-arg error handler
  utils/AppError.js        operational errors with status codes
  utils/asyncHandler.js    forwards rejected promises to next(err)
  utils/tokens.js          the only file that touches JWT secrets
  utils/cursor.js          encode/decode keyset cursors
  schemas/                 zod schemas per resource
  routes/                  URL → validate → controller
  controllers/             thin: read req.validated, call service, send
  services/                business rules, transactions
  repositories/            SQL and Mongo queries, nothing else
  models/ActivityLog.js    mongoose model for activity_log
```

Each layer only calls the layer below it. Controllers never write SQL; repositories never throw HTTP errors.

## Design decisions worth asking me about

**Refresh-token rotation with reuse detection.** The refresh token carries a `jti` that is stored in `refresh_tokens`. On refresh, the row is deleted in one statement; `affectedRows === 0` means the token was already used or revoked, which revokes every session for that user. Access tokens are never stored, so verification is a pure HMAC check with no database round trip.

**Ownership in the WHERE clause.** Every applications query is `WHERE id = ? AND user_id = ?`. Another user's row is indistinguishable from a missing one: both are 404. There is no `findById` without a user scope, so the check cannot be forgotten.

**Keyset over offset.** `WHERE (sort_col < ? OR (sort_col = ? AND id < ?)) ORDER BY sort_col, id LIMIT n+1`. Stable under inserts, served by the `(user_id, status, created_at, id)` index, and the extra row tells us whether a next page exists without a `COUNT`.

**Dynamic UPDATE with an allowlist.** The `SET` clause is built from an allowlist of column names; values still go through placeholders. Zod's `.strict()` rejects unknown keys before the request even reaches the repository.

**Best-effort audit log.** Writes to MongoDB are wrapped so a Mongo outage degrades the audit trail rather than failing the MySQL write. The opposite choice is correct when the log is a compliance requirement.

**Fail fast.** Invalid env, unreachable Mongo, or a bad JWT secret stops the process at startup with a clear message instead of failing on the first request.

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | nodemon with restarts |
| `npm start` | plain node |
| `npm run db:migrate` | apply `schema.sql` |

## Roadmap

Layer 2, in progress: inbound email webhook with HMAC verification, a MySQL-backed queue with `SELECT … FOR UPDATE` claiming, exponential back-off retries, and a replayable dead-letter table.
