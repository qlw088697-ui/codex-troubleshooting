// ops：备份/恢复、auth 重置、版本追踪、归档管理、更新检查
import fs from 'node:fs';
import path from 'node:path';
import { BACKUP_DIR, CODEX_DIR, ensureDir, exists, timestamp, confirm, dirBytes } from './util.mjs';

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

// GitHub API 基址可覆盖（api.github.com 在部分网络不稳时，可指向自建/加速网关；测试也用它注入假服务）
const GH_API = (process.env.CODEX_DOCTOR_GH_API || 'https://api.github.com').replace(/\/+$/, '');

function ghHeaders() {
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'codex-doctor-cli' };
  if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;
  return headers;
}

export async function listVersions(limit = 10) {
  const n = Math.min(Math.max(Number(limit) || 10, 1), 50);
  const res = await fetch(`${GH_API}/repos/openai/codex/releases?per_page=${n}`, { headers: ghHeaders() });
  if (!res.ok) throw new Error(`GitHub API HTTP ${res.status}`);
  const releases = (await res.json()).filter((r) => !r.draft);
  return releases.slice(0, n).map((r) => ({
    tag: r.tag_name,
    date: (r.published_at || '').slice(0, 10) || '—',
    prerelease: r.prerelease === true,
  }));
}

// 拉取单个版本的发布说明，辅助评估是否值得升级
export async function fetchReleaseNotes(tag) {
  const t = String(tag || '').trim().replace(/^@/u, '');
  if (!t || t === '--notes') {
    throw new Error('缺少版本标签，例如: codex-doctor versions --notes v0.152.0（先用 versions 查可用标签）');
  }
  const url = (x) => `${GH_API}/repos/openai/codex/releases/tags/${encodeURIComponent(x)}`;
  let res = await fetch(url(t), { headers: ghHeaders() });
  // 官方标签带 v 前缀（如 v0.152.0）；用户漏写时自动补一次
  if (res.status === 404 && !/^v/i.test(t)) res = await fetch(url(`v${t}`), { headers: ghHeaders() });
  if (res.status === 404) {
    throw new Error(`GitHub 上没有 ${t} 的 Release（用 versions 核对标签名；草稿与纯 tag 不可见）`);
  }
  if (!res.ok) {
    throw new Error(`GitHub API HTTP ${res.status}（频繁触发限流可设置 GH_TOKEN 环境变量提升配额）`);
  }
  const r = await res.json();
  const body = String(r.body || '').trim();
  const lines = [];
  lines.push(`${r.tag_name}${r.name ? `  ${r.name}` : ''}`);
  lines.push(`发布: ${(r.published_at || '').slice(0, 10) || '—'}${r.prerelease ? '  [预发布]' : ''}`);
  lines.push('');
  if (!body) {
    lines.push('（该 Release 没有正文说明）');
  } else {
    const MAX = 2400;
    lines.push(body.length > MAX ? `${body.slice(0, MAX)}\n...（正文过长已截断，完整内容见下方链接）` : body);
  }
  lines.push('');
  lines.push(`完整说明: ${r.html_url}`);
  return { lines };
}

// ---------- 归档管理 ----------

const ARCHIVE_ROOT = () => path.join(CODEX_DIR, 'archive');

export function listArchives() {
  const root = ARCHIVE_ROOT();
  if (!exists(root)) return { items: [], lines: [`暂无归档目录（${root}）`] };
  const items = [];
  for (const name of fs.readdirSync(root)) {
    const p = path.join(root, name);
    if (!fs.statSync(p).isDirectory()) continue;
    let files = 0;
    (function w(x) {
      for (const e of fs.readdirSync(x, { withFileTypes: true })) {
        if (e.isDirectory()) w(path.join(x, e.name));
        else files++;
      }
    })(p);
    items.push({ name, bytes: dirBytes(p), files });
  }
  if (items.length === 0) return { items: [], lines: ['归档目录为空'] };
  return { items, lines: [] };
}

export async function deleteArchive(name, { all = false, yes = false } = {}) {
  const root = path.resolve(ARCHIVE_ROOT());
  const targets = [];
  if (all) {
    if (!exists(root)) return { lines: ['暂无归档可删除'] };
    for (const n of fs.readdirSync(root)) {
      const p = path.join(root, n);
      if (fs.statSync(p).isDirectory()) targets.push({ name: n, p, bytes: dirBytes(p) });
    }
  } else {
    if (!name) return { bad: true, lines: ['用法: codex-doctor archive delete <名称|--all>'] };
    const p = path.resolve(root, String(name));
    // 防目录穿越：目标必须仍在 archive 根内
    if (!p.toLowerCase().startsWith(root.toLowerCase() + path.sep) || !exists(p) || !fs.statSync(p).isDirectory()) {
      return { bad: true, lines: [`归档不存在: ${name}`] };
    }
    targets.push({ name: path.basename(p), p, bytes: dirBytes(p) });
  }
  if (targets.length === 0) return { lines: ['归档目录为空，无需删除'] };

  const totalMB = targets.reduce((s, t) => s + t.bytes, 0) / 1024 / 1024;
  const summary = `将删除 ${targets.length} 个归档目录（共约 ${totalMB.toFixed(1)} MB）：${targets.map((t) => t.name).join(', ')}`;
  if (!yes) {
    const go = await confirm(`${summary}，继续？`);
    if (!go) return { lines: ['已取消'] };
  }
  const lines = [];
  for (const t of targets) {
    fs.rmSync(t.p, { recursive: true, force: true });
    lines.push(`已删除 ${t.name}`);
  }
  lines.push(`共释放约 ${totalMB.toFixed(1)} MB`);
  return { lines };
}

// ---------- 更新检查 ----------

function compareSemver(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

export async function checkUpdate(currentVersion) {
  // 与 npm registry 上的包版本对比（仓库 GitHub release 版本号与本工具版本号不同步）
  // 注意：缩略 Accept 头配 /latest 端点会返回 406，故请求完整 packument 读 dist-tags
  const res = await fetch('https://registry.npmjs.org/@qqq123456789%2Fcodex-doctor', {
    headers: { Accept: 'application/vnd.npm.install-v1+json', 'User-Agent': 'codex-doctor-cli' },
  });
  if (!res.ok) throw new Error(`npm registry HTTP ${res.status}`);
  const r = await res.json();
  const latest = r['dist-tags']?.latest || '';
  const newer = latest ? compareSemver(currentVersion, latest) < 0 : false;
  return {
    lines: [
      `当前工具版本: ${currentVersion}`,
      `npm 最新版本: ${latest}`,
      newer
        ? 'npx 直跑始终使用最新代码，无需操作；全局安装用户请执行 npm install -g @qqq123456789/codex-doctor@latest'
        : '已是最新版本。',
    ],
  };
}
