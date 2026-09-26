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
console.log('ok 1/22: doctor 识别根级键位置问题');
"

# 2) clean 预演：列出现旧文件、不移动任何东西
OUT=$(cli clean sessions --days 30)
echo "$OUT" | grep -q "old.jsonl" || fail "预演未列出旧文件"
echo "$OUT" | grep -q "预演模式" || fail "未进入预演模式"
[ -f "$FIX/.codex/sessions/2026/01/old.jsonl" ] || fail "预演模式不应移动文件"
echo "ok 2/22: clean 预演"

# 3) clean --yes：归档保持相对结构，原位置清空
cli clean sessions --days 30 --yes > /dev/null
[ -f "$FIX"/.codex/archive/sessions-*/2026/01/old.jsonl ] || fail "归档文件缺失"
[ ! -f "$FIX/.codex/sessions/2026/01/old.jsonl" ] || fail "原文件未移除"
echo "ok 3/22: clean 归档"

# 4) backup / restore 往返
cli backup --out "$FIX/bk" > /dev/null
rm "$FIX/.codex/auth.json"
cli restore "$FIX/bk" > /dev/null
[ -f "$FIX/.codex/auth.json" ] || fail "恢复后 auth.json 缺失"
echo "ok 4/22: backup/restore 往返"

# 5) help 与未知命令
cli help | grep -q "codex-doctor" || fail "help 输出异常"
cli definitely-not-a-command >/dev/null 2>&1 && fail "未知命令应返回非零退出码" || true
echo "ok 5/22: help 与未知命令"

# 6) archive 管理：list 显示归档目录、delete --all 清空
cli archive list | grep -q "sessions-" || fail "archive list 未显示归档目录"
cli archive delete --all --yes > /dev/null
[ -z "$(ls -A "$FIX/.codex/archive" 2>/dev/null)" ] || fail "archive delete 未清空归档"
echo "ok 6/22: archive 管理"

# 7) 中转模式感知：--no-network 下也应识别 provider 的 base_url
cli doctor --no-network --json > "$FIX/doctor2.json" || true
FIX="$FIX" node -e "
const fs = require('fs');
const d = JSON.parse(fs.readFileSync(process.env.FIX + '/doctor2.json', 'utf8'));
const r = (d.results || []).find(x => x.id === 'relay');
if (!r || !/relay\.example\.com/.test(r.detail)) process.exit(1);
console.log('ok 7/22: 中转模式感知');
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
console.log('ok 8/22: 登录态过期检测');
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
echo "ok 9/22: sessions 浏览"

# 10) sessions --search：按关键词找到会话
mkdir -p "$FIX/.codex/sessions/2026/09/04"
printf '%s\n' \
  '{"timestamp":"2026-09-04T09:00:00Z","type":"session_meta","payload":{"timestamp":"2026-09-04T09:00:00Z","cwd":"D:/projB","originator":"Codex CLI"}}' \
  '{"timestamp":"2026-09-04T09:00:01Z","type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"修复 CODEXSEARCHKEYWORD 相关的回归问题"}]}}' \
  '{"timestamp":"2026-09-04T09:00:05Z","type":"response_item","payload":{"type":"message","role":"assistant","content":[{"type":"output_text","text":"已定位并修复该回归问题。"}]}}' \
  > "$FIX/.codex/sessions/2026/09/04/rollout-search.jsonl"
cli sessions --search codexsearchkeyword -n 5 | grep -q "回归问题" || fail "sessions --search 未命中"
echo "ok 10/22: sessions 关键词搜索"

# 11) sessions --show：展示命中会话的完整对话（用户与 Codex 双方）
SHOW_OUT=$(cli sessions --show --search codexsearchkeyword)
echo "$SHOW_OUT" | grep -q "\[用户\]" || fail "show 未展示用户消息"
echo "$SHOW_OUT" | grep -q "\[Codex\]" || fail "show 未展示 Codex 消息"
echo "$SHOW_OUT" | grep -q "已定位并修复" || fail "show 未展示 Codex 回复内容"
echo "ok 11/22: sessions --show 对话查看"

# 12) sessions --out：导出 Markdown 文件
cli sessions --show --search codexsearchkeyword --out "$FIX/export.md" | grep -q "已导出" || fail "导出未确认"
[ -f "$FIX/export.md" ] || fail "导出文件缺失"
grep -q "## 用户" "$FIX/export.md" || fail "导出内容缺少用户消息"
grep -q "已定位并修复" "$FIX/export.md" || fail "导出内容缺少 Codex 消息"
echo "ok 12/22: sessions 导出 Markdown"

