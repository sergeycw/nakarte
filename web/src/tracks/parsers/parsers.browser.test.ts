import { describe } from 'vitest';
import { parserCases } from './cases';

// те же сценарии, что parsers.test.ts, но с DOMParser браузера
describe('парсеры в Chromium', parserCases);
