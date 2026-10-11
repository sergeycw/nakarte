# Tasks

## 1. Раскраска профиля

- [x] 1.1 Участки крутизны и ступени (`slopeSections`, `sectionLength`, `slopeClass`, `sectionAt`, `SLOPE_STEPS`, `SLOPE_CLASSES`), удаление `slopeAt` (`elevation/profile.ts`); unit «Участки разной крутизны», «Короткий хвост участка», разрывы и ступень по округлённому проценту (`profile.test.ts`); проверка: unit `profile.test.ts` зелёный
- [x] 1.2 Заливка по участкам, линия над ней, выделение приглушает остальное (`ProfileGraph.tsx`), уклон участка у курсора и метки (`format.ts`), легенда в строке атрибуции (`ElevationProfile.tsx`); browser «Участки разной крутизны» и «Уклон у курсора» (`ElevationProfile.browser.test.tsx`); проверка: browser `ElevationProfile` зелёный
- [x] 1.3 Полный прогон; проверка: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build && npm run e2e` в `web/` зелёные (CI — `check-web.yml`)

## 2. Документы

- [x] 2.1 `AGENTS.md` (абзац «Профиль высот»: участки и легенда), `openspec/backlog.md` (пункт раскраски — при archive; сводка в процентах — в отложенное); проверка: скрипт ссылок — все файлы и разделы существуют, `openspec validate --all --strict`

## 3. Ревью, PR, прод

- [x] 3.1 Независимое ревью диффа субагентом, исправления; итог — в design
- [x] 3.2 Скриншоты компьютера (1280×800), Pixel 7 и Pixel 7 landscape владельцу до merge: профиль трека с подъёмами и спусками, легенда, выделение участка; проверка: кадры отправлены
- [x] 3.3 Прод после `compact-all-layers`: итог — в design, раздел «Проверки»

## Workflow follow-up

- Archive в том же PR, до merge; ссылки после archive скриптом.
- PR в `master`, все проверки `pass` на последнем коммите, merge.
- После деплоя: `prod check`, вид `/` на компьютере и телефоне; итог — в design следующего change.
