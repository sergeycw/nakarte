[![check](https://github.com/sergeycw/nakarte/actions/workflows/main.yml/badge.svg)](https://github.com/sergeycw/nakarte/actions/workflows/main.yml)

# nakarte

A hiking map that routes tracks along roads and trails with [BRouter](https://github.com/abrensch/brouter). Public version: https://nakarte-routing.pages.dev.

It started as a fork of [wladich/nakarte](https://github.com/wladich/nakarte), the code of nakarte.me by Sergey Orlov, and is developed as a separate product. MIT license, see [LICENSE](LICENSE).

## Run locally

You need Node, Yarn and Docker (BRouter runs in a container).

```bash
yarn
cp src/secrets.js.template src/secrets.js
yarn local
```

The map opens at http://localhost:8765. Routing tiles and everything else about development are in [AGENTS.md](AGENTS.md).

## Docs

- [AGENTS.md](AGENTS.md): setup, environment, pitfalls and a map of the repository (in Russian).
- [docs/architecture/](docs/architecture/README.md): architecture diagrams from the system context down to each area, and a registry of technical decisions (in Russian).
- [openspec/](openspec/): behaviour specs (`specs/`), plans and decisions (`changes/`), backlog (`backlog.md`).