# 13) config：只读摘要可解析 provider / MCP（含嵌套表）且不泄露敏感值
printf '%s\n' \
  '{"tokens":{"id_token":"x"},"OPENAI_API_KEY":null}' > /dev/null  # 占位保持结构可读
CFG_OUT=$(cli config)
echo "$CFG_OUT" | grep -q "中转 a: relay.example.com" || fail "config 未识别中转端点"
echo "$CFG_OUT" | grep -q "（Key 在环境变量" || fail "config 未提示 env_key 位置"
if echo "$CFG_OUT" | grep -q "sk-[A-Za-z0-9]"; then fail "config 泄露了 key"; fi
echo "ok 13/22: config 只读摘要"

# 14) doctor：MCP server 启动命令可达性（夹具用 npx，runner/本机均存在）
FIX="$FIX" node -e "
const fs = require('fs');
const d = JSON.parse(fs.readFileSync(process.env.FIX + '/doctor3.json', 'utf8'));
const r = (d.results || []).find(x => x.id === 'mcp');
if (!r || r.status !== 'ok') process.exit(1);
console.log('ok 14/22: doctor MCP 命令可达性检查');
"

# 15) logs：列出日志文件（夹具 setup 已建 log/recent.log）
LOG_OUT=$(cli logs -n 5)
echo "$LOG_OUT" | grep -q "recent.log" || fail "logs 未列出日志文件"
echo "ok 15/22: logs 列表"

# 16) logs --tail：查看末尾 N 行（--file 按文件名关键字选择）
printf '%s\n' \
  "line-a" \
  "line-b" \
  "2026-09-26T10:00:00Z ERROR stream disconnected before completion" \
  "line-d" \
  "line-e" \
  > "$FIX/.codex/log/tui.log"
TAIL_OUT=$(cli logs --tail 2 --file tui)
echo "$TAIL_OUT" | grep -q "line-e" || fail "logs --tail 未显示末尾行"
echo "$TAIL_OUT" | grep -q "line-a" && fail "logs --tail 不应包含开头行"
echo "ok 16/22: logs --tail"

# 17) logs --search / --errors：默认只扫最新一个，--all 扫全部；--errors 只留报错级别行
# tui.log 刚写入即最新；关键词只放在更早的 error.log 里
printf '%s\n' \
  "2026-09-26T09:00:00Z INFO started" \
  "2026-09-26T09:01:00Z ERROR mcp server CODEXLOGKEYWORD failed to start" \
  > "$FIX/.codex/log/error.log"
touch -d "2026-01-02" "$FIX/.codex/log/error.log"
if cli logs --search codexlogkeyword | grep -q "failed to start"; then fail "默认不应扫到旧日志"; fi
cli logs --search codexlogkeyword --all | grep -q "failed to start" || fail "logs --search --all 未命中旧日志"
ERR_OUT=$(cli logs --errors --file tui)
echo "$ERR_OUT" | grep -q "stream disconnected" || fail "logs --errors 未过滤出 ERROR 行"
echo "$ERR_OUT" | grep -q "line-e" && fail "logs --errors 不应包含普通行"
echo "ok 17/22: logs 搜索与报错过滤"

# 18) doctor：log 目录体积检查项存在（doctor3.json 生成时 log 目录已有 recent.log → ok）
FIX="$FIX" node -e "
const fs = require('fs');
const d = JSON.parse(fs.readFileSync(process.env.FIX + '/doctor3.json', 'utf8'));
const r = (d.results || []).find(x => x.id === 'logs');
if (!r || r.status !== 'ok') process.exit(1);
console.log('ok 18/22: doctor 日志体积检查');
"

# 19) sessions --stats：取每个会话最后一条 token_count 的累计值并汇总（无 token_count 的会话跳过）
mkdir -p "$FIX/.codex/sessions/2026/09/25"
printf '%s\n' \
  '{"timestamp":"2026-09-25T01:00:00Z","type":"session_meta","payload":{"timestamp":"2026-09-25T01:00:00Z","cwd":"D:/projA","originator":"Codex CLI"}}' \
  '{"type":"event_msg","payload":{"type":"token_count","info":{"total_token_usage":{"input_tokens":1000,"cached_input_tokens":500,"output_tokens":100,"total_tokens":1100}}}}' \
  '{"type":"event_msg","payload":{"type":"token_count","info":{"total_token_usage":{"input_tokens":2000,"cached_input_tokens":800,"output_tokens":200,"total_tokens":2200}}}}' \
  > "$FIX/.codex/sessions/2026/09/25/rollout-stats.jsonl"
