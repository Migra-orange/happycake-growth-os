import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const forbidden = [
  /TELEGRAM_BOT_TOKEN=\d+:/,
  /sbc_team_(?!REPLACE_WITH_YOURS)[A-Za-z0-9_\-]+/,
  /ghp_[A-Za-z0-9_]{20,}/,
  /\bsk-[A-Za-z0-9_\-]{20,}\b/
];
const skip = new Set(['node_modules', '.git', 'dist']);
let bad = false;
function walk(dir: string) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(ts|tsx|js|json|md|env|example|html|css)$/.test(entry.name)) {
      const txt = fs.readFileSync(p, 'utf8');
      for (const re of forbidden) if (re.test(txt)) { console.error(`Potential secret in ${p}: ${re}`); bad = true; }
    }
  }
}
walk(root);
if (bad) process.exit(1);
console.log('No obvious committed secrets found.');
