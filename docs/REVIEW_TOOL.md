# Native-speaker lesson review tool (2026-09-28)

**Why:** thousands of AI-drafted lessons (MiniMax-M3) are live as beta across the 14 language
families. Every one of them carries:

```json
"aiDraft": { "generatedBy": "…", "generatedAt": "…", "modelVersion": "MiniMax-M3",
             "requiresReview": true, "reviewedBy": null, "reviewedAt": null },
"releaseStage": "beta"
```

Spot checks found wrong grammar concepts and some junk vocabulary. The languages that most need a
native reviewer are Hausa, Yoruba, Zulu, Amharic, Telugu and Tamil. This tool lets native speakers
review those lessons and feeds their verdicts back into the source lessons.

It follows the admin direction in [ADMIN_AUDIT_2026_09_28.md](ADMIN_AUDIT_2026_09_28.md): a
product-domain tool behind forge-auth, with authorisation on the server and data only through the
API.

## How the parts fit

```
reviewer ──> review app (lq-core apps/review, review.quest.blueforge.studio)
               │  credentials: include (forge-auth cookie on .blueforge.studio)
               ▼
            platform-api /api/review/*   (lq-core services/platform-api/src/review)
               │  reads the live published lessons, server-side and cached
               │    https://<family>.lang-quest.blueforge.studio/data/lessons/<locale>/<lang>/chapters/…
               │  writes the verdicts to Postgres: lesson_reviews (append-only), reviewers
               ▼
            GET /api/review/export  <── lq-tools scripts/apply-lesson-reviews.ts (operator)
                                          │  stamps aiDraft.reviewedBy/At and clears releaseStage
                                          │  in the SOURCE lessons (languages/<lang>/data/<locale>/lessons)
                                          ▼
                                       generate-lesson-files → PR per app → deploy
```

| Part | Where | PR |
|---|---|---|
| API + migration `0003_lesson_reviews` | lq-core `services/platform-api/src/review`, `libs/infra/database/drizzle/0003_lesson_reviews.sql` | lq-core#110 |
| Review UI | lq-core `apps/review` | lq-core#111 |
| Apply step | lq-tools `scripts/apply-lesson-reviews.ts` | lq-tools#46 (merged) |

### Key rules

- **The latest verdict wins.** `lesson_reviews` is append-only. For each
  `(app, lang, locale, chapter, lesson)`, the newest row is the lesson's verdict. A later "needs
  changes" withdraws an earlier approve.
- **Verdicts are bound to content.** `content_hash` is the sha256 of the canonical JSON (keys sorted
  recursively, no whitespace) of `lesson.content` as the reviewer saw it. We hash `content` only,
  because the published and source files differ in metadata (title, xp) but not in content.
  - If the live lesson changes while the reviewer has it open, the submit returns 409 and the UI asks
    them to reload.
  - If the source lesson changes after the review, the apply step reports it as **stale** and does
    not apply it.
- **The queue is every lesson with `aiDraft` and no `aiDraft.reviewedAt`.** It is built from each
  app's published `chapters/chapters.json` plus its lesson files. Each lesson is shown in one of
  these states:

  | State | Meaning |
  |---|---|
  | pending | no verdict yet |
  | approved | approved |
  | needs_changes | the reviewer asked for changes |
  | rejected | the reviewer rejected it |
  | stale | there is a verdict, but for content that has changed since |

  - We chose the live tree over a manifest because it is exactly what learners see and it needs no
    new build step.
  - The cost is about 200 small static fetches per language on a cold cache, cached for 10 minutes.

## For reviewers

1. Open **https://review.quest.blueforge.studio** and sign in with your BlueForge account (Google).
2. **First time:** the app says you are not a reviewer yet and shows your **user id**. Send that id
   to a LearnQuest admin, along with the languages you are a native speaker of.
3. Pick a language, then work through the **queue**. You can filter it by chapter, lesson type and
   status. The bar at the top shows your progress.