STATS_OUT=$(cli sessions --stats --days 30)
echo "$STATS_OUT" | grep -q "projA" || fail "sessions --stats 未显示工作目录"
echo "$STATS_OUT" | grep -q "2,200" || fail "sessions --stats 未取到最后累计值"
echo "$STATS_OUT" | grep -q "总计 2,200" || fail "sessions --stats 汇总不正确"
echo "$STATS_OUT" | grep -q "无 token 统计" || fail "无统计会话应提示跳过数量"
STATS_DIR=$(cli sessions --stats --days 30 --dir nomatch)
echo "$STATS_DIR" | grep -q "没有带用量数据的会话" || fail "sessions --stats --dir 无命中提示缺失"
echo "ok 19/22: sessions --stats 用量统计"

# 20) CODEX_HOME 跟随：设置后所有命令检查重定位目录而非 ~/.codex
mkdir -p "$FIX/custom-codex"
printf 'model = "gpt-x"\n\n[model_providers.b]\nname = "b"\nbase_url = "https://relay2.example.com/v1"\nmodel = "z"\n' > "$FIX/custom-codex/config.toml"
CH_OUT=$(CODEX_HOME="$FIX/custom-codex" cli config)
echo "$CH_OUT" | grep -q "relay2.example.com" || fail "config 未跟随 CODEX_HOME"
CODEX_HOME="$FIX/custom-codex" cli doctor --no-network --json > "$FIX/doctor4.json" || true
CODEX_HOME="$FIX/custom-codex" FIX="$FIX" node -e "
const fs = require('fs');
const d = JSON.parse(fs.readFileSync(process.env.FIX + '/doctor4.json', 'utf8'));
const dir = (d.results || []).find(x => x.id === 'codexdir');
const home = (d.results || []).find(x => x.id === 'codex-home');
if (!dir || dir.status !== 'ok' || !/custom-codex/.test(dir.detail)) process.exit(1);
if (!home || !/custom-codex/.test(home.detail)) process.exit(1);
console.log('ok 20/22: CODEX_HOME 跟随');
"

# 21) report：一键取证报告（分区完整 + 敏感模式自动脱敏）
printf '%s\n' "2026-09-26T10:00:00Z ERROR request failed key=sk-test123456789012345 contact me@example.com" \
  > "$FIX/.codex/log/codex-tui.log"
cli report --out "$FIX/report.md" --no-network > /dev/null
[ -f "$FIX/report.md" ] || fail "report 文件缺失"
grep -q "## 环境自检" "$FIX/report.md" || fail "report 缺少 doctor 分区"
grep -q "## 配置摘要" "$FIX/report.md" || fail "report 缺少配置分区"
grep -q "relay.example.com" "$FIX/report.md" || fail "report 应包含配置摘要里的中转信息"
grep -q "## 最近 7 天用量" "$FIX/report.md" || fail "report 缺少用量分区"
if grep -q "sk-test123456789012345" "$FIX/report.md"; then fail "report 泄露了 sk key"; fi
grep -q "sk-\*\*\*" "$FIX/report.md" || fail "report 未脱敏 sk key"
if grep -q "me@example.com" "$FIX/report.md"; then fail "report 泄露了邮箱"; fi
grep -q "内容不会出现在报告中" "$FIX/report.md" || fail "report 缺少脱敏提示"
echo "ok 21/22: report 取证报告"


# 22) doctor auth.json 结构校验：损坏（非 JSON）与空壳（无凭据）都要检出
cp "$FIX/.codex/auth.json" "$FIX/auth.json.bak-for-test"
printf '{ "tokens": {"id_token": "x' > "$FIX/.codex/auth.json"   # 截断的非 JSON
cli doctor --no-network --json > "$FIX/doctor5.json" || true
FIX="$FIX" node -e "
const fs = require('fs');
const d = JSON.parse(fs.readFileSync(process.env.FIX + '/doctor5.json', 'utf8'));
const r = (d.results || []).find(x => x.id === 'auth-structure');
if (!r || r.status !== 'fail' || !/损坏/.test(r.detail)) process.exit(1);
"
printf '{"OPENAI_API_KEY":null}' > "$FIX/.codex/auth.json"   # 空壳
cli doctor --no-network --json > "$FIX/doctor6.json" || true
FIX="$FIX" node -e "
const fs = require('fs');
const d = JSON.parse(fs.readFileSync(process.env.FIX + '/doctor6.json', 'utf8'));
const r = (d.results || []).find(x => x.id === 'auth-structure');
if (!r || r.status !== 'warn' || !/凭据/.test(r.detail)) process.exit(1);
"
mv "$FIX/auth.json.bak-for-test" "$FIX/.codex/auth.json"
echo "ok 22/22: doctor auth.json 结构校验"

echo "✅ 全部夹具测试通过"
