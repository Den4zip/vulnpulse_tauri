import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const markdown = ['AGENTS.md', 'PLAN.md', 'PROJECT_MEMORY.md', 'references/README.md'];
if (existsSync(resolve(root, 'docs'))) {
  markdown.push(...readdirSync(resolve(root, 'docs'), { recursive: true })
    .filter((file) => file.endsWith('.md')).map((file) => `docs/${file}`));
}

const errors = [];
for (const file of markdown) {
  const absolute = resolve(root, file);
  const content = readFileSync(absolute, 'utf8');
  if (content.includes('\ufffd')) errors.push(`${file}: invalid UTF-8`);
  if ((content.match(/^\s*```/gm)?.length ?? 0) % 2 !== 0) errors.push(`${file}: unclosed code fence`);
  for (const [, link] of content.matchAll(/\]\(([^\s)]+)\)/g)) {
    if (/^(?:[a-z][a-z\d+.-]*:|#)/i.test(link)) continue;
    const path = resolve(dirname(absolute), decodeURIComponent(link.split('#')[0]));
    if (!existsSync(path)) errors.push(`${file}: missing ${link}`);
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Checked ${markdown.length} Markdown files`);
}
