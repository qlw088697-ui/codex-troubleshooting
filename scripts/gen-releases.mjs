#!/usr/bin/env node
// 抓取 openai/codex 的 GitHub Releases，生成 docs/releases.md（版本追踪）
// 用法：node scripts/gen-releases.mjs
//   可选环境变量 GH_TOKEN：提高 API 限额（CI 中由 GITHUB_TOKEN 提供）
import { writeFileSync, mkdirSync } from 'node:fs';

const REPO = 'openai/codex';
const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'codex-troubleshooting',
};
if (process.env.GH_TOKEN) headers.Authorization = `Bearer ${process.env.GH_TOKEN}`;

const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=50`, { headers });
if (!res.ok) {
  console.error(`抓取失败: HTTP ${res.status} ${res.statusText}`);
  process.exit(1);
}
const releases = (await res.json()).filter((r) => !r.draft);

const rows = releases.map((r) => {
  const date = (r.published_at || '').slice(0, 10) || '—';
  const label = String(r.name || r.tag_name || '').replaceAll('|', '/');
  const desc = label.length > 60 ? label.slice(0, 60) + '…' : label;
  const pre = r.prerelease ? '是' : '';
  return `| [${r.tag_name}](${r.html_url}) | ${date} | ${pre} | ${desc} |`;
});

const out = `<!-- 本文件由 scripts/gen-releases.mjs 自动生成（CI 每周一运行），请勿手动编辑 -->
<!-- 数据源：https://github.com/${REPO}/releases -->

# Codex 版本追踪

[openai/codex](https://github.com/${REPO}) 最近 ${releases.length} 个 Release（按时间倒序）。带「预发布」标记的是 rc/beta 版本，生产环境建议用稳定版。

| 版本 | 发布日期 | 预发布 | 说明 |
|---|---|---|---|
${rows.join('\n')}
`;

mkdirSync('docs', { recursive: true });
writeFileSync('docs/releases.md', out);
console.log(`已写入 docs/releases.md（${releases.length} 个版本）`);
