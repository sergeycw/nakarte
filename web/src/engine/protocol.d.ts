// Сообщения между engine.ts и воркером движка — глобальные типы, а не модуль: воркер классический, и
// даже `import type` заставляет Vite в dev дописать в него `export {}` (engine.worker.ts).
// Запросы маршрута идут по одному (очередь в engine.ts); id — чтобы ответ не перепутался с чужим.
declare namespace EngineProtocol {
    // Пути движка. `/app/` CheerpJ — корень origin страницы (не каталог /next/): `/app/brouter-wasm/lib/x.jar`
    // читается как GET /brouter-wasm/lib/x.jar Range-запросами (AGENTS.md, «Движок в браузере (CheerpJ)»).
    interface Paths {
        runtimeUrl: string;
        classpath: string;
        segmentDir: string;
        profileDir: string;
    }

    type ToWorker = { type: 'start'; paths: Paths } | { type: 'route'; id: number; query: string };

    type FromWorker =
        | { type: 'started' }
        | { type: 'start-failed'; message: string }
        | { type: 'routed'; id: number; geojson: string }
        | { type: 'route-failed'; id: number; message: string };
}
