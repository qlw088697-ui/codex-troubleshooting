// doctor 自检：与 scripts/codex-doctor.ps1/.sh 检查项一致，跨平台单一实现
import { execFileSync, execSync, spawn } from 'node:child_process';
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

// npm ls -g 区分「健康 / 未装 / 损坏」，需要 stdout、stderr 与退出码三者
function npmLsGlobal() {
  try {
    const out = execFileSync('npm ls -g --depth=0 @openai/codex', {
      encoding: 'utf8',
      timeout: 20000,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });
    return { code: 0, out: out.trim(), err: '' };
  } catch (e) {
    return {
      code: typeof e.code === 'number' ? e.code : e.code === 'ETIMEDOUT' ? 'timeout' : 1,
      out: String(e.stdout || '').trim(),
      err: String(e.stderr || '').trim(),
    };
  }
}

function commandExists(cmd) {
  if (/[\\\/]/.test(cmd)) return exists(cmd);
  const check = process.platform === 'win32' ? `where ${cmd}` : `command -v ${cmd}`;
  try {
    execSync(check, { stdio: 'ignore', shell: true, timeout: 8000 });
    return true;
  } catch {
    return false;
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

// 解析单行 TOML 字符串数组（["a", 'b']）——不追求完整 TOML，够用即可
function parseTomlStringArray(raw) {
  const out = [];
  const re = /"((?:[^"\\]|\\.)*)"|'([^']*)'/g;
  let m;
  while ((m = re.exec(raw)) !== null) out.push(m[1] !== undefined ? m[1].replace(/\\"/g, '"') : m[2]);
  return out;
}

// 解析单行内联表（{ KEY = "val", K2 = "v2" }）——值只用于 spawn，绝不输出
function parseTomlInlineEnv(raw) {
  const env = {};
  const re = /([A-Za-z0-9_-]+)\s*=\s*"((?:[^"\\]|\\.)*)"|([A-Za-z0-9_-]+)\s*=\s*'([^']*)'/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    const key = m[1] || m[3];
    const val = m[2] !== undefined ? m[2] : m[4];
    if (key) env[key] = val ?? '';
  }
  return env;
}

// Windows 经 shell 启动时手动拼接命令串（spawn 不接受 args 数组 + shell:true 的组合，Node 24 起弃用）
function shellJoin(cmd, args) {
  const q = (s) => (/\s/.test(s) && !/^".*"$/.test(s) ? `"${s}"` : s);
  return [cmd, ...args].map(q).join(' ');
}

// MCP 启动握手冒烟：真实拉起 server，发送 initialize，看是否按 JSON-RPC 应答。
// 只做 liveness + 握手，不做完整会话；无论结果如何都杀掉进程。env 值不进任何输出。
function smokeMcpServer(name, cmd, args, env = {}, timeoutMs = 8000) {
  return new Promise((resolve) => {
    let child;
    try {
      if (process.platform === 'win32') {
        // 带空格的命令路径必须自带引号，否则 cmd 找不到文件
        const needsQuote = /\s/.test(cmd.trim()) && !/^".*"$/.test(cmd.trim());
        const spawnCmd = needsQuote ? `"${cmd.trim()}"` : cmd;
        child = spawn(shellJoin(spawnCmd, args), {
          env: { ...process.env, ...env },
          shell: true, // Windows 上 npm 全局命令是 .cmd，必须经 shell
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
        });
      } else {
        child = spawn(cmd, args, {
          env: { ...process.env, ...env },
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
        });
      }
    } catch (e) {
      resolve({ name, ok: false, reason: `无法启动（${e.code || e.message}）` });
      return;
    }
    let done = false;
    let stderrTail = '';
    const finish = (r) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        child.kill();
      } catch {
        /* 进程已退出 */
      }
      // 主动销毁管道：server 的子进程若存活并继承句柄，不销毁会吊住本进程的事件循环
      try {
        child.stdin.destroy();
        child.stdout.destroy();
        child.stderr.destroy();
      } catch {
        /* 流已关闭 */
      }
      resolve(r);
    };
    const timer = setTimeout(
      () => finish({ name, ok: false, reason: `${timeoutMs / 1000}s 内无 initialize 应答（首次运行的 npx 下载可能超时，可重跑确认）` }),
      timeoutMs
    );
    let buf = '';
    child.stdout.on('data', (d) => {
      buf += d.toString();
      for (const line of buf.split('\n')) {
        const t = line.trim();
        if (!t) continue;
        let j;
        try {
          j = JSON.parse(t);
        } catch {
          continue;
        }
        if (j.id === 1 && j.result) {
          finish({ name, ok: true, server: j.result?.serverInfo?.name || 'ok' });
          return;
        }
        if (j.id === 1 && j.error) {
          finish({ name, ok: false, reason: `initialize 返回错误：${String(j.error.message || '?').slice(0, 80)}` });
          return;
        }
      }
    });
    child.stderr.on('data', (d) => {
      if (stderrTail.length < 200) stderrTail += d.toString();
    });
    child.on('exit', (code) => {
      if (done) return;
      if (code === 0) {
        finish({
          name,
          ok: false,
          reason: buf.length > 0 ? '进程退出且未完成 initialize 握手——非标准 MCP server 或仅由 IDE 内部拉起？' : '进程立即退出（exit 0）——不是 MCP server？',
        });
      } else {
        finish({
          name,
          ok: false,
          reason: `进程秒退（exit ${code}）${stderrTail ? `——${stderrTail.trim().split('\n').pop().slice(0, 80)}` : '——包未安装或参数错误'}`,
        });
      }
    });
    child.on('error', (e) => finish({ name, ok: false, reason: `无法启动（${e.code || e.message}）` }));
    const init = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'codex-doctor', version: '1.0.0' } },
    });
    try {
      child.stdin.write(init + '\n');
    } catch {
      /* stdin 关闭则交给 exit/timeout 路径 */
    }
  });
}

