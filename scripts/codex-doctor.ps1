# Codex 环境自检脚本（Windows PowerShell）
# 用法：右键"使用 PowerShell 运行"，或
#   powershell -ExecutionPolicy Bypass -File codex-doctor.ps1
# 只读环境信息，不修改任何配置。对应文档：https://github.com/qlw088697-ui/codex-troubleshooting

$ErrorActionPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$script:Pass = 0; $script:Warn = 0; $script:Fail = 0
function Ok($m)   { Write-Host "  [OK]  $m";            $script:Pass++ }
function Warn($m) { Write-Host "  [WARN] $m" -F Yellow;  $script:Warn++ }
function Bad($m)  { Write-Host "  [FAIL] $m" -F Red;     $script:Fail++ }
function Section($m) { Write-Host "`n== $m ==" -F Cyan }

Write-Host "codex-doctor - Codex 环境自检" -F Cyan
Write-Host ("时间: {0}   主机: {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm'), $env:COMPUTERNAME)

# ---------- 1. Codex 本体 ----------
Section "Codex"
$codex = Get-Command codex -ErrorAction SilentlyContinue
if ($codex) {
    $v = (& codex --version) 2>$null
    Ok ("codex 已安装: {0}  ({1})" -f ($v -join ' '), $codex.Source)
} else {
    Bad "codex 不在 PATH 中 —— 见 docs/01-installation.md"
}

# ---------- 2. Node / npm ----------
Section "Node / npm（npm 安装方式才需要）"
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
    $nv = (& node -v)
    $major = [int]($nv -replace '^v(\d+)\..*','$1')
    if ($major -ge 20) { Ok "node $nv" } else { Warn "node $nv 版本偏低，建议 20 LTS+ —— 见 docs/01-installation.md" }
    $npmv = (& npm -v)
    if ($npmv) { Ok "npm $npmv" } else { Warn "npm 不可用" }
} else {
    if ($codex) { Warn "未检测到 node（二进制/brew 方式安装则无妨）" }
    else { Warn "node 未安装 —— npm 安装方式需要 Node 20+，见 docs/01-installation.md" }
}

# ---------- 3. ~/.codex 与配置 ----------
Section "配置目录 (~/.codex)"
$codexDir = Join-Path $env:USERPROFILE ".codex"
if (Test-Path $codexDir) {
    Ok "目录存在: $codexDir"
    $cfg = Join-Path $codexDir "config.toml"
    if (Test-Path $cfg) {
        Ok "config.toml 存在"
        $lines = Get-Content $cfg
        $inTable = $false; $tableSeen = $false; $suspect = @()
        for ($i = 0; $i -lt $lines.Count; $i++) {
            $l = $lines[$i].Trim()
            if ($l -match '^\[.+\]') { $inTable = $true; $tableSeen = $true; continue }
            if ($l -match '^(#|$)') { continue }
            if ($inTable -and $l -match '^(model|model_provider|approval_policy|sandbox_mode)\s*=') {
                $suspect += ("第{0}行: {1}" -f ($i+1), $l)
            }
        }
        if ($suspect.Count -gt 0) {
            Warn "config.toml 中这些赋值出现在 [表] 之后，若本意是根级配置则不会生效（若是 [profiles.*] 内的属正常）:"
            $suspect | ForEach-Object { Write-Host ("        " + $_) -F Yellow }
            Write-Host "        → 见 docs/04-config.md「根级键必须写在所有 [表] 之前」"
        } else { Ok "未发现根级键位置问题" }
        if (Select-String -Path $cfg -Pattern '^\[model_providers\.' -Quiet) {
            Warn "检测到第三方 provider 配置 —— 用官方账号报 401 时先核对它，见 docs/04-config.md 检查清单"
        }
    } else { Warn "config.toml 不存在（使用默认配置，不一定是问题）" }
    if (Test-Path (Join-Path $codexDir "auth.json")) { Ok "auth.json 存在（内容不读取）" }
    else { Warn "auth.json 不存在 —— 尚未登录或凭据已清除，运行 codex login" }
} else {
    Warn "~/.codex 不存在 —— 从未运行过 codex，或已被完全重置"
}

# ---------- 4. 环境变量 ----------
Section "相关环境变量"
$apiKey = [Environment]::GetEnvironmentVariable('OPENAI_API_KEY')
$baseUrl = [Environment]::GetEnvironmentVariable('OPENAI_BASE_URL')
if ($apiKey) { Ok "OPENAI_API_KEY 已设置（值不显示）" } else { Write-Host "  [--]  OPENAI_API_KEY 未设置（ChatGPT 登录方式无需设置）" }
if ($baseUrl) { Warn "OPENAI_BASE_URL = $baseUrl —— 会改变请求端点，401 排障重点检查 docs/02-login-auth.md" }
$proxy = $env:HTTPS_PROXY; if (-not $proxy) { $proxy = $env:HTTP_PROXY }
if ($proxy) { Ok "代理已设置: $proxy" } else { Write-Host "  [--]  未设置 HTTP(S)_PROXY（直连网络，国内用户报断流先看 docs/03-network-proxy.md）" }

# ---------- 5. 网络连通性 ----------
Section "网络连通性（HEAD 请求，任何 HTTP 响应都算通）"
foreach ($u in @('https://chatgpt.com', 'https://api.openai.com')) {
    try {
        $r = Invoke-WebRequest -Uri $u -Method Head -TimeoutSec 8 -UseBasicParsing
        Ok ("{0}  → HTTP {1}" -f $u, [int]$r.StatusCode)
    } catch {
        $resp = $_.Exception.Response
        if ($resp) { Ok ("{0}  → HTTP {1}" -f $u, [int]$resp.StatusCode) }
        else { Bad ("{0}  → 不通: {1} —— 见 docs/03-network-proxy.md" -f $u, $_.Exception.Message) }
    }
}

# ---------- 6. 磁盘 ----------
Section "磁盘空间"
$c = Get-PSDrive -Name C -ErrorAction SilentlyContinue
if ($c) {
    $freeGB = [math]::Round($c.Free/1GB, 1)
    if ($freeGB -ge 5) { Ok ("C 盘剩余 {0} GB" -f $freeGB) } else { Warn ("C 盘仅剩 {0} GB，空间不足可能引发各种诡异问题" -f $freeGB) }
}

# ---------- 汇总 ----------
Write-Host "`n======== 汇总 ========" -F Cyan
Write-Host ("通过 {0}   警告 {1}   失败 {2}" -f $script:Pass, $script:Warn, $script:Fail)
Write-Host "WARN/FAIL 项请对照 docs/ 下对应文档处理；提 Issue 时请附上本页完整输出（脱敏后）。"
