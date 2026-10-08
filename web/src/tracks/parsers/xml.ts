// Разбор XML для GPX и KML — DOMParser браузера (в unit-тестах Node — @xmldom/xmldom, src/test/node-dom.ts).

export function parseXml(text: string): Document | null {
    // Префиксы имён тегов → `prefix_name`, как в старом клиенте: файлы сервисов бывают с префиксами без объявления
    // xmlns (gpxx:, gx:), и строгий разбор XML на них падает. Искать после этого — `gx_Track`, а не `gx:Track`.
    const unprefixed = text.replace(/<([^ >]+):([^ >]+)/gu, '<$1_$2');
    let dom: Document;
    try {
        dom = new DOMParser().parseFromString(unprefixed, 'text/xml');
    } catch {
        return null;
    }
    // браузер не бросает, а вставляет <parsererror> (Firefox — корнем, Chromium — внутрь документа)
    if (!dom.documentElement || dom.getElementsByTagName('parsererror').length > 0) {
        return null;
    }
    return dom;
}

export function elements(parent: Document | Element, tag: string): Element[] {
    return Array.from(parent.getElementsByTagName(tag));
}

// Текст узла без вложенных элементов (xmlGetNodeText старого клиента): текст и CDATA прямых потомков
export function nodeText(node: Element | undefined): string | null {
    if (!node) {
        return null;
    }
    return Array.from(node.childNodes)
        .map((child) => child.nodeValue ?? '')
        .join('');
}
