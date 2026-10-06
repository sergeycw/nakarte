import config from '~/config';

const RUNTIME_LOADER_URL = 'https://cjrtnc.leaningtech.com/4.3/loader.js';
const BASE_DIR = '/app/brouter-wasm/';
const SEGMENT_DIR = `/app${config.routingTilesPath}`;
const PROFILE_DIR = `${BASE_DIR}profiles/`;
const CLASSPATH = ['lib/brouter-patch.jar', 'lib/brouter.jar', 'lib/wasm-router.jar']
    .map((path) => BASE_DIR + path)
    .join(':');

let routerPromise = null;
let startFailed = false;
let queue = Promise.resolve();

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = () => reject(new Error(`failed to load ${src}`));
        document.head.append(script);
    });
}

async function initRouter() {
    await loadScript(RUNTIME_LOADER_URL);
    await window.cheerpjInit({version: 11, status: 'none'});
    const lib = await window.cheerpjRunLibrary(CLASSPATH);
    return lib.WasmRouter;
}

function startEngine() {
    if (!routerPromise) {
        routerPromise = initRouter().then(
            (router) => {
                startFailed = false;
                return router;
            },
            (e) => {
                startFailed = true;
                routerPromise = null;
                throw e;
            }
        );
    }
    return routerPromise;
}

function isEngineFailed() {
    return startFailed;
}

async function javaErrorMessage(e) {
    try {
        return String(await e.getMessage());
    } catch {
        return String(e?.message ?? e);
    }
}

function enqueue(task) {
    const result = queue.then(task);
    queue = result.catch(() => null);
    return result;
}

function routeInEngine(router, query) {
    return enqueue(async () => {
        try {
            return await router.route(SEGMENT_DIR, PROFILE_DIR, query);
        } catch (e) {
            throw new Error(await javaErrorMessage(e));
        }
    });
}

export {startEngine, isEngineFailed, routeInEngine};
