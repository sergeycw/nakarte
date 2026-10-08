# Хранилище треков: ссылка `nktl=`

Короткая ссылка на треки: в адресе только ключ, сами треки лежат в Worker'е `nakarte-tracks` ([workers/tracks](../../workers/tracks/)) в R2. Контракт повторяет авторский `tracks.nakarte.me`, поэтому клиент не менялся. Поведение — спека [track-storage](../../openspec/specs/track-storage/spec.md); решения — архив [add-track-storage](../../openspec/changes/archive/2026-10-07-add-track-storage/design.md).

## От «Copy link» до открытия

```mermaid
sequenceDiagram
    autonumber
    actor U as Пользователь
    participant TL as track-list
    participant W as nakarte-tracks
    participant R2 as R2 nakarte-tracks
    actor V as Получатель ссылки
    participant APP as nakarte у получателя

    U->>TL: Copy link
    TL->>TL: serializeTracks — строка nktk
    TL->>TL: key = base64url(md5(строка)), 22 символа
    TL->>U: адрес с #nktl=key в буфер обмена (сразу)
    TL->>W: POST /track/{key}, тело — строка nktk
    W->>W: Origin, частота, формат ключа, ≤ 10 МиБ
    W->>W: trackKey(тело) == key?
    W->>R2: head tracks/{key}
    alt объекта нет
        W->>R2: put tracks/{key}
    end
    W-->>TL: 200 (или 400, 403, 413, 429 → уведомление «Error making link»)
    U-->>V: передаёт ссылку
    V->>APP: открывает адрес с #nktl=key
    APP->>APP: hashState → track-list.hash-state → NakarteUrlLoader
    APP->>W: GET /track/{key}
    W->>R2: get tracks/{key}
    R2-->>W: строка nktk
    W-->>APP: 200 text/plain, Cache-Control immutable на год
    APP->>APP: parseNktkSequence → треки на карте
```

- Ссылка попадает в буфер обмена до ответа сервера: если `POST` не прошёл, пользователь увидит уведомление, но ссылка уже скопирована.
- Ключ — хеш содержимого, поэтому объект неизменяемый, а повторная запись не нужна. Worker считает ключ тем же `blueimp-md5`, что клиент ([key.js](../../workers/tracks/src/key.js)).
- Разметка маршрута в ссылку не попадает: только геометрия ([route-editor.md](route-editor.md)).
- Старые ссылки `nktl=` держатся на этом хранилище, это важно при переименовании Worker'ов — backlog, «Глобальное направление».

## Сверено по

[track-list.js](../../src/lib/leaflet.control.track-list/track-list.js) (`copyTracksLinkToClipboard`, `getLinkToShare`), [track-list.hash-state.js](../../src/lib/leaflet.control.track-list/track-list.hash-state.js), [services/nakarte/index.js](../../src/lib/leaflet.control.track-list/lib/services/nakarte/index.js) (`loadFromTextEncodedTrackId`), [workers/tracks/src/index.js](../../workers/tracks/src/index.js), [workers/tracks/src/key.js](../../workers/tracks/src/key.js), [workers/tracks/wrangler.toml](../../workers/tracks/wrangler.toml).
