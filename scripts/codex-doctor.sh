#!/usr/bin/env bash
# Codex 环境自检脚本（macOS / Linux / WSL）
# 用法：bash codex-doctor.sh
# 只读环境信息，不修改任何配置。对应文档：https://github.com/qlw088697-ui/codex-troubleshooting

PASS=0; WARN=0; FAIL=0
ok()   { echo "  [OK]   $1"; PASS=$((PASS+1)); }
warn() { echo "  [WARN] $1"; WARN=$((WARN+1)); }
bad()  { echo "  [FAIL] $1"; FAIL=$((FAIL+1)); }
section() { printf "\n== %s ==\n" "$1"; }

echo "codex-doctor - Codex 环境自检"
echo "时间: $(date '+%Y-%m-%d %H:%M')   主机: $(hostname 2>/dev/null || echo '?')"

# ---------- 1. Codex 本体 ----------
section "Codex"
if command -v codex >/dev/null 2>&1; then
  ok "codex 已安装: $(codex --version 2>/dev/null | head -1)  ($(command -v codex))"
else
  bad "codex 不在 PATH 中 —— 见 docs/01-installation.md"
fi

# ---------- 2. Node / npm ----------
section "Node / npm（npm 安装方式才需要）"
if command -v node >/dev/null 2>&1; then
  NV="$(node -v)"; MAJOR="$(echo "$NV" | sed 's/^v\([0-9]*\).*/\1/')"
  if [ "${MAJOR:-0}" -ge 20 ]; then ok "node $NV"; else warn "node $NV 版本偏低，建议 20 LTS+ —— 见 docs/01-installation.md"; fi
  if command -v npm >/dev/null 2>&1; then ok "npm $(npm -v)"; else warn "npm 不可用"; fi
else
  warn "node 未安装 —— npm 安装方式需要 Node 20+（brew/二进制方式安装 codex 则无妨）"
fi

# ---------- 3. ~/.codex 与配置 ----------
section "配置目录 (~/.codex)"
CODEX_DIR="$HOME/.codex"
if [ -d "$CODEX_DIR" ]; then
  ok "目录存在: $CODEX_DIR"
  CFG="$CODEX_DIR/config.toml"
  if [ -f "$CFG" ]; then
    ok "config.toml 存在"
    # 根级键写在 [表] 之后的典型错误（[profiles.*] 内的赋值属正常，人工甄别）
    SUSPECT="$(awk '
      /^[ \t]*\[/ {intable=1; next}
      /^[ \t]*(#|$)/ {next}
      intable && /^[ \t]*(model|model_provider|approval_policy|sandbox_mode)[ \t]*=/ {printf "        第%d行: %s\n", NR, $0}
    ' "$CFG")"
    if [ -n "$SUSPECT" ]; then
      warn "config.toml 中这些赋值出现在 [表] 之后，若本意是根级配置则不会生效（若是 [profiles.*] 内的属正常）:"
      echo "$SUSPECT"
      echo "        → 见 docs/04-config.md「根级键必须写在所有 [表] 之前」"
    else ok "未发现根级键位置问题"; fi
    if grep -qE '^[ \t]*\[model_providers\.' "$CFG"; then
      warn "检测到第三方 provider 配置 —— 用官方账号报 401 时先核对它，见 docs/04-config.md 检查清单"
    fi
  else warn "config.toml 不存在（使用默认配置，不一定是问题）"; fi
  if [ -f "$CODEX_DIR/auth.json" ]; then ok "auth.json 存在（内容不读取）"
  else warn "auth.json 不存在 —— 尚未登录或凭据已清除，运行 codex login"; fi
else
  warn "~/.codex 不存在 —— 从未运行过 codex，或已被完全重置"
fi

# ---------- 4. 环境变量 ----------
section "相关环境变量"
if [ -n "$OPENAI_API_KEY" ]; then ok "OPENAI_API_KEY 已设置（值不显示）"
else echo "  [--]   OPENAI_API_KEY 未设置（ChatGPT 登录方式无需设置）"; fi
if [ -n "$OPENAI_BASE_URL" ]; then warn "OPENAI_BASE_URL = $OPENAI_BASE_URL —— 会改变请求端点，401 排障重点检查 docs/02-login-auth.md"; fi
if [ -n "$HTTPS_PROXY" ] || [ -n "$HTTP_PROXY" ]; then ok "代理已设置: ${HTTPS_PROXY:-$HTTP_PROXY}"
else echo "  [--]   未设置 HTTP(S)_PROXY（直连网络，国内用户报断流先看 docs/03-network-proxy.md）"; fi

# ---------- 5. 网络连通性 ----------
section "网络连通性（HEAD 请求，任何 HTTP 响应都算通）"
for U in https://chatgpt.com https://api.openai.com; do
  CODE="$(curl -sI --max-time 8 -o /dev/null -w '%{http_code}' "$U" 2>/dev/null)"
  if [ -n "$CODE" ] && [ "$CODE" != "000" ]; then ok "$U  → HTTP $CODE"
  else bad "$U  → 不通（curl 码: ${CODE:-无}）—— 见 docs/03-network-proxy.md"; fi
done

# ---------- 6. 磁盘 ----------
section "磁盘空间"
FREE_KB="$(df -Pk "$HOME" 2>/dev/null | awk 'NR==2 {print $4}')"
if [ -n "$FREE_KB" ]; then
  FREE_GB=$((FREE_KB / 1048576))
  if [ "$FREE_GB" -ge 5 ]; then ok "HOME 所在分区剩余约 ${FREE_GB} GB"
  else warn "HOME 所在分区仅剩约 ${FREE_GB} GB，空间不足可能引发各种诡异问题"; fi
fi

# ---------- 7. 已知坑位（2026 高频案例） ----------
section "已知坑位（2026 高频案例）"
if grep -qi microsoft /proc/version 2>/dev/null; then
  ok "运行在 WSL 内"
  if [ ! -f "$CODEX_DIR/auth.json" ]; then
    WIN_AUTH="$(ls /mnt/c/Users/*/.codex/auth.json 2>/dev/null | head -1)"
    if [ -n "$WIN_AUTH" ]; then
      warn "WSL 内未登录，但检测到 Windows 侧凭据 —— 可复制到 ~/.codex/auth.json，见 docs/02 WSL 小节"
    fi
  fi
fi
if [ -d "$CODEX_DIR/sessions" ]; then
  SESS_MB="$(du -sm "$CODEX_DIR/sessions" 2>/dev/null | awk '{print $1}')"
  if [ -n "$SESS_MB" ] && [ "$SESS_MB" -ge 500 ]; then
    warn "sessions 目录约 ${SESS_MB} MB —— 会话历史可按 docs/09 清理归档"
  elif [ -n "$SESS_MB" ]; then
    ok "sessions 目录约 ${SESS_MB} MB"
  fi
fi

# ---------- 汇总 ----------
printf "\n======== 汇总 ========\n"
echo "通过 $PASS   警告 $WARN   失败 $FAIL"
echo "WARN/FAIL 项请对照 docs/ 下对应文档处理；提 Issue 时请附上本页完整输出（脱敏后）。"
