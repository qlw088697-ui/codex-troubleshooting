# ROADMAP — 迭代待办

> 接续迭代从这里挑活：按「价值 / 成本」自选，做完一项就在本清单勾掉并写进 `CHANGELOG.md`。
> 每轮迭代的一条龙：**实现 + 夹具测试 + 文档（中英同步）+ CHANGELOG + 版本号**，自检全绿再推送。

## 工具 codex-doctor

- [x] `history` 命令：浏览 `~/.codex/history.jsonl` 输入历史（找回"刚才想用的那条命令"）——v1.24.0 完成
- [x] doctor：MCP server 启动冒烟检查——v1.27.0 完成（`--mcp-smoke`：真实拉起 + initialize 握手，opt-in，含 args/env 解析与 Windows 空格路径修复）
- [x] `report --days N`：控制用量取证窗口；`--open` 生成后直接用系统默认程序打开——v1.26.0 完成
- [x] `sessions --stats --top N`：按总消耗排序，快速定位"最烧钱的会话"——v1.26.0 完成
- [ ] `clean` 支持 `archived_sessions/`（老版本 Codex 的归档目录，存在才处理）
- [ ] `versions --notes <tag>`：拉取指定版本 release notes 摘要，辅助评估是否值得升级
- [ ] doctor：npm 全局包健康（`npm ls -g @openai/codex` 权限/损坏检出）

## 文档

- [ ] 15 · 性能与体验：大项目变慢的常见原因、上下文压缩、模型选择对速度的影响
- [ ] 08 报错速查表持续增补：随 Issues / Discussions 高频案例更新（附实测版本号）
- [ ] 14 目录解剖随版本校对：新版本新增/移除的文件（每季度过一遍）
- [ ] README.en 的关键词与首屏描述打磨（搜索引擎友好）

## 工程化

- [x] CI 增加 Windows runner 跑夹具测试——v1.25.0 完成（`windows-fixture` job：Git Bash + Node 语法/冒烟/夹具双平台验证）
- [x] 发版自动化——v1.28.0 完成（`scripts/gen-release-notes.mjs`：CHANGELOG 小节 → Release 说明；publish 工作流推 tag 后自动创建 GitHub Release，release-pdf 随之自动附 PDF——发版只剩「推 tag」一步）
- [x] npm 包体积审计——v1.28.0 完成（`npm pack --dry-run`：77.7 kB 压缩 / 213.5 kB 解压 / 43 个文件，仅 tool + docs + README，无多余文件）
- [ ] `docs/releases.md` 生成器支持预发布版过滤开关

## 已知取舍（有意不做）

- **不做自动改配置的 `doctor --fix`**：安全默认是本项目的底线，破坏性操作永远预演制；
- **不引入第三方依赖**：零依赖是供应链承诺，宁可功能少；
- **不追踪用户数据**：所有命令本地只读/本地归档，无遥测。
