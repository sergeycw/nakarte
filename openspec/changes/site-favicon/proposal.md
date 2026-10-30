# Proposal

## Why

У сайта старая иконка автора 16×16 (`web/public/favicon.ico`), и `index.html` на иконку не ссылается. Владелец (2026-10-30) прислал свою: синий скруглённый квадрат с белой извилистой тропой, и попросил сгладить картинку, убрать артефакты (ступеньки по краям тропы на растре 1024 px).

## What Changes

- Иконка сайта — векторная копия картинки владельца, `web/public/favicon.svg`: скруглённый квадрат `#3662a4` и белая тропа плавной кривой Безье вместо ступенчатого растра.
- `favicon.ico` (16, 32 и 48 px) для браузеров без SVG-иконок и `apple-touch-icon.png` (180 px, без скругления: iOS скругляет сам) — из того же SVG скриптом `scripts/favicon.mjs`.
- `web/index.html` ссылается на все три.

## Capabilities

### New Capabilities

### Modified Capabilities

- `web-client`: новое требование «Иконка сайта».

## Impact

- `web/public/favicon.svg`, `web/public/favicon.ico`, `web/public/apple-touch-icon.png`, `web/index.html`, `scripts/favicon.mjs`.
- Тесты: `web/e2e/web-client.spec.ts` («Иконка сайта»).
- Документы: `AGENTS.md` (карта репозитория, `scripts/`).