4. Each lesson opens as a readable view with an editor next to it:
   - **Approve:** the lesson is correct as written.
   - **Needs changes:** something is wrong, but you would rather describe it than fix it. A comment
     is required, for example "ch3 concept: the plural rule is wrong; Hausa plurals are not formed
     with -s".
   - **Reject:** the lesson is unusable, for example because it is in the wrong language or is junk.
     A comment is required.
   - **Save corrections + approve:** fix it in the editor, then approve your corrected version.
     - The structured fields cover vocab items, sections, examples, dialogue lines, exercises and
       questions.
     - Raw JSON editing is the fallback for anything else.
     - This button is enabled only once you have changed something. While you have unsaved
       corrections, plain Approve is disabled: save them, or use Reset.
5. **Keyboard:** `a` approve, `n` needs changes (jumps to the comment box), `j` / `k` next /
   previous lesson, `e` toggles the structured and raw editors, `?` shows help. The shortcuts are
   ignored while you are typing in a field.

What to look for:

- Is the target-language text actually in that language, and is it natural?
- Is the pronunciation guide right?
- Is the meaning or translation right?
- Is the grammar explanation true?
- Are the example sentences correct?
- Are there placeholder texts ("Mock …") or English where the target language should be?
- Is anything culturally off?

## For admins

The first admins come from the environment: `REVIEW_ADMIN_USER_IDS` on platform-api (forge-auth
user ids, comma-separated). After that, admins can be managed through the API (an admin screen can
come later, in the LearnQuest Admin app, A3):

```bash
# a signed-in admin's cookie, or run from the browser devtools of review.quest.blueforge.studio
curl -X PUT https://api.quest.blueforge.studio/api/review/reviewers/<userId> \
  -H 'Content-Type: application/json' --cookie '<forge-auth session cookie>' \
  -d '{"languages":["hausa","yoruba"],"role":"reviewer","display":"Amina B."}'

curl https://api.quest.blueforge.studio/api/review/reviewers --cookie '…'           # list
curl -X DELETE https://api.quest.blueforge.studio/api/review/reviewers/<userId> --cookie '…'
```

- **Languages** are language slugs as in the lesson paths (`hausa`, `scottish-gaelic`).
  - A slug that exists in two families (`romanian` is in balkan and romance) covers both.
  - `role: "admin"` gives every language, plus export and reviewer management.
- **Fallback:** as a last resort, an operator can write the row directly with SQL:
  `INSERT INTO reviewers (user_id, languages, role) VALUES ('<id>', ARRAY['hausa'], 'reviewer')`.

### Applying reviews (operator, per app)

```bash
cd lq-tools
REVIEW_SERVICE_KEY=… tsx scripts/apply-lesson-reviews.ts \
  --api=https://api.quest.blueforge.studio --app=../lq-african [--since=2026-10-01T00:00:00Z] [--lang=hausa] --dry-run
# then without --dry-run
```

1. **What each approved verdict does:**
   - If `editedContent` is present, it replaces `lesson.content`.
   - It stamps `aiDraft.reviewedBy`/`reviewedAt`.
   - It deletes `releaseStage`, which is the same as `mark-release --reviewed`.
2. **What is reported but not applied:** `stale` (the source changed since the review),
   `missing`, `already-reviewed` and `not-ai-draft`. Re-queue stale lessons by republishing them; they
   then appear as **stale** in the queue for a fresh review.
3. Then, in the app:
   1. Run `generate-lesson-files` (the public tree).
   2. Run `validate-content-shape` and the unit tests.
   3. Open a PR, merge it and deploy.
4. After deploy, `lessonRelease()` in lq-core (`@learnquest/app-config/release`) treats the lesson as
   released: the Beta badge is gone, and it drops out of the review queue.

"Needs changes" and "rejected" verdicts are **not** exported. Triage them from the queue
(`status=needs_changes` / `rejected`). Fix them with the generator or by hand, republish, and the
lesson comes back for review as stale.

## Deploy / migrate checklist (coordinator)

None of these steps have been run. They are in dependency order.

1. **Review and merge lq-core#110** (API + migration) and **lq-core#111** (review app). Merging is safe on its own: the routes are
   not mounted until step 4.
