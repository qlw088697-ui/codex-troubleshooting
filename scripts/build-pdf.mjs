#!/usr/bin/env node
// 构建《Codex CLI 维护与排障手册》离线 PDF：
//   1. 合并 README + docs/* 为带样式的单个 HTML（marked 负责 markdown 渲染，运行时经 npx 获取）
//   2. 调用本机 Edge headless 打印为 PDF
// 用法：node scripts/build-pdf.mjs   （输出 codex-troubleshooting-handbook.pdf）
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DOCS = [
  'README.md',
  'docs/01-installation.md',
  'docs/02-login-auth.md',
  'docs/03-network-proxy.md',
  'docs/04-config.md',
  'docs/05-models-limits.md',
  'docs/06-sandbox-windows.md',
  'docs/07-mcp.md',
  'docs/08-errors-quickref.md',
  'docs/09-maintenance.md',
  'docs/10-ide-vscode.md',
  'docs/11-tips.md',
  'docs/12-walkthrough.md',
  'docs/13-codex-doctor.md',
];

function renderMarkdown(md) {
  const inPath = path.join(os.tmpdir(), `cxd-${Date.now()}-${Math.random().toString(36).slice(2)}.md`);
  const outPath = inPath.replace(/\.md$/, '.html');
  fs.writeFileSync(inPath, md, 'utf8');
  try {
    execSync(`npx -y marked "${inPath}" -o "${outPath}"`, { stdio: 'pipe', shell: true });
    return fs.readFileSync(outPath, 'utf8');
  } finally {
    try { fs.rmSync(inPath); fs.rmSync(outPath); } catch {}
  }
}

function stripForPrint(md) {
  // 去掉徽章行（外链图片在打印场景无意义）与语言切换行
  return md
    .split('\n')
    .filter((l) => !l.startsWith('[![') && l !== '中文 | [English](README.en.md)' && l !== 'English | [中文](README.md)')
    .join('\n');
}

const sections = [];
for (const f of DOCS) {
  if (!fs.existsSync(f)) {
    console.error(`跳过不存在的文档: ${f}`);
    continue;
  }
  const md = stripForPrint(fs.readFileSync(f, 'utf8'));
  const title = (md.match(/^# (.+)$/m) || [])[1] || f;
  console.log(`渲染: ${f}（${title}）`);
  sections.push({ file: f, title, html: renderMarkdown(md) });
}

const date = new Date().toISOString().slice(0, 10);
const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>Codex CLI 维护与排障手册</title>
<style>
  @page { margin: 16mm 14mm; }
  body { font-family: "Microsoft YaHei", "PingFang SC", "Segoe UI", sans-serif; line-height: 1.7; color: #24292f; max-width: 880px; margin: 0 auto; font-size: 14px; }
  .cover { text-align: center; padding: 200px 0 120px; page-break-after: always; }
  .cover h1 { font-size: 34px; border: none; }
  .cover p { color: #57606a; margin: 8px 0; }
  .toc { page-break-after: always; }
  .toc li { margin: 6px 0; }
  .doc { page-break-before: always; }
  h1 { border-bottom: 2px solid #42b983; padding-bottom: 8px; }
  h2 { border-bottom: 1px solid #e1e4e8; padding-bottom: 6px; margin-top: 28px; }
  code { background: #f0f2f4; padding: 2px 5px; border-radius: 4px; font-family: Consolas, monospace; font-size: 13px; }
  pre { background: #f6f8fa; padding: 12px; border-radius: 6px; overflow: hidden; white-space: pre-wrap; word-break: break-all; }
  pre code { background: none; padding: 0; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  th, td { border: 1px solid #d0d7de; padding: 6px 10px; text-align: left; }
  th { background: #f6f8fa; }
  blockquote { border-left: 4px solid #42b983; margin: 10px 0; padding: 4px 14px; color: #57606a; background: #f8fbf9; }
  a { color: #0969da; text-decoration: none; }
</style>
</head>
<body>
  <div class="cover">
    <h1>Codex CLI 维护与排障手册</h1>
    <p>安装 · 登录认证 · 网络代理 · 配置 · 限额 · 沙箱 · MCP · 维护 · 会话回溯</p>
    <p>qlw088697-ui/codex-troubleshooting · ${date}</p>
    <p>https://qlw088697-ui.github.io/codex-troubleshooting/</p>
  </div>
  <div class="toc">
    <h2>目录</h2>
    <ol>
      ${sections.map((s) => `<li>${s.title}</li>`).join('\n      ')}
    </ol>
  </div>
  ${sections.map((s) => `<div class="doc">${s.html}</div>`).join('\n')}
</body>
</html>`;

fs.writeFileSync('codex-troubleshooting-handbook.html', html, 'utf8');
console.log(`HTML 已生成: codex-troubleshooting-handbook.html`);

const edgeCandidates = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
const edge = edgeCandidates.find((p) => fs.existsSync(p));
if (!edge) {
  console.error('未找到 Edge，可手动用浏览器打开 HTML 后打印为 PDF。');
  process.exit(1);
}
execSync(`"${edge}" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${path.resolve('codex-troubleshooting-handbook.pdf')}" "file:///${path.resolve('codex-troubleshooting-handbook.html').replace(/\\/g, '/')}"`, {
  stdio: 'ignore',
  timeout: 120000,
});
const size = fs.statSync('codex-troubleshooting-handbook.pdf').size;
console.log(`PDF 已生成: codex-troubleshooting-handbook.pdf（${(size / 1024 / 1024).toFixed(2)} MB）`);
