// Лимит частоты с IP перед функцией (requirement «Частота запросов к Pages Functions», worker-limits).
// Middleware лежит в каталоге функции, а не в корне functions/: корневой сделал бы платным каждый запрос
// к статике сайта.
import {rateLimited} from '../../workers/guard/src/client';

export const onRequest = rateLimited;
