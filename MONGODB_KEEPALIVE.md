# DoxChat AI: MongoDB M0 inactivity prevention

Research checked: October 1, 2026.

## What actually pauses

MongoDB currently documents automatic pausing of Free/M0 clusters after **30 days
with zero connections**. Its Free tier limits also say the cluster API cannot
modify Free clusters. Do not assume a generic `paused: false` API example for
dedicated clusters works on M0. [Atlas Free cluster limits](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/)

Monitoring can stop earlier without the database being fully paused. Connecting
resumes monitoring. A fully paused cluster refuses connections until it is resumed;
a ping cannot restart it. Resume an already-paused cluster through Atlas once before
enabling this job. Very old paused deployments can require a data restoration
instead. [Atlas pause/resume documentation](https://www.mongodb.com/docs/atlas/pause-terminate-cluster/)

Render Free has a separate behavior: the web service sleeps after 15 minutes
without inbound traffic and wakes on a subsequent request. This job does not
prevent that sleep. [Render Free documentation](https://render.com/docs/free)

## Implemented flow

```text
Vercel daily schedule
  -> GET /api/cron/mongodb-keepalive with Authorization: Bearer <CRON_SECRET>
  -> Validate the secret before touching the database
  -> Open a fresh connection to the configured MongoDB cluster
  -> Execute { ping: 1 }, then close the connection
  -> Retry once on failure; return 200 on success or 503 on failure
```

A successful daily connection should prevent the documented zero-connection
inactivity condition. This is prevention, not an automatic cluster resumer or an
uptime guarantee. It continues independently of your laptop and Render process.
No documents are read or written, and no AI API calls are made.

## Activate it

1. In the Vercel project serving `rag-based-doc-scanner.vercel.app`, confirm that
   the project root is `client` and the Node.js runtime is 22.x or 24.x.
2. Add these environment variables to the **Production** environment:

   | Variable | Value and purpose |
   | --- | --- |
   | `MONGODB_URI` | Connection string for the same Atlas cluster as the backend. Used only by the server-side function. A separate database user with minimal permissions is preferable. |
   | `CRON_SECRET` | A random secret of at least 32 characters that authorizes scheduled requests. Generate it with a password manager or `openssl rand -hex 32`. |

   Neither variable must have a `VITE_` prefix. Those prefixes expose values to
   browser code. Keep `VITE_API_URL` pointing to the Render API as before.
3. Ensure Atlas Network Access permits connections from this Vercel deployment.
   A successful local or Render connection does not prove Vercel is permitted.
   If access is restricted to Render IPs, configure suitable permitted egress
   before relying on this job. Do not blindly replace a restrictive access list
   with `0.0.0.0/0`.
4. Deploy these changes to **production**. Merely editing the local files or
   deploying a preview does not activate the production schedule.
5. Open Vercel **Settings -> Cron Jobs**, confirm the path above, and use **Run**.
   Verify the invocation returns HTTP 200, `success: true`, and a current
   timestamp in its response; logs should say `MongoDB keepalive succeeded.`
6. Check the next scheduled invocation too. Keep Atlas inactivity emails enabled
   and investigate any warning; repeated failures must not go unnoticed.

Vercel automatically sends `CRON_SECRET` as a Bearer authorization header. The
function still validates it itself. Failed cron invocations are not retried by
Vercel, which is why this function makes a second attempt.
[Vercel cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs)

The configured expression is `17 4 * * *` (daily at 04:17 UTC / 09:47 IST).
Hobby allows a daily job, but execution can occur within its scheduled hour, so
do not depend on the exact minute. Function usage limits still apply.
[Vercel cron pricing and limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)

## Files and verification

| File | Purpose |
| --- | --- |
| `client/api/cron/mongodb-keepalive.js` | Authenticated server-side function; fresh MongoDB connection, ping, cleanup, one retry, bounded driver timeouts, and generic error messages. |
| `client/vercel.json` | Daily schedule, 60-second function limit, and SPA fallback that excludes `/api` so the cron reaches the function. |
| `client/package.json` / `client/package-lock.json` | MongoDB Node driver dependency and Node test command. The driver is imported only by the server-side function. |
| `client/tests/mongodbKeepalive.test.js` | Offline tests for authentication, configuration, retries, cleanup, errors, and route configuration. |
| `.env.example` | Documents the server-only Vercel variables without storing credentials. |

Run `npm test` and `npm run build` from `client` to check the code locally. The
existing Vite dev proxy sends `/api` to Express; it does not serve this Vercel
function. A production invocation must be checked on Vercel.

Opening the cron URL in an ordinary browser should return **401 Unauthorized**,
not the React page. A 401 alone proves routing/authentication, not database access.
A 503 means configuration, connectivity, credentials, or cluster state needs
attention. The ordinary Express `/api/health` only checks the process and is not
proof of database connectivity.

## Why this scheduler

The frontend already uses Vercel, which supports functions in a Vite project's
`api` directory. No extra scheduler account is necessary.
[Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite)

A timer inside Render cannot execute while Render sleeps. GitHub Actions also
has a relevant inactivity limitation: scheduled workflows in public repositories
can be disabled after 60 days without repository activity.
[GitHub scheduled workflow limits](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows)

## Verification status

- All nine offline tests passed and the Vite production build succeeded.
- The actual keepalive handler returned HTTP 200 and `success: true` against the
  cluster configured in `server/.env` on October 1, 2026. This ran from this machine
  and does not verify Vercel network access.
- Production activation is pending: this workspace has no authenticated Vercel
  CLI/project link. No production variables or deployment were changed.