2. **Apply migration 0003 to the shared LearnQuest Postgres** (`blueforge-shared`). The migration
   uses `IF NOT EXISTS` and is additive only: two new tables, no changes to existing ones.
   - The standard runner is `DATABASE_URL=… pnpm --filter @learnquest/database db:migrate`, which
     uses drizzle's journal and applies the pending migrations only.
   - First confirm `drizzle.__drizzle_migrations` shows 0000–0002 applied. If production was
     bootstrapped by hand (see `docs/runbooks/apply-0007-households.md`), apply the file directly
     with `psql "$DATABASE_URL" -f libs/infra/database/drizzle/0003_lesson_reviews.sql` instead.
   - Verify with `\d lesson_reviews` and `\d reviewers`.
3. **Mint secrets:**
   - `REVIEW_SERVICE_KEY`: 32 or more random characters, for example `openssl rand -hex 32`.
   - Store it in the vault as `forge env set learnquest-core REVIEW_SERVICE_KEY <value>`, and in the
     operator keychain for lq-tools.
   - Never paste it into chat.
4. **Set platform-api env** (`forge env set learnquest-core <KEY> <value>`):
   - `REVIEW_TOOL_ENABLED=true`
   - `REVIEW_ADMIN_USER_IDS=<operator's forge-auth user id>`
   - `REVIEW_ALLOWED_ORIGINS=https://review.quest.blueforge.studio`
   - `FORGE_AUTH_URL=https://auth.blueforge.studio`, only if that default is wrong.
   - `REVIEW_SERVICE_KEY` from step 3.
5. **Redeploy platform-api:** `forge app-deploy platform-api --server --no-dns` from lq-core main.
   - Verify that `curl -i https://api.quest.blueforge.studio/api/review/me` returns **401**
     `UNAUTHENTICATED`. A 404 means the route is not mounted.
   - The boot log should show `[review] enabled — …`.
6. **forge-auth trusted origin** (a forge-auth PR; not changed here):
   - Add `https://review.quest.blueforge.studio` to `src/lib/trusted-origins.ts` and to
     `BETTER_AUTH_TRUSTED_ORIGINS`.
   - Without it, Google sign-in from the review app fails the Origin check.
   - Also confirm that the session cookie is `SameSite=Lax` and scoped to `.blueforge.studio`
     (`crossSubDomainCookies`). The browser only sends it cross-origin to `api.quest…` because both
     hosts are same-site.
7. **Deploy the review app** (lq-core `apps/review`, a static Vite SPA):
   - Add it to lq-core `blueforge.config.json` with domain `review.quest.blueforge.studio`.
   - Build env: `VITE_REVIEW_API_URL=https://api.quest.blueforge.studio`,
     `VITE_AUTH_URL=https://auth.blueforge.studio`.
   - Add the DNS record.
   - Mind the workspace-mode deploy hazard in lq-core's CLAUDE.md: every app in `apps` gets bundled.
8. **Smoke test:**
   1. Sign in, then read your user id from the "not a reviewer yet" screen.
   2. Add yourself or a test reviewer (`PUT /api/review/reviewers/<id>`).
   3. Open the african/hausa queue. It should list only lessons with `aiDraft` set.
   4. Approve one lesson.
   5. Run `apply-lesson-reviews --dry-run` against lq-african. It should report 1 applied.
9. **Onboard the first reviewers:** native speakers of Hausa, Yoruba, Zulu, Amharic, Telugu and Tamil
   first.

## Security notes

- **Authorisation** is enforced only on the server. The UI hides languages the reviewer cannot
  access, but the API refuses them regardless (403 `LANGUAGE_FORBIDDEN`).
- **Identities:**
  - Anonymous (guest) forge-auth sessions are refused.
  - The service key opens `/export` only.
- **CORS:** credentialed CORS is allowed only for `REVIEW_ALLOWED_ORIGINS`.
- **Outbound fetches:** the server fetches only from the 14 family hosts. Every path segment must
  match `^[a-z0-9][a-z0-9-]{0,63}$`. A non-JSON body (the SPA fallback returns 200 with HTML) counts
  as "not found".
- **Limits on edited content:** 256 KB, accepted only with an approve, and it never reaches learners
  without the operator's apply-and-PR step.
