import React from 'react';

/**
 * Minimal markdown → React för studieplan.md: rubriker, stycken, listor,
 * tabeller, citat, fet/kursiv/kod och länkar. Bygger element (ingen HTML-
 * injektion), så texten kan aldrig köra skript.
 */
function inline(text, keyBase = 'i') {
  const out = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\))/g;
  let last = 0;
  let m;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyBase}-${k++}`;
    if (m[2]) out.push(<strong key={key}>{inline(m[2], key)}</strong>);
    else if (m[3] || m[4]) out.push(<em key={key}>{inline(m[3] || m[4], key)}</em>);
    else if (m[5]) out.push(<code key={key}>{m[5]}</code>);
    else if (m[6]) {
      const href = /^https?:\/\//.test(m[7]) ? m[7] : undefined;
      out.push(
        href ? (
          <a key={key} href={href} target="_blank" rel="noreferrer noopener">{m[6]}</a>
        ) : (
          <span key={key}>{m[6]}</span>
        )
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const splitRow = (line) =>
  line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

export function parseMarkdown(src) {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { blocks.push({ type: 'h', level: h[1].length, text: h[2] }); i++; continue; }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) { blocks.push({ type: 'hr' }); i++; continue; }
    if (line.trim().startsWith('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(splitRow(lines[i])); i++; }
      blocks.push({ type: 'table', head, rows });
      continue;
    }
    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
      blocks.push({ type: 'quote', text: buf.join(' ') });
      continue;
    }
    const li = line.match(/^\s*([-*]|\d+\.)\s+(.*)$/);
    if (li) {
      const ordered = /\d/.test(li[1]);
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*([-*]|\d+\.)\s+(.*)$/);
        if (m) { items.push(m[2]); i++; continue; }
        if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) { items[items.length - 1] += ` ${lines[i].trim()}`; i++; continue; }
        break;
      }
      blocks.push({ type: ordered ? 'ol' : 'ul', items });
      continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*>|\s*([-*]|\d+\.)\s|\s*\|)/.test(lines[i])) {
      buf.push(lines[i].trim());
      i++;
    }
    blocks.push({ type: 'p', text: buf.join(' ') });
  }
  return blocks;
}

function Markdown({ source, skipTitle = false }) {
  const blocks = parseMarkdown(source || '');
  return (
    <div className="markdown">
      {blocks.map((b, idx) => {
        const key = `b${idx}`;
        switch (b.type) {
          case 'h': {
            if (skipTitle && b.level === 1 && idx === 0) return null;
            const Tag = `h${Math.min(6, b.level + 1)}`;
            return <Tag key={key}>{inline(b.text, key)}</Tag>;
          }
          case 'hr':
            return <hr key={key} />;
          case 'quote':
            return <blockquote key={key}>{inline(b.text, key)}</blockquote>;
          case 'ul':
          case 'ol': {
            const Tag = b.type;
            return <Tag key={key}>{b.items.map((it, j) => <li key={j}>{inline(it, `${key}-${j}`)}</li>)}</Tag>;
          }
          case 'table':
            return (
              <div key={key} className="markdown-table">
                <table>
                  <thead><tr>{b.head.map((c, j) => <th key={j}>{inline(c, `${key}-h${j}`)}</th>)}</tr></thead>
                  <tbody>
                    {b.rows.map((r, j) => (
                      <tr key={j}>{r.map((c, k) => <td key={k}>{inline(c, `${key}-${j}-${k}`)}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          default:
            return <p key={key}>{inline(b.text, key)}</p>;
        }
      })}
    </div>
  );
}

export default Markdown;
