// doctor 自检：与 scripts/codex-doctor.ps1/.sh 检查项一致，跨平台单一实现
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { HOME, CODEX_DIR, exists, dirBytes } from './util.mjs';

const ROOT_KEYS = /^(model|model_provider|approval_policy|sandbox_mode)\s*=/;

async function probe(url) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(url, { method: 'HEAD', signal: ctl.signal });
    return { ok: true, code: res.status };
  } catch (err) {
    return { ok: false, err: err?.cause?.code || err?.name || 'error' };
  } finally {
    clearTimeout(timer);
  }
}

async function probeWithRetry(url, tries = 2) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    const r = await probe(url);
    if (r.ok) return r;
    last = r;
  }
  return last;
}

function safeHost(u) {
  try {
    return new URL(u).host;
  } catch {
    return '(无效 URL)';
  }
}

function runCmd(cmd, args) {
  try {
    return execFileSync(cmd, args, {
      encoding: 'utf8',
      timeout: 15000,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return null;
  }
}

// Windows 上 codex 是 .cmd，必须经 shell 启动；命令整串传递以避免参数转义告警
function runShell(cmdString) {
  try {
    return execFileSync(cmdString, {
      encoding: 'utf8',
      timeout: 15000,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    }).trim();
  } catch {
    return null;
  }
}

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

// 查询 openai/codex 最新稳定版（rust-v0.151.0 → 0.151.0）；失败返回 null 静默跳过
async function fetchLatestCodexVersion() {
  try {
    const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'codex-doctor-cli' };
    if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;
    const res = await fetch('https://api.github.com/repos/openai/codex/releases/latest', { headers });
    if (!res.ok) return null;
    const tag = (await res.json()).tag_name || '';
    return (tag.match(/(\d+\.\d+\.\d+)/) || [])[1] || null;
  } catch {
    return null;
  }
}

export async function collectChecks({ network = true } = {}) {
  const results = [];
  const add = (id, status, detail, doc) => results.push({ id, status, detail, doc });

  // 1. codex 本体
  const codexVer = runShell('codex --version');
  add(
    'codex',
    codexVer ? 'ok' : 'fail',
    codexVer ? `codex 已安装: ${codexVer}` : 'codex 不在 PATH 中',
    'docs/01-installation.md'
  );

  // 2. node / npm
  const nodeVer = runCmd('node', ['-v']);
  if (nodeVer) {
    const major = parseInt(String(nodeVer).replace(/^v(\d+).*/, '$1'), 10);
    add('node', major >= 20 ? 'ok' : 'warn', `node ${nodeVer}${major >= 20 ? '' : '（建议 20 LTS+）'}`, 'docs/01-installation.md');
  } else {
    add('node', 'info', '未检测到 node（brew/二进制方式安装 codex 则无妨）');
  }

  // 3. 配置目录与 config.toml
  if (exists(CODEX_DIR)) {
    add('codexdir', 'ok', `~/.codex 存在: ${CODEX_DIR}`);
  } else {
    add('codexdir', 'warn', '~/.codex 不存在（从未运行过 codex，或已被完全重置）');
  }

  let relayUrl = null;
  const cfg = path.join(CODEX_DIR, 'config.toml');
  if (exists(cfg)) {
    add('config', 'ok', 'config.toml 存在');
    const content = fs.readFileSync(cfg, 'utf8');
    let inTable = false;
    const suspects = [];
    content.split(/\r?\n/).forEach((line, i) => {
      const l = line.trim();
      if (/^\[.+\]/.test(l)) {
        inTable = true;
        return;
      }
      if (!l || l.startsWith('#')) return;
      if (inTable && ROOT_KEYS.test(l)) suspects.push(`第${i + 1}行: ${l}`);
    });
    if (suspects.length > 0) {
      add(
        'config-roots',
        'warn',
        `有 ${suspects.length} 处赋值出现在 [表] 之后，若本意是根级配置则不生效（[profiles.*] 内属正常）：${suspects.slice(0, 3).join('；')}`,
        'docs/04-config.md'
      );
    } else {
      add('config-roots', 'ok', '未发现根级键位置问题');
    }
    if (/^\[model_providers\./m.test(content)) {
      add('providers', 'warn', '检测到第三方 provider 配置——用官方账号报 401 时先核对它', 'docs/04-config.md');
      // 提取第一个中转 base_url（供网络探测感知中转模式）
      let inProvider = false;
      for (const raw of content.split(/\r?\n/)) {
        const l = raw.trim();
        if (/^\[model_providers\./.test(l)) {
          inProvider = true;
          continue;
        }
        if (/^\[/.test(l)) {
          inProvider = false;
          continue;
        }
        if (inProvider) {
          const m = l.match(/^base_url\s*=\s*["']([^"']+)["']/);
          if (m && !relayUrl) relayUrl = m[1];
        }
      }
    }
    if (relayUrl && !network) {
      add('relay', 'info', `检测到第三方中转端点 ${safeHost(relayUrl)}（--no-network 未探测）`, 'docs/04-config.md');
    }
  } else {
    add('config', 'info', 'config.toml 不存在（使用默认配置，不一定是问题）');
  }

  // 4. 凭据
  const auth = path.join(CODEX_DIR, 'auth.json');
  add(
    'auth',
    exists(auth) ? 'ok' : 'warn',
    exists(auth) ? 'auth.json 存在（内容不读取）' : 'auth.json 不存在——尚未登录或已清除，运行 codex login',
    'docs/02-login-auth.md'
  );

  // 4b. 登录态有效期（解码 auth.json 中 id_token 的 exp 声明，不输出任何敏感内容）
  if (exists(auth)) {
    try {
      const j = JSON.parse(fs.readFileSync(auth, 'utf8'));
      const idToken = j?.tokens?.id_token;
      if (typeof idToken === 'string' && idToken.split('.').length >= 2) {
        const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8'));
        if (typeof payload?.exp === 'number') {
          const days = Math.floor((payload.exp * 1000 - Date.now()) / 86400e3);
          if (days < 0) {
            add('auth-expiry', 'warn', `登录态已过期 ${-days} 天——重新 codex login 即可`, 'docs/02-login-auth.md');
          } else if (days <= 7) {
            add('auth-expiry', 'warn', `登录态将于 ${days} 天内过期——建议尽快 codex login 刷新`, 'docs/02-login-auth.md');
          } else {
            add('auth-expiry', 'ok', `登录态剩余约 ${days} 天`);
          }
        }
      }
    } catch {
      /* auth.json 结构不符或解析失败则静默跳过 */
    }
  }

  // 5. 环境变量
  if (process.env.OPENAI_API_KEY) add('env-key', 'ok', 'OPENAI_API_KEY 已设置（值不显示）');
  else add('env-key', 'info', 'OPENAI_API_KEY 未设置（ChatGPT 登录方式无需设置）');
  if (process.env.OPENAI_BASE_URL) {
    add('env-url', 'warn', `OPENAI_BASE_URL=${process.env.OPENAI_BASE_URL}——会改变请求端点，401 排障重点`, 'docs/02-login-auth.md');
  }
  const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  add(
    'proxy',
    proxy ? 'ok' : 'info',
    proxy ? `代理已设置: ${proxy}` : '未设置 HTTP(S)_PROXY（直连网络；受限网络用户报断流先看代理）',
    'docs/03-network-proxy.md'
  );

  // 5b. Windows 系统代理（解释「系统有代理但终端不通」类现象）
  if (process.platform === 'win32') {
    const q = runShell('reg query "HKCU\\Internet Settings" /v ProxyEnable');
    if (q && /0x1\b/.test(q)) {
      const ps = runShell('reg query "HKCU\\Internet Settings" /v ProxyServer');
      const server = ps ? (ps.split(/\r?\n/).find((l) => /ProxyServer/i.test(l)) || '').trim().split(/\s+/).pop() : '';
      add(
        'sysproxy',
        'info',
        `Windows 系统代理已开启（${server || '已启用'}）——命令行程序不一定走系统代理，终端报断流先设置 HTTP(S)_PROXY`,
        'docs/03-network-proxy.md'
      );
    }
  }

  // 5c. Windows PowerShell 执行策略（npm 方式安装的常见拦截点）
  if (process.platform === 'win32') {
    const pol = runShell('powershell -NoProfile -Command Get-ExecutionPolicy');
    if (pol && /restricted/i.test(pol)) {
      add('ps-policy', 'warn', `PowerShell 执行策略为 ${pol.trim()}——npm 方式的 codex.ps1 会被拦截`, 'docs/01-installation.md');
    }
  }

  // 6. 网络连通性（中转模式感知）+ codex 版本过期检测
  if (network) {
    if (relayUrl) {
      // 中转用户：探测配置里的中转端点；官方端点降级为参考信息
      const rr = await probeWithRetry(relayUrl);
      add(
        'relay',
        rr.ok ? 'ok' : 'fail',
        rr.ok
          ? `中转端点可达: ${safeHost(relayUrl)} → HTTP ${rr.code}`
          : `中转端点不可达: ${safeHost(relayUrl)}（${rr.err}）——中转用户断流先查这里`,
        'docs/04-config.md'
      );
      const rs = await Promise.all(['https://chatgpt.com', 'https://api.openai.com'].map((u) => probe(u).then((r) => ({ u, r }))));
      for (const { u, r } of rs) {
        add(
          'net',
          'info',
          `官方端点 ${u} → ${r.ok ? `HTTP ${r.code}` : '不可达'}（中转模式下属预期，仅供参考）`,
          'docs/03-network-proxy.md'
        );
      }
    } else {
      const targets = ['https://chatgpt.com', 'https://api.openai.com'];
      const rs = await Promise.all(targets.map((u) => probeWithRetry(u).then((r) => ({ u, r }))));
      for (const { u, r } of rs) {
        add('net', r.ok ? 'ok' : 'fail', r.ok ? `${u} → HTTP ${r.code}` : `${u} → 不通（${r.err}）`, 'docs/03-network-proxy.md');
      }
    }

    if (codexVer) {
      const local = (codexVer.match(/(\d+\.\d+\.\d+)/) || [])[1];
      const latest = await fetchLatestCodexVersion();
      if (local && latest) {
        if (compareSemver(local, latest) < 0) {
          add('codex-newer', 'warn', `codex 版本偏旧：本地 ${local}，最新稳定版 ${latest}——建议升级`, 'docs/01-installation.md');
        } else {
          add('codex-newer', 'ok', `codex 版本为最新稳定版（${local}）`);
        }
      }
    }
  }

  // 7. 磁盘空间
  try {
    if (typeof fs.statfsSync === 'function') {
      const s = fs.statfsSync(HOME);
      const freeGB = (s.bsize * s.bfree) / 1024 ** 3;
      add('disk', freeGB >= 5 ? 'ok' : 'warn', `HOME 所在分区剩余约 ${freeGB.toFixed(1)} GB`);
    }
  } catch {
    /* 平台不支持则跳过 */
  }

  // 8. OneDrive 已知坑
  const oneDrive = process.env.OneDrive;
  if (oneDrive && process.platform === 'win32') {
    const norm = (p) => path.resolve(String(p)).toLowerCase();
    if (norm(CODEX_DIR).startsWith(norm(oneDrive))) {
      add('onedrive', 'fail', '~/.codex 在 OneDrive 同步范围内——凭据/配置被同步盘接管，务必移出', 'docs/09-maintenance.md');
    } else if (norm(process.cwd()).startsWith(norm(oneDrive))) {
      add('onedrive', 'warn', '当前目录在 OneDrive 内——同步盘文件锁是 stream disconnected 的高发原因', 'docs/03-network-proxy.md');
    } else {
      add('onedrive', 'info', `OneDrive 存在（${oneDrive}）：项目与 ~/.codex 请勿放入其中`, 'docs/03-network-proxy.md');
    }
  }

  // 9. WSL 运行开关（Windows 特有状态文件）
  const gs = path.join(CODEX_DIR, 'codex-global-state.json');
  if (exists(gs)) {
    try {
      const j = JSON.parse(fs.readFileSync(gs, 'utf8'));
      if (j.runCodexInWindowsSubsystemForLinux === true) {
        add('wsl-state', 'warn', 'runCodexInWindowsSubsystemForLinux=true（CLI 跑在 WSL）；IDE 进不去/崩溃可改回 false', 'docs/10-ide-vscode.md');
      } else {
        add('wsl-state', 'ok', 'codex-global-state.json 正常（未启用 WSL 运行模式）');
      }
    } catch {
      add('wsl-state', 'warn', 'codex-global-state.json 无法解析');
    }
  }

  // 10. sessions 体积
  const sess = path.join(CODEX_DIR, 'sessions');
  if (exists(sess)) {
    const mb = dirBytes(sess) / 1024 / 1024;
    add(
      'sessions',
      mb >= 500 ? 'warn' : 'ok',
      `sessions 目录约 ${mb.toFixed(1)} MB${mb >= 500 ? '——可运行 codex-doctor clean sessions 归档' : ''}`,
      'docs/09-maintenance.md'
    );
  }

  return results;
}

export function summarize(results) {
  const c = { pass: 0, warn: 0, fail: 0, info: 0 };
  for (const r of results) {
    if (r.status === 'ok') c.pass++;
    else c[r.status]++;
  }
  return c;
}

export function renderHuman(results, summary) {
  const sym = { ok: '[OK]  ', warn: '[WARN]', fail: '[FAIL]', info: '[--]  ' };
  // 检查项所属分组（按 id），输出时分节展示
  const SECTION_OF = {
    codex: '基础环境', node: '基础环境', 'codex-newer': '基础环境',
    codexdir: '配置与凭据', config: '配置与凭据', 'config-roots': '配置与凭据',
    providers: '配置与凭据', relay: '配置与凭据', auth: '配置与凭据', 'auth-expiry': '配置与凭据',
    'env-key': '环境变量', 'env-url': '环境变量', proxy: '环境变量', sysproxy: '环境变量',
    net: '网络',
    disk: '系统', onedrive: '系统坑位', 'wsl-state': '系统坑位', 'ps-policy': '系统坑位', sessions: '维护',
  };
  const ORDER = ['基础环境', '配置与凭据', '环境变量', '网络', '系统', '系统坑位', '维护', '其他'];
  const groups = new Map();
  for (const r of results) {
    const s = SECTION_OF[r.id] || '其他';
    if (!groups.has(s)) groups.set(s, []);
    groups.get(s).push(r);
  }
  const lines = ['codex-doctor - Codex 环境自检', ''];
  for (const section of ORDER) {
    const items = groups.get(section);
    if (!items) continue;
    lines.push(`—— ${section} ——`);
    for (const r of items) {
      lines.push(`${sym[r.status]} ${r.detail}${r.doc ? `  → ${r.doc}` : ''}`);
    }
    lines.push('');
  }
  lines.push(`======== 汇总：通过 ${summary.pass}   警告 ${summary.warn}   失败 ${summary.fail} ========`);
  lines.push('WARN/FAIL 项请对照 docs/ 下对应文档处理；提 Issue 时请附完整输出（脱敏后）。');
  return lines.join('\n');
}
