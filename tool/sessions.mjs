// sessions：浏览 ~/.codex/sessions 下的历史会话（只读）
import fs from 'node:fs';
import path from 'node:path';
import { CODEX_DIR, exists, walkFiles, ensureDir } from './util.mjs';

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
        file: f,
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
      file: f,
      date: (meta?.date) || new Date(mtimeMs).toISOString().slice(0, 16).replace('T', ' '),
      dirName: meta?.cwd ? path.basename(meta.cwd) : '?',
      snippet: snippet || '(匹配在元数据中)',
      mtimeMs,
    });
    if (results.length >= Math.max(Number(limit) || 10, 1)) break;
  }
  return results;
}

// 读取单个会话的完整对话（user / assistant 消息，跳过环境包装与工具输出）
export function readTranscript(file, { maxLen = 400 } = {}) {
  if (!exists(file)) return null;
  const content = fs.readFileSync(file, 'utf8');
  const out = [];
  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    let j;
    try {
      j = JSON.parse(line);
    } catch {
      continue;
    }
    if (j.type !== 'response_item' || j.payload?.type !== 'message') continue;
    const role = j.payload.role;
    if (role !== 'user' && role !== 'assistant') continue;
    let text = (j.payload.content || []).map((c) => c.text || '').filter(Boolean).join('\n');
    if (!text) continue;
    if (role === 'user' && (text.startsWith('<environment_context>') || text.startsWith('<user_instructions>'))) continue;
    if (role === 'user' && text.startsWith('<permissions')) continue;
    if (text.length > maxLen) text = text.slice(0, maxLen) + '…';
    out.push({ role, text });
  }
  return out;
}

// 把会话导出为 Markdown 文件（找回的对话可存档分享）
export function exportTranscriptMarkdown(file, outFile, { maxLen = 400 } = {}) {
  if (!exists(file)) return null;
  const content = fs.readFileSync(file, 'utf8');
  const { meta } = extract(content);
  const transcript = readTranscript(file, { maxLen });
  if (!transcript || transcript.length === 0) return null;

  const lines = ['# Codex 会话记录', ''];
  lines.push(`- 时间：${meta?.date || '?'}`);
  lines.push(`- 工作目录：${meta?.cwd || '?'}`);
  lines.push(`- 来源：${meta?.originator || '?'}`);
  lines.push(`- 导出自：${file}`);
  lines.push('');
  for (const msg of transcript) {
    lines.push(`## ${msg.role === 'user' ? '用户' : 'Codex'}`);
    lines.push('');
    lines.push(msg.text);
    lines.push('');
  }
  const dest = path.resolve(outFile);
  ensureDir(path.dirname(dest));
  fs.writeFileSync(dest, lines.join('\n'), 'utf8');
  return { outFile: dest, count: transcript.length };
}

// 读文件末尾至多 bytes 字节（用于取最后一条 token_count，避免整读大文件）
function readTailBytes(file, bytes = 1048576) {
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    const len = Math.min(size, bytes);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, size - len);
    const text = buf.toString('utf8');
    // 从中间起读时丢掉首个不完整行
    return size > len ? text.slice(text.indexOf('\n') + 1) : text;
  } finally {
    fs.closeSync(fd);
  }
}

// 单个会话的用量：取最后一条 token_count 事件的累计值（旧版本会话无此事件则返回 null）
function scanUsage(file) {
  let usage = null;
  for (const line of readTailBytes(file).split('\n')) {
    if (!line.includes('token_count')) continue;
    let j;
    try {
      j = JSON.parse(line);
    } catch {
      continue;
    }
    if (j.type === 'event_msg' && j.payload?.type === 'token_count' && j.payload?.info?.total_token_usage) {
      const t = j.payload.info.total_token_usage;
      usage = {
        input: t.input_tokens || 0,
        cached: t.cached_input_tokens || 0,
        output: t.output_tokens || 0,
        total: t.total_tokens || 0,
      };
    }
  }
  return usage;
}

// 用量统计：--days 窗口内（按 mtime）的会话各自累计 tokens，用于 429 自查
export function sessionStats({ days = 7, cwdFilter = null } = {}) {
  const root = path.join(CODEX_DIR, 'sessions');
  if (!exists(root)) return { items: [], totals: null, skipped: 0 };
  const cutoffMs = Date.now() - Math.max(Number(days) || 7, 1) * 86400e3;
  const items = [];
  let skipped = 0;
  for (const f of walkFiles(root)) {
    if (!f.endsWith('.jsonl')) continue;
    let st;
    try {
      st = fs.statSync(f);
    } catch {
      continue;
    }
    if (st.mtimeMs < cutoffMs) continue;
    let usage;
    try {
      usage = scanUsage(f);
    } catch {
      continue;
    }
    if (!usage) {
      skipped++;
      continue;
    }
    const { meta } = extract(readHead(f));
    if (cwdFilter && !(meta?.cwd || '').toLowerCase().includes(String(cwdFilter).toLowerCase())) continue;
    items.push({
      file: f,
      date: meta?.date || new Date(st.mtimeMs).toISOString().slice(0, 16).replace('T', ' '),
      dirName: meta?.cwd ? path.basename(meta.cwd) : '?',
      ...usage,
      mtimeMs: st.mtimeMs,
    });
  }
  items.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const totals = items.length
    ? items.reduce(
        (acc, it) => ({
          input: acc.input + it.input,
          cached: acc.cached + it.cached,
          output: acc.output + it.output,
          total: acc.total + it.total,
        }),
        { input: 0, cached: 0, output: 0, total: 0 }
      )
    : null;
  return { items, totals, skipped };
}
