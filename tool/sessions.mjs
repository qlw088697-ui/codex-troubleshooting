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

// 关键词搜索：默认读每个文件前 256KB（浅搜），--deep 全文扫描
export function searchSessions({ keyword, limit = 10, deep = false } = {}) {
  const root = path.join(CODEX_DIR, 'sessions');
  if (!exists(root) || !keyword) return [];
  const kw = String(keyword).toLowerCase();
  const files = walkFiles(root)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => ({ f, mtimeMs: fs.statSync(f).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  const results = [];
  for (const { f, mtimeMs } of files) {
    let content;
    try {
      content = deep ? fs.readFileSync(f, 'utf8') : readHead(f, 262144);
    } catch {
      continue;
    }
    const at = content.toLowerCase().indexOf(kw);
    if (at === -1) continue;

    // 定位匹配行，尽量抽出对话文本片段
    const lineEnd = content.indexOf('\n', at) === -1 ? content.length : content.indexOf('\n', at);
    const line = content.slice(content.lastIndexOf('\n', at) + 1, lineEnd);
    let snippet = '';
    try {
      const j = JSON.parse(line);
      const text =
        (j.payload?.content || []).find((c) => c.text)?.text || j.payload?.text || line;
      const t = text.toLowerCase().indexOf(kw);
      snippet = (t >= 0 ? text.slice(Math.max(0, t - 30), t + 70) : text.slice(0, 90)).replace(/\s+/g, ' ').trim();
    } catch {
      snippet = line.slice(0, 90).replace(/\s+/g, ' ').trim();
    }

    const { meta } = extract(content);
    results.push({
      date: (meta?.date) || new Date(mtimeMs).toISOString().slice(0, 16).replace('T', ' '),
      dirName: meta?.cwd ? path.basename(meta.cwd) : '?',
      snippet: snippet || '(匹配在元数据中)',
      mtimeMs,
    });
    if (results.length >= Math.max(Number(limit) || 10, 1)) break;
  }
  return results;
}
