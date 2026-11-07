# Proposal

## Why

"nakarte" is the brand of the author, Sergey Orlov (nakarte.me). Our product is now separate, and the owner picked the name `trailroutine` on 2026-11-07 (`openspec/research/trailroutine.md`, «Name»). This change is step 1 of the plan: rename the code and the repo. The next steps are a custom domain, a redirect from the old address to the new domain, and `trailroutine.pages.dev` as a staging site.

## What Changes

- The app shows the name `trailroutine`: the page `<title>`, the `<title>` of `favicon.svg`, and the `creator` attribute of exported GPX files.
- The production check (`scripts/prod-check.sh`) and the e2e test look for the new page title.
- The GitHub repo `sergeycw/nakarte` becomes `sergeycw/trailroutine`. The `github.repository` condition in the six workflows that write to Cloudflare or R2 changes to `sergeycw/trailroutine`. GitHub redirects the old repo URL.
- Our own internal names that no data depends on get the new name: the Google Maps callback `__nakarteGoogleMapsReady`, the contour protocol `nakarte-contours`, the Vite plugin `nakarte-engine-files`, the package names of the root and `web/`, and the console warning of autosave.
- `README.md`, `AGENTS.md` and `openspec/backlog.md` use the new name and the new repo.
- These stay the same, and later changes move them:
  - production addresses and resources: `nakarte-routing.pages.dev`, the Workers `nakarte-*` on `nakarte-routing.workers.dev`, the R2 buckets, the Pages project `nakarte-routing` and the Sentry project.
  - local names: the folder of the checkout, the Docker container `nakarte-brouter` and the entries of `../.claude/launch.json`.
- These never change:
  - the browser keys that hold user data: IndexedDB `nakarte-web` and the localStorage keys `nakarte-web:*`. A new name would lose the tracks and settings of users.
  - references to the author's product: `nakarte.me`, `wladich/nakarte`, the parser of nakarte links (`m=`, `nktk=`, `nktl=`, the `Nakarte view` result) and `.github/FUNDING.yml`.
- `docs/architecture/` is out of scope. A parallel session translates it to English and applies the new name there.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `web-client`: the app opens with the title `trailroutine`.
- `clone-monitoring`: the production check looks for the title `trailroutine`, and the check runs only in `sergeycw/trailroutine`.
- `clone-deploy`: the deploy runs only from `master` of `sergeycw/trailroutine`. The text no longer calls the repo a fork.
- `tile-sync`: the sync runs only in `sergeycw/trailroutine`.

## Impact

- Code: `web/index.html`, `web/public/favicon.svg`, `web/src/tracks/export.ts`, `web/src/streetview/google.ts`, `web/src/layers/catalog.ts`, `web/src/autosave/autosave.ts`, `web/vite/engine-files.ts`, the tests and e2e tests that repeat these names, `scripts/prod-check.sh`, `package.json`, `package-lock.json`, `web/package.json` and `web/package-lock.json`.
- CI: the six workflows with `if: github.repository == 'sergeycw/nakarte'`. The repo rename must happen before the merge. Otherwise the deploy of the merge commit skips.
- Docs: `README.md`, `AGENTS.md`, `openspec/backlog.md` and four specs.
- Outside the repo: the GitHub repo name, the `origin` URL of local checkouts and `gh repo set-default`.
- Users: the tab title changes, and exported GPX files show `creator="trailroutine"`. Saved tracks, settings and old links keep working.
