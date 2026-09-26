// Renders docs/legal/*.md into static HTML pages.
//
//   node scripts/render-legal.mjs
//
// The legal pages used to fetch the markdown and render it in the browser
// with `marked` from jsdelivr. App Review opens the terms from inside the app;
// if that CDN script is slow or blocked, the page reads "Loading…" forever and
// the EULA looks missing. Static HTML has nothing to fail.
//
// Deliberately small: it handles exactly what the two documents use --
// headings, paragraphs, bold/italic/inline code, flat and nested lists,
// tables and horizontal rules -- and escapes everything else.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'legal');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(s) {
  let out = esc(s);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>');
  out = out.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>');
  // Bare email addresses become mailto links, so "email us" is one tap.
  out = out.replace(/(^|[\s(>])([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, '$1<a href="mailto:$2">$2</a>');
  return out;
}

function render(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let para = [];
  const flush = () => {
    if (para.length) html.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!line.trim()) { flush(); continue; }

    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { flush(); html.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); continue; }

    if (/^---\s*$/.test(line)) { flush(); html.push('<hr />'); continue; }

    if (/^\|/.test(line)) {
      flush();
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      i--;
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const [head, , ...body] = rows;
      html.push('<table><thead><tr>' + cells(head).map((c) => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>'
        + body.map((r) => '<tr>' + cells(r).map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('')
        + '</tbody></table>');
      continue;
    }

    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      flush();
      // A list block, possibly with one level of nesting (two or more spaces).
      const items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        const m = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
        items.push({ depth: m[1].length >= 2 ? 1 : 0, ordered: /\d/.test(m[2]), text: m[3] });
        i++;
      }
      i--;
      // A stack of open lists: an item deeper than the top opens a list inside
      // the still-open <li>; a shallower one closes lists until it fits.
      const out = [];
      const open = (ordered) => (ordered ? '<ol>' : '<ul>');
      const close = (ordered) => (ordered ? '</ol>' : '</ul>');
      const stack = [];
      for (const it of items) {
        while (stack.length && stack[stack.length - 1].depth > it.depth) {
          out.push('</li>', close(stack.pop().ordered));
        }
        if (stack.length && stack[stack.length - 1].depth === it.depth) {
          out.push('</li>');
        } else {
          out.push(open(it.ordered));
          stack.push({ depth: it.depth, ordered: it.ordered });
        }
        out.push(`<li>${inline(it.text)}`);
      }
      while (stack.length) out.push('</li>', close(stack.pop().ordered));
      html.push(out.join(''));
      continue;
    }

    para.push(line.trim());
  }
  flush();
  return html.join('\n');
}

const STYLE = `
    :root { --brand:#C8175E; --ink:#1F1428; --muted:#5C4A5E; --bg:#FBF6F2; --surface:#fff; --border:#eadfe4; }
    * { box-sizing: border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }
    .wrap { max-width: 760px; margin: 0 auto; padding: 40px 22px 80px; }
    .top { display:flex; align-items:center; gap:10px; margin-bottom:28px; }
    .logo { font-size:26px; font-weight:800; letter-spacing:-0.5px; color:var(--brand); }
    .doc { background:var(--surface); border:1px solid var(--border); border-radius:18px; padding:32px; }
    .doc h1 { font-size:30px; letter-spacing:-0.5px; margin:0 0 6px; }
    .doc h2 { font-size:21px; margin:32px 0 10px; padding-top:14px; border-top:1px solid var(--border); }
    .doc h3 { font-size:17px; margin:20px 0 6px; }
    .doc a { color:var(--brand); }
    .doc table { width:100%; border-collapse:collapse; margin:14px 0; font-size:14px; }
    .doc th, .doc td { border:1px solid var(--border); padding:8px 10px; text-align:left; vertical-align:top; }
    .doc code { background:#f3eef0; padding:1px 5px; border-radius:5px; font-size:90%; }
    .doc hr { border:0; border-top:1px solid var(--border); margin:28px 0; }
    .nav a { color:var(--muted); text-decoration:none; font-weight:600; font-size:14px; }
    footer { margin-top:24px; text-align:center; color:var(--muted); font-size:13px; }
    @media (max-width: 520px) { .doc { padding: 22px 18px; } }`;

function page({ title, body, other }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <!-- Generated by scripts/render-legal.mjs from the .md beside it. Edit the .md, then re-run. -->
  <style>${STYLE}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="top"><span class="logo">aura</span></div>
    <div class="nav" style="margin-bottom:16px;"><a href="./index.html">← All policies</a></div>
    <div class="doc">
${body}
    </div>
    <footer>© Aura Dating · ${other}</footer>
  </div>
</body>
</html>
`;
}

const docs = [
  { md: 'TERMS_OF_SERVICE.md', out: 'terms.html', title: 'Aura — Terms of Service', other: '<a href="./privacy.html">Privacy Policy</a>' },
  { md: 'PRIVACY_POLICY.md', out: 'privacy.html', title: 'Aura — Privacy Policy', other: '<a href="./terms.html">Terms of Service</a>' },
];

for (const d of docs) {
  const body = render(readFileSync(join(root, d.md), 'utf8'));
  writeFileSync(join(root, d.out), page({ title: d.title, body, other: d.other }));
  console.log(`${d.out}: ${body.length} chars of HTML`);
}
