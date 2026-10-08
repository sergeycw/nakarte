# Design

## Context

[Version URL](https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/) (раньше preview URLs) создаются на каждую версию Worker'а. Без явной настройки Wrangler 4.44+ включает их так же, как `workers.dev`; у наших Worker'ов в Cloudflare API `previews_enabled: true`. Каждая версия работает со своим кодом и конфигом, то есть со своими `[limits]` и счётчиками частоты.

## Goals / Non-Goals

**Goals:** старые версии недоступны снаружи, лимиты новой версии нельзя обойти.

**Non-Goals:** старые деплои Pages (`<хеш>.nakarte-routing.pages.dev`) — у Pages нет такой настройки, их удаляет `limit-pages-functions`.

## Decisions

- Настройка в `wrangler.toml` (`preview_urls = false`), а не в дашборде: конфиг в репозитории, деплой его применяет, и следующий деплой не вернёт старое значение. По документации «Disabling Version URLs disables routing to Version URLs and aliased Version URLs» — для всех версий сразу, а не только для новой.
- Тестов в `workerd` нет: это настройка маршрутизации платформы. `wrangler deploy --dry-run` проверяет конфиг, прод — запрос к Version URL старой версии после деплоя.

## Risks / Trade-offs

- [Version URL понадобятся для проверки версии до выката] → сейчас ими никто не пользуется: деплой — `wrangler deploy` сразу в прод. Включить обратно можно одной строкой.

## Результат

2026-10-08, после деплоя (`deploy pages` 37774510941): Version URL старых версий — `887323ef-nakarte-elevation`, `c4a10e46-nakarte-cors-proxy`, `eac2b934-nakarte-tracks` — отвечают `404` (до деплоя `887323ef` отвечал `200`); Cloudflare API — `previews_enabled: false` у всех трёх; `scripts/prod-check.sh` — 9 из 9.
