# AGENTS.md — 给 AI 编码代理的仓库指南

本仓库是《Codex CLI 维护与排障手册》：纯文档 + 少量脚本，没有构建系统。你（AI 代理）在这里的任务通常是补充或修正排障案例。请遵守以下约定再动手。

## 仓库结构

- `docs/NN-*.md`：主题文档，两位序号决定顺序；新增主题接续编号
- `docs/08-errors-quickref.md` / `08-errors-quickref.en.md`：报错速查表（中/英）——**新案例必须同步进两份速查表**
- `docs/*.en.md`：英文版文档——**每篇主题文档都有英文版**，与中文版结构保持一致，两边同步改（CI 的结构一致性检查会强制校验互链）
- `scripts/`：自检与工具脚本；改动后必须保证 `bash -n`（.sh）、`node --check`（.mjs）、PowerShell 解析（.ps1）通过
- `tool/`：codex-doctor CLI（零依赖 Node 维护程序）；改动后必须全部 `node --check` 通过，并跑 `node tool/cli.mjs doctor --no-network --json` 冒烟验证；破坏性命令保持「默认预演、`--yes` 才执行」的设计
- `_sidebar.md`：站点导航，新增文档必须登记
- `index.html` + `.nojekyll`：docsify 站点（GitHub Pages），不要改动整体结构
- `.github/workflows/`：CI 与定时任务（链接检查 / 版本追踪），改动需谨慎

## 硬性规则

1. **脱敏**：绝不写入 `auth.json` 内容、API Key、token、真实邮箱、内网地址；示例 key 一律用占位符
2. **案例五要素**：症状（原样报错）、环境（Codex 版本 / OS / 终端）、原因、解决步骤、**验证方法**——没有验证步骤的解法等于没写
3. **注明版本**：版本相关行为写明实测的 Codex 版本号；不确定的事写「可能」，不要把猜测写成结论，更不要编造报错信息
4. **高风险操作**（关闭沙箱、绕过审批等）必须附风险提示
5. **双语同步**：速查表中英两份一起改；有英文版的文档两边结构保持一致
6. **链接与结构自检**：每次修改后运行 `bash scripts/check-links.sh` 和 `bash scripts/check-consistency.sh`，必须全绿——新文档要登记进 `_sidebar.md`，中英配对文档要互相链接；外链优先引用 GitHub issue、官方社区等可长期访问的来源

## 文风

- 中文为主，命令与报错原文保留英文；面向「正在排障的人」写作，先给结论再给步骤
- 尊重现有文档的小节骨架（症状/原因/解决步骤/验证），新条目融入对应主题文档而不是另起炉灶

## 提交规范

- 一类改动一个 commit，标题用 `docs:` / `feat:` / `fix:` 前缀 + 中文摘要
- CI（`.github/workflows/ci.yml`）会自动跑脚本语法与相对链接检查——推送前本地先过一遍