export async function collectChecks({ network = true, mcpSmoke = false } = {}) {
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

  // 2.5 npm 全局包健康（@openai/codex 损坏 / 权限问题检出；brew/二进制安装则跳过）
  if (commandExists('npm')) {
    const r = npmLsGlobal();
    const m = r.out.match(/@openai\/codex@(\S+)/);
    if (r.code === 0 && m) {
      add('npm-global', 'ok', `npm 全局包健康: @openai/codex@${m[1]}`, 'docs/01-installation.md');
    } else if (r.code === 'timeout') {
      add('npm-global', 'warn', 'npm ls 超时（20s）——全局 npm 目录可能被权限或安全软件卡住，升级失灵时优先查它', 'docs/01-installation.md');
    } else if (r.code !== 0 && /\(empty\)/.test(r.out)) {
      add('npm-global', 'info', 'npm 全局未安装 @openai/codex（可能通过 brew/二进制安装，跳过）');
    } else if (r.code !== 0) {
      const why = (r.err || r.out || '').split(/\r?\n/).filter(Boolean).slice(0, 2).join(' / ').slice(0, 160);
      add('npm-global', 'fail', `npm 全局包异常（权限/损坏）：${why || `exit ${r.code}`}——重装可解：npm i -g @openai/codex`, 'docs/01-installation.md');
    } else {
      add('npm-global', 'warn', `npm ls 输出无法识别：${(r.out || '(空)').slice(0, 80)}`, 'docs/01-installation.md');
    }
  } else {
    add('npm-global', 'info', '未检测到 npm（brew/二进制方式安装 codex 则无妨）');
  }

  // 3. 配置目录与 config.toml
  if (process.env.CODEX_HOME) {
    add('codex-home', 'info', `CODEX_HOME 已设置：${CODEX_DIR}（以下检查全部跟随该目录）`, 'docs/14-codex-home-anatomy.md');
  }
  if (exists(CODEX_DIR)) {
    add('codexdir', 'ok', `Codex 主目录存在: ${CODEX_DIR}${process.env.CODEX_HOME ? '（来自 CODEX_HOME）' : ''}`);
  } else {
    add(
      'codexdir',
      'warn',
      `Codex 主目录不存在：${CODEX_DIR}${process.env.CODEX_HOME ? '（CODEX_HOME 指向的目录还没创建？）' : '（从未运行过 codex，或已被完全重置）'}`
    );
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
    // MCP server 命令可达性（「工具不出现」的头号原因就是命令起不来）
    const mcpCmds = [];
    let inMcp = false;
    let mcpEntry = null;
    let inMcpEnvTable = false;
    for (const raw of content.split(/\r?\n/)) {
      const l = raw.trim();
      const tm = l.match(/^\[([^\]]+)\]$/);
      if (tm) {
        const n = tm[1].trim();
        // [mcp_servers.X.env] 多行环境变量表：值只用于 spawn，绝不输出
        const em2 = n.match(/^mcp_servers\.([^.]+)\.env$/);
        if (em2) {
          inMcp = false;
          inMcpEnvTable = true;
          mcpEntry = mcpCmds.find((x) => x.name === em2[1]) || null;
          continue;
        }
        inMcpEnvTable = false;
        inMcp = n.startsWith('mcp_servers.') && n.split('.').length === 2;
        if (inMcp) {
          if (mcpCmds.length < 5) {
            mcpEntry = { name: n.replace('mcp_servers.', ''), cmd: null, args: [], env: {} };
            mcpCmds.push(mcpEntry);
          } else mcpEntry = null;
        } else mcpEntry = null;
        continue;
      }
      if (inMcpEnvTable && mcpEntry) {
        if (!l || l.startsWith('#')) continue;
        const kv = l.match(/^([A-Za-z0-9_-]+)\s*=\s*"((?:[^"\\]|\\.)*)"|^([A-Za-z0-9_-]+)\s*=\s*'([^']*)'/);
        if (kv) mcpEntry.env[kv[1] || kv[3]] = kv[2] !== undefined ? kv[2] : (kv[4] ?? '');
        continue;
      }
      if (!inMcp || !l || l.startsWith('#') || !mcpEntry) continue;
      const cm = l.match(/^command\s*=\s*["']([^"']+)["']/);
      if (cm) mcpEntry.cmd = cm[1];
      const am = l.match(/^args\s*=\s*\[(.*)\]$/);
      if (am) mcpEntry.args = parseTomlStringArray(am[1]);
      const em = l.match(/^env\s*=\s*\{(.*)\}$/);
      if (em) mcpEntry.env = parseTomlInlineEnv(em[1]);
    }
    const mcpValid = mcpCmds.filter((x) => x.cmd);
    if (mcpValid.length > 0) {
      const missing = mcpValid.filter((x) => !commandExists(x.cmd));
      add(
        'mcp',
        missing.length === 0 ? 'ok' : 'fail',
        missing.length === 0
          ? `${mcpValid.length} 个 MCP server 的启动命令均可解析`
          : `MCP 启动命令不可解析: ${missing.map((x) => `${x.name}(${x.cmd})`).join(', ')}`,
        'docs/07-mcp.md'
      );
      if (mcpSmoke) {
        // 深检（opt-in，--mcp-smoke）：真实拉起每个 server 做 initialize 握手，区分「命令在但起不来」
        const smokeResults = [];
        for (const x of mcpValid) {
          smokeResults.push(await smokeMcpServer(x.name, x.cmd, x.args, x.env));
        }
        const passed = smokeResults.filter((r) => r.ok);
        const failed = smokeResults.filter((r) => !r.ok);
        add(
          'mcp-smoke',
          failed.length === 0 ? 'ok' : 'fail',
          failed.length === 0
            ? `MCP 启动握手 ${passed.length}/${smokeResults.length} 通过（${passed.map((r) => r.name).join(', ')}）`
            : `MCP 启动握手 ${passed.length}/${smokeResults.length} 通过（${passed.map((r) => r.name).join(', ') || '无'}）——失败: ${failed.map((r) => `${r.name}(${r.reason})`).join('；')}`,
          'docs/07-mcp.md'
        );
      }
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
    exists(auth) ? 'auth.json 存在' : 'auth.json 不存在——尚未登录或已清除，运行 codex login',
    'docs/02-login-auth.md'
  );

  // 4a. auth.json 结构校验：文件存在但损坏/空壳是 401 循环的隐形原因（只看结构，不输出任何值）
  if (exists(auth)) {
    let j = null;
    try {
      j = JSON.parse(fs.readFileSync(auth, 'utf8'));
    } catch {
      j = null;
    }
    if (j === null || typeof j !== 'object') {
      add('auth-structure', 'fail', 'auth.json 不是合法 JSON——文件疑似损坏（常见于同步盘截断、写一半崩溃），codex-doctor auth reset 重新登录', 'docs/02-login-auth.md');
    } else if (!j.tokens?.id_token && !j.OPENAI_API_KEY) {
      add('auth-structure', 'warn', 'auth.json 里没有任何登录凭据（tokens 缺失且 OPENAI_API_KEY 为空）——运行 codex login 或 codex-doctor auth reset', 'docs/02-login-auth.md');
    } else {
      add('auth-structure', 'ok', 'auth.json 结构正常（凭据存在，值不读取）');
    }
  }

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
      add('onedrive', 'fail', `Codex 主目录（${CODEX_DIR}）在 OneDrive 同步范围内——凭据/配置被同步盘接管，务必移出`, 'docs/09-maintenance.md');
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

  // 10b. log 目录体积（顺手提示一键取证命令）
  const logDir = path.join(CODEX_DIR, 'log');
  if (exists(logDir)) {
    const mb = dirBytes(logDir) / 1024 / 1024;
    if (mb >= 100) {
      add('logs', 'warn', `log 目录约 ${mb.toFixed(1)} MB——可先 codex-doctor logs --errors 取证，再 clean logs 归档`, 'docs/09-maintenance.md');
    } else if (mb > 0) {
      add('logs', 'ok', `log 目录约 ${mb.toFixed(1)} MB`);
    } else {
      add('logs', 'info', 'log 目录为空（尚未产生日志）');
    }
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
    codexdir: '配置与凭据', 'codex-home': '配置与凭据', config: '配置与凭据', 'config-roots': '配置与凭据',
    providers: '配置与凭据', relay: '配置与凭据', auth: '配置与凭据', 'auth-structure': '配置与凭据', 'auth-expiry': '配置与凭据',
    'env-key': '环境变量', 'env-url': '环境变量', proxy: '环境变量', sysproxy: '环境变量',
    net: '网络',
    disk: '系统', onedrive: '系统坑位', 'wsl-state': '系统坑位', 'ps-policy': '系统坑位', sessions: '维护', logs: '维护', 'mcp-smoke': '网络',
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
