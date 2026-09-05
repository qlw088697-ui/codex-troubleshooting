// sessions：浏览 ~/.codex/sessions 下的历史会话（只读）
import fs from 'node:fs';
import path from 'node:path';
import { CODEX_DIR, exists, walkFiles } from './util.mjs';

// 只读每个文件头部 64KB：meta 在第 1 行，真实提问通常也在最前面
function readHead(file, bytes = 65536) {
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(bytes);
    const n = fs.readSync(fd, buf, 0, bytes, 0);
    return buf.subarray(0, n).toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
}

function extract(head) {
  let meta = null;
  let preview = null;
  for (const line of head.split('\n')) {
    if (!line.trim()) continue;
    let j;
    try {
      j = JSON.parse(line);
    } catch {
      continue;
    }
    if (!meta && j.type === 'session_meta' && j.payload) {
      meta = {
        date: (j.payload.timestamp || '').slice(0, 16).replace('T', ' '),
        cwd: j.payload.cwd || '',
        originator: j.payload.originator || '',
        subagent: Boolean(j.payload.source?.subagent),
      };
    }
    if (
      j.type === 'response_item' &&
      j.payload?.type === 'message' &&
      j.payload?.role === 'user'
    ) {
      const text = (j.payload.content || []).find((c) => c.text)?.text || '';
      // 跳过环境上下文/项目指令包装，找真实提问
      if (!text.startsWith('<environment_context>') && !text.startsWith('<user_instructions>')) {
        preview = text.replace(/\s+/g, ' ').trim().slice(0, 70);
        break;
      }
    }
  }
  return { meta, preview };
}

export function listSessions({ limit = 10, cwdFilter = null } = {}) {
  const root = path.join(CODEX_DIR, 'sessions');
  if (!exists(root)) return [];
  const items = [];
  for (const f of walkFiles(root)) {
    if (!f.endsWith('.jsonl')) continue;
    try {
      const st = fs.statSync(f);
      const { meta, preview } = extract(readHead(f));
      if (!meta) continue;
      items.push({
        date: meta.date || st.mtime.toISOString().slice(0, 16).replace('T', ' '),
        dirName: meta.cwd ? path.basename(meta.cwd) : '?',
        cwd: meta.cwd,
        originator: meta.originator || '',
        subagent: meta.subagent,
        preview,
        mtimeMs: st.mtimeMs,
      });
    } catch {
      /* 单个文件损坏不影响整体列表 */
    }
  }
  items.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const filtered = cwdFilter
    ? items.filter((it) => it.cwd.toLowerCase().includes(String(cwdFilter).toLowerCase()))
    : items;
  return filtered.slice(0, Math.max(Number(limit) || 10, 1));
}
