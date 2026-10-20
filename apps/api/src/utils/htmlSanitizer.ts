/**
 * Whitelist-based sanitizer for AI-generated rich-text content.
 *
 * Page content is stored as HTML and rendered by the web, desktop and mobile (webview) editors,
 * so anything the model produces is reduced to the small set of tags/attributes the editor
 * understands. Everything else is dropped (script/style blocks are removed with their content,
 * other unknown tags are unwrapped), and stray "<" characters are escaped.
 */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'strong', 'b', 'em', 'i', 'u', 's',
  'a', 'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'details', 'summary', 'div', 'span',
]);

const VOID_TAGS = new Set(['br', 'hr', 'img']);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  '*': new Set(['data-type', 'data-checked']),
  a: new Set(['href']),
  img: new Set(['src', 'alt']),
  th: new Set(['colspan', 'rowspan']),
  td: new Set(['colspan', 'rowspan']),
  details: new Set(['open']),
};

const ALLOWED_DATA_TYPES = new Set(['taskList', 'taskItem', 'detailsContent']);
const SAFE_URL = /^(https?:\/\/|mailto:|\/(?!\/))/i;

// Private-use sentinels that mark tags we rebuilt, so the leftover "<" can be escaped afterwards.
const TAG_OPEN = '\u0001';
const TAG_CLOSE = '\u0002';

const ATTR_PATTERN = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function buildAttributes(tag: string, rawAttrs: string): string {
  const allowed = ALLOWED_ATTRS[tag];
  let out = '';
  ATTR_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = ATTR_PATTERN.exec(rawAttrs)) !== null) {
    const name = (match[1] ?? '').toLowerCase();
    const isAllowed = ALLOWED_ATTRS['*']!.has(name) || allowed?.has(name);
    if (!isAllowed) continue;

    const value = decodeBasicEntities(match[2] ?? match[3] ?? match[4] ?? '').trim();

    if (name === 'href' || name === 'src') {
      // Strip control characters/whitespace that browsers ignore inside schemes ("java\tscript:")
      const normalized = value.replace(/[\u0000-\u0020]/g, '');
      if (!SAFE_URL.test(normalized)) continue;
      out += ` ${name}="${escapeAttr(value)}"`;
    } else if (name === 'data-type') {
      if (ALLOWED_DATA_TYPES.has(value)) out += ` data-type="${value}"`;
    } else if (name === 'data-checked') {
      if (value === 'true' || value === 'false') out += ` data-checked="${value}"`;
    } else if (name === 'colspan' || name === 'rowspan') {
      if (/^\d{1,2}$/.test(value)) out += ` ${name}="${value}"`;
    } else if (name === 'open') {
      out += ' open=""';
    } else {
      out += ` ${name}="${escapeAttr(value)}"`;
    }
  }

  return out;
}

export function sanitizeHtml(input: unknown): string {
  let html = typeof input === 'string' ? input : '';

  html = html.replace(/[\u0001\u0002]/g, '');
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  html = html.replace(
    /<\s*(script|style|iframe|object|embed|noscript|template|textarea|title|svg|math)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
    '',
  );

  html = html.replace(
    /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9-]*)((?:\s[^<>]*)?)>/g,
    (_match, closing: string, rawName: string, rawAttrs: string) => {
      const tag = rawName.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return '';

      if (closing) {
        return VOID_TAGS.has(tag) ? '' : `${TAG_OPEN}/${tag}${TAG_CLOSE}`;
      }

      const attrs = buildAttributes(tag, rawAttrs ?? '');
      return `${TAG_OPEN}${tag}${attrs}${VOID_TAGS.has(tag) ? ' /' : ''}${TAG_CLOSE}`;
    },
  );

  // Any "<" that is not part of a rebuilt tag is plain text.
  html = html.replace(/</g, '&lt;');
  return html.replace(new RegExp(TAG_OPEN, 'g'), '<').replace(new RegExp(TAG_CLOSE, 'g'), '>');
}

const escapeText = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Turns model output into editor-ready HTML: strips markdown code fences, and wraps plain
 * text (no HTML tags at all) into paragraphs before sanitizing.
 */
export function toEditorHtml(raw: string): string {
  let text = (raw ?? '').trim();

  const fenced = text.match(/^```(?:html)?\s*\n([\s\S]*?)\n?```$/i);
  if (fenced && fenced[1] !== undefined) text = fenced[1].trim();

  const hasTags = /<\/?[a-zA-Z][^>]*>/.test(text);
  if (!hasTags) {
    return text
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block) => `<p>${escapeText(block).replace(/\n/g, '<br />')}</p>`)
      .join('');
  }

  return sanitizeHtml(text);
}
