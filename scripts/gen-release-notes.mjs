#!/usr/bin/env node
// 从 CHANGELOG.md 提取版本小节，生成 GitHub Release 说明。
// 用法：node scripts/gen-release-notes.mjs [--changelog CHANGELOG.md] [--at 1.28.0] [--out FILE]
//   默认取最新（第一个）小节；--at 指定版本；--out 写文件（供 gh release create --notes-file 使用）
import fs from 'node:fs';

const args = process.argv.slice(2);
function argOf(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}

const file = argOf('--changelog') || 'CHANGELOG.md';
const at = argOf('--at');
const out = argOf('--out');

const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
const starts = [];
lines.forEach((l, i) => {
  const m = l.match(/^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})/);
  if (m) starts.push({ ver: m[1], date: m[2], line: i });
});

if (starts.length === 0) {
  console.error('CHANGELOG 中没有找到任何版本小节（期望格式：## [x.y.z] - YYYY-MM-DD）');
  process.exit(1);
}
const pick = at ? starts.find((s) => s.ver === at) : starts[0];
if (!pick) {
  console.error(`没有找到版本 ${at} 的小节。可用版本：${starts.map((s) => s.ver).join(', ')}`);
  process.exit(1);
}
const next = starts.find((s) => s.line > pick.line);
const body = lines.slice(pick.line + 1, next ? next.line : lines.length);

const outLines = [];
outLines.push(`## codex-doctor v${pick.ver}（${pick.date}）`);
outLines.push('');
for (const l of body) outLines.push(l.trimEnd());
outLines.push('');
outLines.push('---');
outLines.push('- 📖 在线手册：<https://qlw088697-ui.github.io/codex-troubleshooting/>');
outLines.push(`- 📦 使用：\`npx -y @qqq123456789/codex-doctor@${pick.ver}\`（零依赖，Node 18.15+）`);
outLines.push('- 📄 Release 附件含合并排版的离线 PDF 手册（release-pdf 工作流在发布后数分钟内自动附上）');
outLines.push('- 完整变更史：[CHANGELOG.md](https://github.com/qlw088697-ui/codex-troubleshooting/blob/main/CHANGELOG.md)');

const content = outLines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
if (out) {
  fs.writeFileSync(out, content, 'utf8');
  console.log(`已生成 Release 说明（v${pick.ver}）→ ${out}`);
} else {
  process.stdout.write(content);
}
