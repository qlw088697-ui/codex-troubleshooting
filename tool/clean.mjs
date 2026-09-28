// clean：把超过 N 天的会话/日志/旧归档文件移动到 ~/.codex/archive/（移动而非删除）
import fs from 'node:fs';
import path from 'node:path';
import { CODEX_DIR, ensureDir, exists, timestamp, walkFiles } from './util.mjs';

// CLI 目标名 → ~/.codex 下的目录（archived_sessions 是 Codex 自身的会话归档区，存在才处理）
const TARGET_DIR = {
  sessions: 'sessions',
  logs: 'log',
  archived_sessions: 'archived_sessions',
};

function pruneEmptyDirs(root) {
  if (!exists(root)) return;
  for (const e of fs.readdirSync(root, { withFileTypes: true })) {
    if (e.isDirectory()) {
      const p = path.join(root, e.name);
      pruneEmptyDirs(p);
      try {
        fs.rmdirSync(p); // 仅当已空才生效
      } catch {
        /* 非空则保留 */
      }
    }
  }
}

export function cleanTarget({ target, days, yes }) {
  const dir = path.join(CODEX_DIR, TARGET_DIR[target] || target);

  if (!exists(dir)) {
    return { lines: [`${dir} 不存在，无需清理`], moved: 0 };
  }

  const cutoff = Date.now() - days * 86400e3;
  const victims = [];
  for (const f of walkFiles(dir)) {
    const st = fs.statSync(f);
    if (st.mtimeMs < cutoff) {
      victims.push({ f, rel: path.relative(dir, f), bytes: st.size });
    }
  }

  const lines = [];
  if (victims.length === 0) {
    lines.push(`${days} 天内没有可归档的文件（${dir}）`);
    return { lines, moved: 0 };
  }

  const kb = victims.reduce((s, v) => s + v.bytes, 0) / 1024;
  lines.push(`发现 ${victims.length} 个超过 ${days} 天的文件（约 ${kb.toFixed(1)} KB）：`);
  for (const v of victims.slice(0, 10)) lines.push(`  - ${v.rel}`);
  if (victims.length > 10) lines.push(`  ...等共 ${victims.length} 个文件`);

  if (!yes) {
    lines.push('');
    lines.push('（预演模式：未做任何改动。确认无误请加 --yes 执行）');
    return { lines, moved: 0, dryRun: true };
  }

  const dest = path.join(CODEX_DIR, 'archive', `${target}-${timestamp()}`);
  let moved = 0;
  for (const v of victims) {
    const to = path.join(dest, v.rel);
    try {
      ensureDir(path.dirname(to));
      fs.renameSync(v.f, to);
      moved++;
    } catch (e) {
      lines.push(`  跳过 ${v.rel}: ${e.code || e.message}（文件可能正被 codex 使用，关闭 codex 后重试）`);
    }
  }
  pruneEmptyDirs(dir);
  if (target === 'archived_sessions') {
    // Codex 自身的归档区：清空后连同目录一起收走（Codex 需要时会自行重建）；
    // sessions/log 的根目录是活跃目录，刻意保留
    try {
      if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
    } catch {
      /* 删除失败无害，留待下次 */
    }
  }
  lines.push(`已归档 ${moved} 个文件 → ${dest}`);
  return { lines, moved };
}
