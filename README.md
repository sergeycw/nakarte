[![check web](https://github.com/sergeycw/nakarte/actions/workflows/check-web.yml/badge.svg)](https://github.com/sergeycw/nakarte/actions/workflows/check-web.yml)

# nakarte

A hiking map that routes tracks along roads and trails with [BRouter](https://github.com/abrensch/brouter). Public version: https://nakarte-routing.pages.dev.

It started as a fork of [wladich/nakarte](https://github.com/wladich/nakarte), the code of nakarte.me by Sergey Orlov, and is developed as a separate product: the app in [web/](web/) is a rewrite on React and MapLibre that reads the old links. MIT license, see [LICENSE](LICENSE).

## Run locally

You need Node 22.12+ and Docker (BRouter runs in a container).

```bash
docker compose up -d
cd web
npm ci
npm run dev
```

The map opens at http://localhost:8769. Routing tiles and everything else about development are in [AGENTS.md](AGENTS.md).

## Docs

- [AGENTS.md](AGENTS.md): setup, environment, pitfalls and a map of the repository (in Russian).
- [docs/architecture/](docs/architecture/README.md): architecture diagrams from the system context down to each area, and a registry of technical decisions (in Russian).
- [openspec/](openspec/): behaviour specs (`specs/`), plans and decisions (`changes/`), backlog (`backlog.md`).
