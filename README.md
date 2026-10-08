[![check](https://github.com/sergeycw/nakarte/actions/workflows/main.yml/badge.svg)](https://github.com/sergeycw/nakarte/actions/workflows/main.yml)

# nakarte

Карта для походов с прокладкой маршрута по дорогам и тропам через [BRouter](https://github.com/abrensch/brouter). Публичная версия: https://nakarte-routing.pages.dev.

Вырос из форка [wladich/nakarte](https://github.com/wladich/nakarte) — кода сайта nakarte.me Сергея Орлова — и развивается как отдельный продукт. Лицензия MIT, текст — в [LICENSE](LICENSE).

## Запуск локально

Нужны Node, Yarn и Docker (BRouter работает в контейнере).

```bash
yarn
cp src/secrets.js.template src/secrets.js
yarn local
```

Карта откроется на http://localhost:8765. Тайлы для прокладки и всё остальное о разработке — в [AGENTS.md](AGENTS.md).

## Документация

- [AGENTS.md](AGENTS.md) — запуск, окружение, подвохи и карта репозитория.
- [openspec/](openspec/) — спеки поведения (`specs/`), планы и решения (`changes/`), бэклог (`backlog.md`).
