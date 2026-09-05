#!/usr/bin/env bash
# codex-doctor CLI 夹具测试：在临时 HOME 下验证各命令的真实行为
# 用法：bash scripts/test-codex-doctor.sh   （本地与 CI 通用）
set -e
cd "$(dirname "$0")/.."

FIX="$(mktemp -d)"
trap 'rm -rf "$FIX"' EXIT
mkdir -p "$FIX/.codex/sessions/2026/01" "$FIX/.codex/log"
printf 'model = "gpt-x"\n\n[model_providers.a]\nname = "a"\nbase_url = "https://relay.example.com/v1"\nenv_key = "RELAY_KEY"\nmodel = "y"\n\n[mcp_servers.demo]\ncommand = "npx"\n\n[mcp_servers.demo.env]\nDEMO_VAR = "1"\n' > "$FIX/.codex/config.toml"
echo '{"OPENAI_API_KEY":null}' > "$FIX/.codex/auth.json"
echo old-session > "$FIX/.codex/sessions/2026/01/old.jsonl"
touch -d "2026-01-01" "$FIX/.codex/sessions/2026/01/old.jsonl"
echo recent > "$FIX/.codex/log/recent.log"

export USERPROFILE="$FIX" HOME="$FIX"
cli() { node tool/cli.mjs "$@"; }

fail() { echo "TEST FAIL: $1"; exit 1; }

# 1) doctor：识别夹具里「根级键写在 [表] 之后」的问题（runner 上 codex 缺失导致的 fail 属预期）
cli doctor --no-network --json > "$FIX/doctor.json" || true
FIX="$FIX" node -e "
const fs = require('fs');
const d = JSON.parse(fs.readFileSync(process.env.FIX + '/doctor.json', 'utf8'));
const r = (d.results || []).find(x => x.id === 'config-roots');
if (!r || r.status !== 'warn') process.exit(1);
console.log('ok 1/14: doctor 识别根级键位置问题');
"

# 2) clean 预演：列出现旧文件、不移动任何东西
OUT=$(cli clean sessions --days 30)
echo "$OUT" | grep -q "old.jsonl" || fail "预演未列出旧文件"
echo "$OUT" | grep -q "预演模式" || fail "未进入预演模式"
[ -f "$FIX/.codex/sessions/2026/01/old.jsonl" ] || fail "预演模式不应移动文件"
echo "ok 2/14: clean 预演"

# 3) clean --yes：归档保持相对结构，原位置清空
cli clean sessions --days 30 --yes > /dev/null
[ -f "$FIX"/.codex/archive/sessions-*/2026/01/old.jsonl ] || fail "归档文件缺失"
[ ! -f "$FIX/.codex/sessions/2026/01/old.jsonl" ] || fail "原文件未移除"
echo "ok 3/14: clean 归档"

# 4) backup / restore 往返
cli backup --out "$FIX/bk" > /dev/null
rm "$FIX/.codex/auth.json"
cli restore "$FIX/bk" > /dev/null
[ -f "$FIX/.codex/auth.json" ] || fail "恢复后 auth.json 缺失"
echo "ok 4/14: backup/restore 往返"

# 5) help 与未知命令
cli help | grep -q "codex-doctor" || fail "help 输出异常"
cli definitely-not-a-command >/dev/null 2>&1 && fail "未知命令应返回非零退出码" || true
echo "ok 5/14: help 与未知命令"

# 6) archive 管理：list 显示归档目录、delete --all 清空
cli archive list | grep -q "sessions-" || fail "archive list 未显示归档目录"
cli archive delete --all --yes > /dev/null
[ -z "$(ls -A "$FIX/.codex/archive" 2>/dev/null)" ] || fail "archive delete 未清空归档"
echo "ok 6/14: archive 管理"

# 7) 中转模式感知：--no-network 下也应识别 provider 的 base_url
cli doctor --no-network --json > "$FIX/doctor2.json" || true
FIX="$FIX" node -e "
const fs = require('fs');
const d = JSON.parse(fs.readFileSync(process.env.FIX + '/doctor2.json', 'utf8'));
const r = (d.results || []).find(x => x.id === 'relay');
if (!r || !/relay\.example\.com/.test(r.detail)) process.exit(1);
console.log('ok 7/14: 中转模式感知');
"

