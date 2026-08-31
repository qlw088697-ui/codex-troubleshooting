// ops：备份/恢复、auth 重置、版本追踪
import fs from 'node:fs';
import path from 'node:path';
import { BACKUP_DIR, CODEX_DIR, ensureDir, exists, timestamp, confirm } from './util.mjs';

const CRITICAL_FILES = ['config.toml', 'auth.json'];

export function backupConfig(out) {
  if (!exists(CODEX_DIR)) return { ok: false, lines: ['~/.codex 不存在，无需备份'] };
  const dir = out ? path.resolve(out) : path.join(BACKUP_DIR, timestamp());
  ensureDir(dir);
  const copied = [];
  for (const name of CRITICAL_FILES) {
    const src = path.join(CODEX_DIR, name);
    if (exists(src)) {
      fs.copyFileSync(src, path.join(dir, name));
      copied.push(name);
    }
  }
  const lines = [];
  if (copied.length === 0) {
    lines.push('~/.codex 里没有 config.toml / auth.json 可备份');
    return { ok: false, lines };
  }
  lines.push(`已备份 ${copied.join(', ')} → ${dir}`);
  if (copied.includes('auth.json')) {
    lines.push('注意：auth.json 等同密码——备份目录请勿提交仓库或上传网盘明文。');
  }
  return { ok: true, lines, dir };
}

export function restoreBackup(dir) {
  const src = path.resolve(String(dir || ''));
  if (!exists(src)) return { ok: false, lines: [`备份目录不存在: ${src}`] };
  const lines = [];
  const restored = [];
  for (const name of CRITICAL_FILES) {
    const from = path.join(src, name);
    if (exists(from)) {
      fs.copyFileSync(from, path.join(CODEX_DIR, name));
      restored.push(name);
    }
  }
  if (restored.length === 0) {
    return { ok: false, lines: [`目录里没有可恢复的文件（需要 ${CRITICAL_FILES.join(' / ')}）: ${src}`] };
  }
  lines.push(`已恢复 ${restored.join(', ')} → ${CODEX_DIR}`);
  if (restored.includes('auth.json')) {
    lines.push('若凭据较旧导致 401，重新 codex login 一次即可。');
  }
  return { ok: true, lines };
}

export async function resetAuth(yes) {
  const auth = path.join(CODEX_DIR, 'auth.json');
  if (!exists(auth)) {
    return { lines: ['auth.json 不存在，无需重置——直接运行 codex login 即可'] };
  }
  if (!yes) {
    const go = await confirm('将备份并删除 auth.json（之后需要重新 codex login），继续？');
    if (!go) return { lines: ['已取消'] };
  }
  const dir = path.join(BACKUP_DIR, timestamp());
  ensureDir(dir);
  fs.copyFileSync(auth, path.join(dir, 'auth.json'));
  fs.rmSync(auth);
  return {
    lines: [
      `已备份并删除 auth.json（备份在 ${dir}）`,
      '下一步：运行 codex login 重新登录（401 排障详见 docs/02-login-auth.md）',
    ],
  };
}

export async function listVersions(limit = 10) {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'codex-doctor-cli' };
  if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;
  const n = Math.min(Math.max(Number(limit) || 10, 1), 50);
  const res = await fetch(`https://api.github.com/repos/openai/codex/releases?per_page=${n}`, { headers });
  if (!res.ok) throw new Error(`GitHub API HTTP ${res.status}`);
  const releases = (await res.json()).filter((r) => !r.draft);
  return releases.slice(0, n).map((r) => ({
    tag: r.tag_name,
    date: (r.published_at || '').slice(0, 10) || '—',
    prerelease: r.prerelease === true,
  }));
}
