/**
 * Long-form course fields (course/chapter/video description, article content,
 * exercise instructions) are stored as HTML. Authors may send HTML, markdown or
 * plain text; everything is normalised here and, critically, run through an
 * allowlist before it is written.
 *
 * This is a byte-for-byte port of `academy/src/helpers/rich-text.ts`, kept in sync
 * deliberately: the preview an author sees while typing has to match what the API
 * stores, or the editor lies. The server pass remains the authoritative one — this
 * copy is for preview and paste handling, never a security control.
 *
 * Dependency-free and DOM-free, so it runs the same in a server component, a client
 * component and a test. The only intended difference from the API copy is an
 * eslint pragma that this project's config does not need.
 */

type AllowedTags = Record<string, string[]>;

/** tag -> attributes that may survive on it */
const ALLOWED: AllowedTags = {
  p: [],
  br: [],
  h2: [],
  h3: [],
  h4: [],
  strong: [],
  em: [],
  code: [],
  pre: [],
  ul: [],
  ol: [],
  li: [],
  blockquote: [],
  hr: [],
  a: ['href', 'title'],
  img: ['src', 'alt'],
  video: ['src', 'controls', 'poster', 'width', 'height'],
  source: ['src', 'type'],
  table: [],
  thead: [],
  tbody: [],
  tr: [],
  th: ['colspan'],
  td: ['colspan'],
};

/** Pasted from Word, Google Docs or a CMS: rename rather than discard. */
const ALIAS: Record<string, string> = {
  b: 'strong',
  i: 'em',
  u: 'em',
  strike: 'em',
  div: 'p',
  section: 'p',
  article: 'p',
  h1: 'h2',
  h5: 'h4',
  h6: 'h4',
};

/** Elements whose *content* is dropped along with the tag. */
const DROP_WITH_CONTENT = new Set([
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'noscript',
  'template',
]);

/**
 * `source` is void (self-closing, never wraps content); `video` is NOT — it must
 * go on the `open` stack like any other container so nesting and auto-closing of
 * an unclosed `<video>` work the same way they do for every other element.
 */
const VOID_TAGS = new Set(['br', 'hr', 'img', 'source']);

const SAFE_URL = /^(?:https?:\/\/|mailto:|\/|#)/i;
/**
 * Images only. There is no reason a `<video src>`/`poster` needs to carry an
 * inline payload the size of a data URI, so the video/poster URL check below
 * intentionally does not reach this — see `safeUrl`.
 */
const SAFE_IMG_DATA = /^data:image\/(?:png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=\s]+$/i;

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&amp;/gi, '&');
}

/**
 * `java\tscript:` and friends: control characters and whitespace inside a URL are
 * stripped before the scheme is tested, so an obfuscated scheme cannot slip past.
 */
function safeUrl(value: string, attr: string, tag: string): string | null {
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
  const url = value.replace(/[\u0000-\u0020\u007f]/g, '');
  if (SAFE_URL.test(url)) return url;
  // Data-URI escape hatch is for <img src> only, never for video/poster --
  // there is no reason those need to carry an arbitrary inline payload.
  if (tag === 'img' && attr === 'src' && SAFE_IMG_DATA.test(url)) return url;
  return null;
}

const ATTR_RE = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

function renderAttrs(tag: string, rawAttrs: string): string {
  const allowed = ALLOWED[tag];
  if (!allowed || allowed.length === 0) return '';

  const out: string[] = [];
  let match: RegExpExecArray | null;
  ATTR_RE.lastIndex = 0;
  while ((match = ATTR_RE.exec(rawAttrs)) !== null) {
    const name = match[1].toLowerCase();
    if (!allowed.includes(name)) continue;
    const value = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');

    if (name === 'href' || name === 'src' || name === 'poster') {
      const url = safeUrl(value, name, tag);
      if (!url) continue;
      out.push(`${name}="${escapeHtml(url)}"`);
      continue;
    }
    if (name === 'colspan') {
      const n = parseInt(value, 10);
      if (!Number.isFinite(n) || n < 1 || n > 100) continue;
      out.push(`colspan="${n}"`);
      continue;
    }
    out.push(`${name}="${escapeHtml(value)}"`);
  }
  return out.length ? ' ' + out.join(' ') : '';
}

const TOKEN_RE = /<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;

/**
 * Allowlist sanitiser. Unknown tags are unwrapped (their text survives); the tags
 * in DROP_WITH_CONTENT take their content with them; every attribute not named in
 * ALLOWED is removed, and href/src must be http(s), mailto, root-relative, a
 * fragment, or — for images only — a base64 data URI.
 */
