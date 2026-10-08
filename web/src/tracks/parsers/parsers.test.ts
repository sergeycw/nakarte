import { describe } from 'vitest';
import { parserCases } from './cases';

// DOMParser — xmldom (src/test/node-dom.ts); те же сценарии в Chromium — parsers.browser.test.ts
describe('парсеры в Node', parserCases);
