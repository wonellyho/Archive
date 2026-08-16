/**
 * Pin notes are authored in a contenteditable, so their stored content is HTML.
 * That HTML is rendered back with `dangerouslySetInnerHTML`, which makes
 * sanitising it a requirement rather than a precaution — boards are already
 * viewable at `/u/:username`, so the moment pins reach a server, one person's
 * stored markup is rendered on another person's page.
 *
 * The rule here is an allowlist, not a blocklist: only these tags survive, and
 * of all their attributes only a handful of typographic style properties. No
 * href, no src, no event handlers, no classes, no ids.
 */

const ALLOWED_TAGS = new Set([
  "B",
  "STRONG",
  "I",
  "EM",
  "U",
  "SPAN",
  "DIV",
  "P",
  "BR",
]);

/** Elements whose text content is not worth keeping if the tag is dropped. */
const DISCARD_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "LINK",
  "META",
  "TEMPLATE",
  "NOSCRIPT",
]);

const ALLOWED_STYLES = [
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "text-decoration",
  "text-align",
];

/** Values that can reach out of the page even from inside a style property. */
const UNSAFE_VALUE = /url\s*\(|expression|javascript:|@import|<\/?/i;

export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const clean = doc.createElement("body");
  copyClean(doc.body, clean, doc);
  return clean.innerHTML;
}

function copyClean(from: Node, to: Node, doc: Document): void {
  from.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      to.appendChild(doc.createTextNode(child.nodeValue ?? ""));
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;

    const el = child as HTMLElement;
    if (DISCARD_TAGS.has(el.tagName)) return;
    if (!ALLOWED_TAGS.has(el.tagName)) {
      // Unknown wrapper: keep the words, throw away the element.
      copyClean(el, to, doc);
      return;
    }

    const copy = doc.createElement(el.tagName.toLowerCase());
    for (const prop of ALLOWED_STYLES) {
      const value = el.style.getPropertyValue(prop);
      if (value && !UNSAFE_VALUE.test(value)) {
        copy.style.setProperty(prop, value);
      }
    }
    to.appendChild(copy);
    copyClean(el, copy, doc);
  });
}

/** The words on their own — for aria labels, previews and search. */
export function htmlToPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}