export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return '';
  const html = String(input);

  const out: string[] = [];
  const open: string[] = [];
  let cursor = 0;
  let skipUntil: string | null = null;
  let match: RegExpExecArray | null;

  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(html)) !== null) {
    const token = match[0];
    const rawName = match[1];
    const rawAttrs = match[2] ?? '';

    const text = html.slice(cursor, match.index);
    cursor = match.index + token.length;
    if (!skipUntil && text) out.push(escapeHtml(decodeEntities(text)));

    if (!rawName) continue; // comment
    const closing = token.startsWith('</');
    const name = rawName.toLowerCase();

    if (skipUntil) {
      if (closing && name === skipUntil) skipUntil = null;
      continue;
    }
    if (DROP_WITH_CONTENT.has(name)) {
      if (!closing && !token.endsWith('/>')) skipUntil = name;
      continue;
    }

    const aliased = ALIAS[name];
    const tag = ALLOWED[name] ? name : aliased && ALLOWED[aliased] ? aliased : null;
    if (!tag) continue; // unknown tag: unwrapped, its text already emitted

    if (closing) {
      const idx = open.lastIndexOf(tag);
      if (idx === -1) continue;
      // close anything left open inside it, innermost first
      for (let i = open.length - 1; i >= idx; i--) out.push(`</${open[i]}>`);
      open.splice(idx);
      continue;
    }

    out.push(`<${tag}${renderAttrs(tag, rawAttrs)}>`);
    if (!VOID_TAGS.has(tag)) open.push(tag);
  }

  const tail = html.slice(cursor);
  if (!skipUntil && tail) out.push(escapeHtml(decodeEntities(tail)));
  for (let i = open.length - 1; i >= 0; i--) out.push(`</${open[i]}>`);

  return out.join('').trim();
}

/* ───────────────────────── markdown ───────────────────────── */

function inline(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, (_m, code) => `<code>${code}</code>`)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|\s)_([^_\n]+)_/g, '$1<em>$2</em>');
}

/** `#` maps to h2 — h1 belongs to the page, not the body copy. */
export function markdownToHtml(markdown: string | null | undefined): string {
  if (!markdown) return '';
  const lines = String(markdown).replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let para: string[] = [];
  let i = 0;

  const flush = () => {
    if (para.length) out.push(`<p>${inline(para.join(' ').trim())}</p>`);
    para = [];
  };

  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {
      flush();
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]);
      i++;
      out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }
    if (/^\s*$/.test(line)) {
      flush();
      i++;
      continue;
    }
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flush();
      out.push('<hr>');
      i++;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flush();
      const level = Math.min(4, Math.max(2, heading[1].length + 1));
      out.push(`<h${level}>${inline(heading[2].trim())}</h${level}>`);
      i++;
      continue;
    }
    if (/^\s*>\s?/.test(line)) {
      flush();
      const quote: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quote.push(lines[i++].replace(/^\s*>\s?/, ''));
      }
      out.push(`<blockquote><p>${inline(quote.join(' '))}</p></blockquote>`);
      continue;
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i++].replace(/^\s*[-*+]\s+/, ''))}</li>`);
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      flush();
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i++].replace(/^\s*\d+[.)]\s+/, ''))}</li>`);
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    para.push(line.trim());
    i++;
  }
  flush();
  return out.join('\n');
}

const HTML_HINT =
  /<\/?(?:p|h[1-6]|ul|ol|li|pre|code|blockquote|strong|em|b|i|a|img|video|source|hr|table|div|span|br)\b/i;
const MD_HINT =
  /(?:^#{1,6}\s)|(?:^\s*[-*+]\s+)|(?:^\s*\d+[.)]\s+)|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|(?:^```)|(?:^\s*>\s)/m;

export function looksLikeHtml(value: string): boolean {
  return HTML_HINT.test(value || '');
}

export function looksLikeMarkdown(value: string): boolean {
  return MD_HINT.test(value || '');
}

/**
 * The single entry point for any long-form field arriving from a client:
 * HTML is sanitised, markdown is converted, plain text becomes paragraphs.
 */
export function normalizeRichText(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const raw = String(value);
  if (!raw.trim()) return '';
  if (looksLikeHtml(raw)) return sanitizeHtml(raw);
  return sanitizeHtml(markdownToHtml(raw));
}

/** Rendered text length — so `<p></p>` scaffolding cannot satisfy a minimum. */
export function richTextLength(html: string | null | undefined): number {
  if (!html) return 0;
  return String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&[a-z#0-9]+;/gi, 'x')
    .replace(/\s+/g, ' ')
    .trim().length;
}

/**
 * Plain text for a list row or a summary line. Long-form fields are stored as
 * HTML, and a table cell must not print the tags — it wants the words.
 */
export function richTextPreview(html: string | null | undefined): string {
  if (!html) return '';
  return String(html)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
