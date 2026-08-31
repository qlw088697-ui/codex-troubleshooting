// 共享工具：路径、文件系统辅助、确认交互（零依赖，Node 标准库）
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const HOME = os.homedir();
export const CODEX_DIR = path.join(HOME, '.codex');
export const BACKUP_DIR = path.join(HOME, '.codex-backups');

export function exists(p) {
  try {
    fs.statSync(p);
    return true;
  } catch {
    return false;
  }
}

export function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

export function timestamp() {
  return new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
}

export function walkFiles(dir) {
  const out = [];
  if (!exists(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(p));
    else if (entry.isFile()) out.push(p);
  }
  return out;
}

export function dirBytes(dir) {
  return walkFiles(dir).reduce((s, f) => s + fs.statSync(f).size, 0);
}

// 破坏性操作的交互确认；非 TTY（如 CI）一律拒绝，必须显式 --yes
export async function confirm(question) {
  if (!process.stdin.isTTY) return false;
  const rl = (await import('node:readline/promises')).createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  try {
    const ans = (await rl.question(`${question} [y/N] `)).trim().toLowerCase();
    return ans === 'y' || ans === 'yes';
  } finally {
    rl.close();
  }
}
