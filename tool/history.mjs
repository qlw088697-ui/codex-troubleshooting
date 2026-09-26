// history：浏览 ~/.codex/history.jsonl 输入历史（只读）——找回「刚才想用的那条命令」
import fs from 'node:fs';
import path from 'node:path';
import { CODEX_DIR, exists } from './util.mjs';

export function listHistory({ limit = 20, keyword = null } = {}) {
  const file = path.join(CODEX_DIR, 'history.jsonl');
  if (!exists(file)) return { items: [], total: 0, corrupt: 0, missing: true };
  const items = [];
  let corrupt = 0;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let j;
    try {
      j = JSON.parse(line);
    } catch {
      corrupt++;
      continue;
    }
    if (typeof j?.text !== 'string' || !j.text.trim()) continue;
    items.push({
      time: typeof j.ts === 'number' ? new Date(j.ts * 1000).toISOString().slice(0, 16).replace('T', ' ') : '—',
      text: j.text.replace(/\s+/g, ' ').trim().slice(0, 120),
    });
  }
  const kw = keyword ? String(keyword).toLowerCase() : null;
  const filtered = kw ? items.filter((it) => it.text.toLowerCase().includes(kw)) : items;
  // 文件按追加序即时间序，倒序展示最近的输入
  const shown = filtered.slice(-Math.max(Number(limit) || 20, 1)).reverse();
  return { items: shown, total: filtered.length, corrupt, missing: false };
}
