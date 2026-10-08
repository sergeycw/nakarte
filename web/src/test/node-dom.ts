import { onErrorStopParsing, DOMParser as XmlDomParser } from '@xmldom/xmldom';

// DOMParser для unit-тестов в Node: парсеры треков разбирают XML браузерным DOMParser (design add-web-tracks,
// «Парсеры»). xmldom по умолчанию продолжает разбор после ошибки, а браузер даёт документ с <parsererror>, поэтому
// здесь ошибка останавливает разбор исключением — parseXml в обоих случаях отвечает null. Расхождения с браузером
// ловит parsers.browser.test.ts на тех же фикстурах.
class NodeDomParser {
    parseFromString(text: string, type: string) {
        return new XmlDomParser({ onError: onErrorStopParsing }).parseFromString(text, type as 'text/xml');
    }
}

globalThis.DOMParser ??= NodeDomParser as unknown as typeof DOMParser;
