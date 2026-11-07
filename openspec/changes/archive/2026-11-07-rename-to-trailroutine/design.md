# Design

## Context

The name "nakarte" has four different roles in the repo. Only the first one changes in this change (proposal.md, What Changes):

1. Our brand: the page title, the GPX `creator`, the repo name, the package names and internal identifiers.
2. Production resources: the Pages project `nakarte-routing`, the Workers `nakarte-*`, the subdomain `nakarte-routing.workers.dev` and the R2 buckets `nakarte-*`.
3. User data in the browser: the IndexedDB database `nakarte-web` and the localStorage keys `nakarte-web:*`.
4. The author's product: `nakarte.me`, `wladich/nakarte` and the nakarte link format (`m=`, `nktk=`, `nktl=`).

The deploy uses `wrangler pages deploy` (direct upload), so Cloudflare Pages has no link to the GitHub repo. Six workflows run their Cloudflare and R2 jobs only when `github.repository == 'sergeycw/nakarte'`.

## Goals / Non-Goals

**Goals:**

- Change every place where "nakarte" means our brand, except `docs/architecture/`.
- Keep every user-visible address, link and saved track working.
- Do not skip the deploy of the merge commit.

**Non-Goals:**

- Do not move production resources. The custom domain changes do that later.
- Do not rename the local folder, the Docker container `nakarte-brouter` or the entries of `../.claude/launch.json`. The owner does this when no session uses the folder.

## Decisions

### Display name `trailroutine`

The title is one lowercase word, `trailroutine`. This keeps the style of the old title `nakarte routing`. The alternative, `Trail Routine`, shows the pun better, but the owner wrote the name as one word. The title is in a small set of places (`web/index.html`, `web/public/favicon.svg`, `scripts/prod-check.sh`, the e2e test and the `web-client` spec), so a later change of style is easy.

### Browser keys keep the old name

A new IndexedDB name or a new localStorage key needs migration code: read the old key, write the new key, then delete the old key. This gives no visible result to the user. If the migration fails, the user loses tracks without an error. The keys are internal, so they stay `nakarte-web` and `nakarte-web:*`. `AGENTS.md` records why.

### Internal names without data get the new name

These names are not stored and do not leave the page: the Google Maps callback `__nakarteGoogleMapsReady`, the contour protocol `nakarte-contours`, the Vite plugin `nakarte-engine-files`, the package names and the console warning. A rename changes no behavior, and the tests that repeat these names change in the same commit.

### Own links are still recognized by format, not by host

`web/src/search/links.ts` treats a URL as a nakarte link when the host contains the word `nakarte` or when `m=` parses. Our host is still `nakarte-routing.pages.dev`, so this change does not touch this check. A URL on the future custom domain with a valid `m=` parses as a nakarte link already. The custom domain change can add the new host for links with a broken `m=`.

### Rename the repo after CI passes and before the merge

The merge commit contains the new condition `github.repository == 'sergeycw/trailroutine'`. If the repo still has the old name at the merge, the deploy of the merge commit skips. If the repo gets the new name before the PR is green, the old condition on `master` skips the scheduled jobs for longer.

The order is: CI is green, then rename the repo, then merge. The scheduled jobs skip only for the few minutes between the rename and the merge.

The alternative is a transition condition that accepts both names. It needs a second change to remove it later, and it adds a step that someone can forget.

### Modified specs keep Russian

The four modified requirements stay in Russian (`openspec/config.yaml`: a modified Russian requirement keeps its language). The scenario names do not change, so the test names do not change.

## Risks / Trade-offs

- [GitHub redirects the old repo URL only while no new repo `sergeycw/nakarte` exists.] → Do not create a repo with the old name. Update the `origin` URL and `gh repo set-default` in the local checkout.
- [A session in another worktree pushes to the old URL.] → GitHub redirects git pushes too. The brief of the parallel session tells it to use `sergeycw/trailroutine` if the old name fails.
- [The ruleset, the secrets, the variables or auto-merge do not survive the rename.] → After the rename, compare them with the state before the rename (the commands are in tasks.md).
- [The `smoke` job after the deploy sees the old title for a short time.] → `prod-check.yml` already waits 60 s (`settle_seconds`). If `smoke` fails only on the title and the site already shows `trailroutine`, rerun the failed jobs (`AGENTS.md`, «Подвохи клона»).
- [GPX readers show `creator="trailroutine"` instead of `nakarte-routing`.] → No reader that we know depends on this value. Our own parsers ignore `creator`.

## Migration Plan

1. Implement the tasks on branch `rename-to-trailroutine`, push and open a PR to `master`.
2. Wait until all checks of the PR are green.
3. Rename the repo: `gh repo rename trailroutine -R sergeycw/nakarte --yes`. Update `origin` and `gh repo set-default`.
4. Compare the ruleset, the secrets, the variables and auto-merge with the state before the rename.
5. Merge the PR. Confirm that `deploy pages` ran its jobs and did not skip them, and that `smoke` passed.

Rollback: rename the repo back to `nakarte` and revert the merge commit.
