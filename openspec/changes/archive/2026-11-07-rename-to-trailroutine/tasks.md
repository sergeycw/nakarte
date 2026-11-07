# Tasks

## 1. Visible name

- [x] 1.1 Change the `<title>` in `web/index.html` and `web/public/favicon.svg` to `trailroutine`, and change `toHaveTitle` in `web/e2e/web-client.spec.ts`. Verify: the e2e scenario «Открыть приложение» is green after `npm run build && npm run e2e -- web-client`.
- [x] 1.2 Change the GPX `creator` in `web/src/tracks/export.ts` to `trailroutine`, and add an assertion on `creator="trailroutine"` to `web/src/tracks/export.test.ts`. Verify: `npm test -- src/tracks/export.test.ts` is green.
- [x] 1.3 Change the title check in `scripts/prod-check.sh` to `<title>trailroutine</title>`. Verify: against `vite preview` (`SITE=http://localhost:4173`) the `site` line prints `OK`.

## 2. Internal names

- [x] 2.1 Rename the Google Maps callback to `__trailroutineGoogleMapsReady` in `web/src/streetview/google.ts`, `web/src/streetview/google.test.ts` and `web/e2e/street-view.spec.ts`. Verify: the unit test and the e2e test `street-view` are green.
- [x] 2.2 Rename the contour protocol to `trailroutine-contours` in `web/src/layers/catalog.ts` and `web/src/layers/catalog.test.ts`, and in the «Слои и адрес» paragraph of `AGENTS.md`. Verify: `npm test -- src/layers` is green, and the browser tests with `Ct` are green.
- [x] 2.3 Rename the Vite plugin `nakarte-engine-files` in `web/vite/engine-files.ts`, the console warning prefix in `web/src/autosave/autosave.ts`, and the package names `nakarte` and `nakarte-web` to `trailroutine` and `trailroutine-web` in `package.json`, `package-lock.json`, `web/package.json` and `web/package-lock.json`. Verify: `npm ci` passes in the root and in `web/`, `npm run lint` passes in the root, and `npm run build` in `web/` passes.

## 3. Repo name in CI and docs

- [x] 3.1 Change `github.repository == 'sergeycw/nakarte'` to `'sergeycw/trailroutine'` in the six workflows (`brouter-tiles-sync.yml`, `deploy-pages.yml`, `elevation-data.yml`, `prod-check.yml`, `strava-heatmap-check.yml`, `tracestrack-check.yml`). Verify: `git grep "sergeycw/nakarte" -- .github` prints nothing.
- [x] 3.2 Apply the new name and the new repo in `README.md` (title, badge, links, docs list) and in `AGENTS.md`: the first heading, the brand mentions, the repo, the title in «Подвохи», and a note that the browser keys `nakarte-web` keep the old name on purpose. Keep the section headings of `AGENTS.md`, because `docs/architecture/` links to them. Verify: `git grep -n -E "nakarte routing|sergeycw/nakarte"` prints only `openspec/changes/archive/`, `openspec/research/` and `docs/architecture/`.
- [x] 3.3 Update the backlog entry «Новое название проекта»: code and repo are renamed in this change. The custom domain, the redirect from `nakarte-routing.pages.dev` and the staging project `trailroutine.pages.dev` are still open, with a link to the plan in `openspec/research/trailroutine.md`. In that plan, mark step 1 as done with a link to the archive. Verify: `openspec validate --all --strict` passes.

## 4. Integration

- [x] 4.1 Run all tests of `web/`: `npm test`, then `npm run build && npm run e2e`. Verify: both are green, and `git grep -n -i "nakarte" -- web/src web/e2e web/vite web/index.html web/public` shows only browser keys, production addresses and references to the author's product.

## Workflow follow-up

- Archive the change in the same PR.
- After all checks of the PR are green, rename the repo: `gh repo rename trailroutine -R sergeycw/nakarte --yes`. Then run `git remote set-url origin https://github.com/sergeycw/trailroutine.git` and `gh repo set-default sergeycw/trailroutine`.
- Compare the ruleset 26203316, the secrets, the variables and `allow_auto_merge` with the state before the rename.
- Merge the PR. Confirm that `deploy pages` ran the `pages` job and did not skip it, that `smoke` is green, and that `curl -s https://nakarte-routing.pages.dev/` contains `<title>trailroutine</title>`.
