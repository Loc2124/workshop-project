import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import console from 'node:console';
import process from 'node:process';

const root = fileURLToPath(new URL('..', import.meta.url));
const toRoot = (p) => path.resolve(root, p);
const walk = (dir) =>
  readdirSync(toRoot(dir), { withFileTypes: true }).flatMap((entry) => {
    const name = path.posix.join(dir, entry.name);
    return entry.isDirectory() ? walk(name) : [name];
  });
const files = [
  'README.md',
  'CLAUDE.md',
  ...walk('docs').filter((name) => name.endsWith('.md')),
];
const errors = [],
  warnings = [];
let checkedLinks = 0;
const withoutCode = (text) =>
  text.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, '');
function anchors(text) {
  const counts = new Map(),
    ids = new Set();
  for (const [, raw] of withoutCode(text).matchAll(/^#{1,6}\s+(.+)$/gm)) {
    const base = raw
      .toLowerCase()
      .replace(/<[^>]+>/g, '')
      .replace(/[^\p{L}\p{N}_\-\s]/gu, '')
      .replace(/\s/g, '-');
    const n = counts.get(base) ?? 0;
    counts.set(base, n + 1);
    ids.add(base + (n ? '-' + n : ''));
  }
  return ids;
}
for (const file of files) {
  const text = withoutCode(readFileSync(toRoot(file), 'utf8'));
  const urls = [
    ...text.matchAll(/!?\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))(?:\s+"[^"]*")?\)/g),
  ].map((match) => match[1] ?? match[2]);
  urls.push(
    ...[...text.matchAll(/^\s*\[[^\]]+\]:\s*(?:<([^>]+)>|(\S+))/gm)].map(
      (match) => match[1] ?? match[2],
    ),
  );
  for (const url of urls) {
    if (/^(?:https?:|mailto:|tel:|data:)/i.test(url)) continue;
    checkedLinks++;
    const [raw, fragment] = url.split('#', 2);
    let decoded;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      decoded = raw;
    }
    const target = raw
      ? path.resolve(path.dirname(toRoot(file)), decoded)
      : toRoot(file);
    const report = file.startsWith('docs/archive/') ? warnings : errors;
    if (!existsSync(target)) {
      report.push(`${file}: thiếu đích ${url}`);
      continue;
    }
    if (fragment && target.endsWith('.md') && statSync(target).isFile()) {
      let id;
      try {
        id = decodeURIComponent(fragment);
      } catch {
        id = fragment;
      }
      if (!anchors(readFileSync(target, 'utf8')).has(id))
        report.push(
          `${file}: thiếu mục #${id} trong ${path.relative(root, target)}`,
        );
    }
  }
}
const mapping = JSON.parse(
  readFileSync(toRoot('docs/document-map.json'), 'utf8'),
);
for (const [before, after] of Object.entries(mapping)) {
  if (!existsSync(toRoot(after)))
    errors.push(`Bản đồ di chuyển thiếu đích: ${after}`);
  if (existsSync(toRoot(before))) errors.push(`Còn bản tài liệu cũ: ${before}`);
}
const inventory = readFileSync(toRoot('docs/danh-muc-tai-lieu.md'), 'utf8');
for (const file of files.filter(
  (name) => name.startsWith('docs/') && name !== 'docs/danh-muc-tai-lieu.md',
)) {
  if (!inventory.includes(file.slice(5)))
    errors.push(`Thiếu trong danh mục: ${file}`);
}
for (const name of readdirSync(toRoot('docs'))) {
  if (
    name.endsWith('.md') &&
    !['README.md', 'danh-muc-tai-lieu.md'].includes(name)
  )
    errors.push(`Tài liệu chưa phân nhóm: docs/${name}`);
}
console.log(
  JSON.stringify(
    {
      files: files.length,
      internalLinks: checkedLinks,
      moves: Object.keys(mapping).length,
      errors: errors.length,
      historicalWarnings: warnings.length,
    },
    null,
    2,
  ),
);
for (const error of errors) console.error('ERROR ' + error);
for (const warning of warnings) console.warn('ARCHIVE ' + warning);
if (errors.length) process.exitCode = 1;
