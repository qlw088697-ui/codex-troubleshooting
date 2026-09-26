// logs：查看 ~/.codex/log/ 下的运行日志（只读）——「五步法」第 4 步的一键化
import fs from 'node:fs';
import path from 'node:path';
import { CODEX_DIR, exists, walkFiles } from './util.mjs';

const LOG_DIR = path.join(CODEX_DIR, 'log');
// 超大日志只读末尾，避免整读占内存；行号按扫描区域计算
const MAX_SCAN_BYTES = 128 * 1024 * 1024;
// 日志级别行（rust tracing 风格大写级别；大小写敏感以减少误报）
const LEVEL_RE = /\b(ERROR|WARN|PANIC|FATAL)\b/;

export function listLogs({ limit = 10 } = {}) {
  if (!exists(LOG_DIR)) return [];
  const items = [];
  for (const f of walkFiles(LOG_DIR)) {
    try {
      const st = fs.statSync(f);
      items.push({
        file: f,
        rel: path.relative(LOG_DIR, f),
        bytes: st.size,
        mtimeMs: st.mtimeMs,
        mtime: st.mtime.toISOString().slice(0, 16).replace('T', ' '),
      });
    } catch {
      /* 单个文件状态异常不影响整体列表 */
    }
  }
  items.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return items.slice(0, Math.max(Number(limit) || 10, 1));
}

// 按文件名关键字挑一个日志（子串匹配，大小写不敏感）；不带关键字则返回最新的一个
export function resolveLogFile(keyword = null) {
  const items = listLogs({ limit: Number.MAX_SAFE_INTEGER });
  if (items.length === 0) return null;
  if (!keyword) return items[0];
  const kw = String(keyword).toLowerCase();
  return items.find((it) => it.rel.toLowerCase().includes(kw)) || null;
}

function pickTargets({ all, file } = {}) {
  if (all) return listLogs({ limit: Number.MAX_SAFE_INTEGER });
  const it = resolveLogFile(file);
  return it ? [it] : [];
}

// 读文件末尾至多 maxBytes 字节；超大文件标记 truncated
function readTail(file, maxBytes = MAX_SCAN_BYTES) {
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    if (size <= maxBytes) {
      const buf = Buffer.alloc(size);
      fs.readSync(fd, buf, 0, size, 0);
      return { text: buf.toString('utf8'), truncated: false };
    }
    const buf = Buffer.alloc(maxBytes);
    fs.readSync(fd, buf, 0, maxBytes, size - maxBytes);
    return { text: buf.toString('utf8'), truncated: true };
  } finally {
    fs.closeSync(fd);
  }
}

// 末尾 N 行（单行超 400 字符截断显示）
export function tailLog(file, n = 50) {
  const { text } = readTail(file, 8 * 1024 * 1024);
  let lines = text.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  lines = lines.slice(-Math.max(Number(n) || 50, 1));
  return lines.map((l) => (l.length > 400 ? l.slice(0, 400) + '…' : l));
}

function scan(targets, match, limit) {
  const hits = [];
  for (const it of targets) {
    let content = '';
    let truncated = false;
    try {
      ({ text: content, truncated } = readTail(it.file));
    } catch {
      continue;
    }
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (!match(lines[i])) continue;
      hits.push({
        file: it.rel,
        line: i + 1,
        truncated,
        text: lines[i].trim().slice(0, 300),
        mtimeMs: it.mtimeMs,
      });
      if (hits.length >= limit) return hits;
    }
  }
  return hits;
}

export function searchLogs({ keyword, all = false, file = null, limit = 40 } = {}) {
  if (!keyword) return [];
  const targets = pickTargets({ all, file });
  if (targets.length === 0) return [];
  const kw = String(keyword).toLowerCase();
  return scan(targets, (l) => l.toLowerCase().includes(kw), Math.max(Number(limit) || 40, 1));
}

export function errorLines({ all = false, file = null, limit = 40 } = {}) {
  const targets = pickTargets({ all, file });
  if (targets.length === 0) return [];
  return scan(targets, (l) => LEVEL_RE.test(l), Math.max(Number(limit) || 40, 1));
}
