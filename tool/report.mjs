// report：一键生成脱敏取证报告（Markdown）——提 Issue / 求助前先跑它
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { collectChecks } from './checks.mjs';
import { configSummary } from './config.mjs';
import { errorLines } from './logs.mjs';
import { sessionStats } from './sessions.mjs';
import { CODEX_DIR, timestamp } from './util.mjs';

// 常见敏感模式脱敏：API Key、Bearer token、邮箱、URL 查询参数里的凭证
export function redact(text) {
  return String(text)
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, 'sk-***')
    .replace(/Bearer\s+[A-Za-z0-9._-]{8,}/gi, 'Bearer ***')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '***@***')
    .replace(/([?&](?:key|token|api_key|apikey|access_token|refresh_token)=)[^&\s'"]+/gi, '$1***');
}

const STATUS_ZH = { ok: 'OK', warn: 'WARN', fail: 'FAIL', info: 'INFO' };

function fmtInt(n) {
  return n.toLocaleString('en-US');
}

export async function buildReport({ version, network = true, outFile = null } = {}) {
  const results = await collectChecks({ network });
  const cfgLines = configSummary().map(redact);
  const errs = errorLines({ all: true, limit: 30 });
  const stats = sessionStats({ days: 7 });

  const lines = ['# codex-doctor 取证报告', ''];
  lines.push('- 生成时间：' + new Date().toLocaleString());
  lines.push(`- 工具：codex-doctor v${version}（npm @qqq123456789/codex-doctor）`);
  lines.push(`- 操作系统：${os.platform()} ${os.release()} ${os.arch()}`);
  lines.push(`- Node：${process.version}`);
  lines.push(`- Codex 主目录：${CODEX_DIR}${process.env.CODEX_HOME ? '（来自 CODEX_HOME）' : ''}`);
  lines.push('');

  lines.push('## 环境自检（doctor）', '');
  lines.push('| 状态 | 检查项 | 说明 |');
  lines.push('|---|---|---|');
  for (const r of results) {
    // OPENAI_BASE_URL 的值可能是带凭证的中转地址，报告里一律不显示
    const detail = r.id === 'env-url' ? 'OPENAI_BASE_URL 已设置（值不显示）' : redact(r.detail);
    lines.push(`| ${STATUS_ZH[r.status] || r.status} | ${r.id} | ${detail.replaceAll('|', '\\|')} |`);
  }
  lines.push('');

  lines.push('## 配置摘要（config）', '');
  lines.push('```');
  for (const l of cfgLines) lines.push(l);
  lines.push('```');
  lines.push('');

  lines.push('## 最近的报错级别日志行', '');
  if (errs.length === 0) {
    lines.push('（log 目录里没有 ERROR/WARN/PANIC/FATAL 级别行）');
  } else {
    lines.push('```');
    for (const h of errs) lines.push(`${h.file}:${h.line}: ${redact(h.text)}`);
    lines.push('```');
    lines.push(`（共 ${errs.length} 行，已脱敏；完整日志在 ~/.codex/log/，分享前自行复核）`);
  }
  lines.push('');

  lines.push('## 最近 7 天用量', '');
  if (stats.totals) {
    lines.push(
      `- ${stats.items.length} 个会话：输入 ${fmtInt(stats.totals.input)} / 输出 ${fmtInt(stats.totals.output)} / 总计 ${fmtInt(stats.totals.total)} tokens（缓存读取 ${fmtInt(stats.totals.cached)}）`
    );
  } else {
    lines.push('（最近 7 天没有带用量数据的会话）');
  }
  lines.push('');
  lines.push('> 分享前请快速过一遍本文件，确认没有遗漏的敏感信息。`auth.json` 内容不会出现在报告中。');
  lines.push('> 求助入口：[Discussions](https://github.com/qlw088697-ui/codex-troubleshooting/discussions) / [Issues](https://github.com/qlw088697-ui/codex-troubleshooting/issues)');

  const dest = path.resolve(outFile || `codex-report-${timestamp()}.md`);
  fs.writeFileSync(dest, lines.join('\n'), 'utf8');
  return { outFile: dest, checks: results.length, errLines: errs.length, hasUsage: Boolean(stats.totals) };
}
