# Daily routine: web review first, then one iOS step

One scheduled run per day. Production stays healthy first; the iOS work advances
one small, reviewed step at a time, following [`PROGRESS.md`](PROGRESS.md).

## Environment limits (be honest about them)
- The routine runs on Linux. It **cannot** run Xcode or the iOS Simulator. Mobile code is verified with typecheck, lint, jest-expo unit tests, and — for layout sanity — `expo export --platform web` plus Playwright screenshots. Real-device behavior is verified by the owner via TestFlight.
- EAS cloud builds, Apple, and Google configuration need the owner's accounts. Those steps are `blocked-owner`.
- Never use production user data. Staging/test accounts only.

## Each run

### Phase 1 — Web health (always first)
1. Read `CLAUDE.md`, the last `docs/QUALITY_LOG.md` entry, open PRs, and recent commits on `main`.
2. Run `npm ci`, `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`.
3. Review recently changed code and core flows (auth, upload, analysis, reminders, dashboard, settings) for real defects. Fix small, safe ones with a regression test.
4. Classify findings P0–P4. **If any P0/P1 is open, fix it and stop — do not advance a mobile step this run.**
5. Append a concise entry to `docs/QUALITY_LOG.md`.

### Phase 2 — One iOS step
1. Open `docs/mobile/PROGRESS.md`. Choose the first `todo` step whose `Needs` are all merged/done and that isn't blocked.
2. If more than 2 mobile PRs are open, or nothing is eligible, skip Phase 2 and say exactly what it is waiting on.
3. Do that **one** step on the session's designated branch. Keep it small. Follow the guardrails in `PLAN.md` §5 and `CLAUDE.md`.
4. Run all gates (web gates always; mobile gates once `mobile/` exists). The web gates must still pass.
5. Update `PROGRESS.md` (status, PR number, run-log line). Open one PR against `main` following the PR template. Never merge it. Never push to `main`.
6. If the step needs a decision or an owner action, mark it `blocked-owner` / `blocked-decision`, write precisely what is needed, and do not guess. Move to the next eligible step only if it is independent.

### Phase 3 — Report (always)
Send one notification (it becomes the owner's email) with:
- **Status:** Healthy / Improved / Attention needed / Blocked
- Web: gates result, anything found/fixed
- iOS: step done (or why none), PR link, next step
- **Owner attention:** the exact action needed, or "No action required today."
- Release readiness only when true: `READY FOR OWNER REVIEW` / `MOBILE FOUNDATION READY` per the original criteria.

No secrets, credentials, user data, or contract content in any notification.

## Stop conditions (notify immediately, do nothing risky)
- Any P0 (security / data loss / app down), or CI red on `main`.
- A step would require weakening RLS, shipping a service-role key to a client, or editing an applied migration.
- A migration, `vercel.json`, or workflow change is needed: do it only in its own clearly labeled PR and call it out.
- Two consecutive runs blocked on the same owner action: say so plainly in the email.

## Schedule prompt (paste into the routine's prompt)

> You are Clausly's daily engineer. Repository: EGKIP/Clausly. Follow `docs/mobile/ROUTINE.md` exactly: Phase 1 web health review (fix real defects, log to `docs/QUALITY_LOG.md`), then Phase 2 advance exactly one eligible step from `docs/mobile/PROGRESS.md` on your designated branch and open one PR against `main` (never merge, never push to `main`), then Phase 3 send the concise owner report via notification. Do not weaken RLS or expose secrets. If a P0/P1 web issue is open, fix it and do not advance mobile. If blocked on the owner, say exactly what is needed.