# 8) 登录态有效期：构造 exp 已过期的 id_token，doctor 应报 warn
B64() { node -e "process.stdout.write(Buffer.from(JSON.stringify(JSON.parse(process.argv[1]))).toString('base64url'))" "$1"; }
H=$(B64 '{"alg":"none","typ":"JWT"}')
P=$(B64 '{"exp":1000000000,"email":"redacted@example.com"}')
printf '{"tokens":{"id_token":"%s.%s.sig"},"OPENAI_API_KEY":null}' "$H" "$P" > "$FIX/.codex/auth.json"
cli doctor --no-network --json > "$FIX/doctor3.json" || true
FIX="$FIX" node -e "
const fs = require('fs');
const d = JSON.parse(fs.readFileSync(process.env.FIX + '/doctor3.json', 'utf8'));
const r = (d.results || []).find(x => x.id === 'auth-expiry');
if (!r || r.status !== 'warn' || !/过期/.test(r.detail)) process.exit(1);
console.log('ok 8/14: 登录态过期检测');
"

# 9) sessions：夹具会话（明文 JSONL）可被列出，且跳过环境包装找到真实提问
mkdir -p "$FIX/.codex/sessions/2026/09/05"
printf '%s\n' \
  '{"timestamp":"2026-09-05T01:00:00Z","type":"session_meta","payload":{"timestamp":"2026-09-05T01:00:00Z","cwd":"D:/projA","originator":"Codex Desktop"}}' \
  '{"timestamp":"2026-09-05T01:00:01Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"<environment_context><cwd>D:/projA</cwd></environment_context>"}]}}' \
  '{"timestamp":"2026-09-05T01:00:02Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"帮我写个 TODO 应用"}]}}' \
  > "$FIX/.codex/sessions/2026/09/05/rollout-test.jsonl"
cli sessions -n 5 | grep -q "帮我写个 TODO 应用" || fail "sessions 未列出会话预览"
cli sessions --dir projA -n 5 | grep -q "projA" || fail "sessions --dir 过滤失败"
echo "ok 9/14: sessions 浏览"

# 10) sessions --search：按关键词找到会话
mkdir -p "$FIX/.codex/sessions/2026/09/04"
printf '%s\n' \
  '{"timestamp":"2026-09-04T09:00:00Z","type":"session_meta","payload":{"timestamp":"2026-09-04T09:00:00Z","cwd":"D:/projB","originator":"Codex CLI"}}' \
  '{"timestamp":"2026-09-04T09:00:01Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"修复 CODEXSEARCHKEYWORD 相关的回归问题"}]}}' \
  '{"timestamp":"2026-09-04T09:00:05Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"已定位并修复该回归问题。"}]}}' \
  > "$FIX/.codex/sessions/2026/09/04/rollout-search.jsonl"
cli sessions --search codexsearchkeyword -n 5 | grep -q "回归问题" || fail "sessions --search 未命中"
echo "ok 10/14: sessions 关键词搜索"

# 11) sessions --show：展示命中会话的完整对话（用户与 Codex 双方）
SHOW_OUT=$(cli sessions --show --search codexsearchkeyword)
echo "$SHOW_OUT" | grep -q "\[用户\]" || fail "show 未展示用户消息"
echo "$SHOW_OUT" | grep -q "\[Codex\]" || fail "show 未展示 Codex 消息"
echo "$SHOW_OUT" | grep -q "已定位并修复" || fail "show 未展示 Codex 回复内容"
echo "ok 11/14: sessions --show 对话查看"

# 12) sessions --out：导出 Markdown 文件
cli sessions --show --search codexsearchkeyword --out "$FIX/export.md" | grep -q "已导出" || fail "导出未确认"
[ -f "$FIX/export.md" ] || fail "导出文件缺失"
grep -q "## 用户" "$FIX/export.md" || fail "导出内容缺少用户消息"
grep -q "已定位并修复" "$FIX/export.md" || fail "导出内容缺少 Codex 消息"
echo "ok 12/14: sessions 导出 Markdown"

# 13) config：只读摘要可解析 provider / MCP（含嵌套表）且不泄露敏感值
printf '%s\n' \
  '{"tokens":{"id_token":"x"},"OPENAI_API_KEY":null}' > /dev/null  # 占位保持结构可读
CFG_OUT=$(cli config)
echo "$CFG_OUT" | grep -q "中转 a: relay.example.com" || fail "config 未识别中转端点"
echo "$CFG_OUT" | grep -q "（Key 在环境变量" || fail "config 未提示 env_key 位置"
if echo "$CFG_OUT" | grep -q "sk-[A-Za-z0-9]"; then fail "config 泄露了 key"; fi
echo "ok 13/14: config 只读摘要"

# 14) doctor：MCP server 启动命令可达性（夹具用 npx，runner/本机均存在）
FIX="$FIX" node -e "
const fs = require('fs');
const d = JSON.parse(fs.readFileSync(process.env.FIX + '/doctor3.json', 'utf8'));
const r = (d.results || []).find(x => x.id === 'mcp');
if (!r || r.status !== 'ok') process.exit(1);
console.log('ok 14/14: doctor MCP 命令可达性检查');
"

echo "✅ 全部夹具测试通过"
