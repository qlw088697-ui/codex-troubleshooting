// config：只读摘要——一条命令看懂 codex 当前有效配置（敏感信息脱敏）
import fs from 'node:fs';
import path from 'node:path';
import { CODEX_DIR, exists } from './util.mjs';

function host(u) {
  try {
    return new URL(u).host;
  } catch {
    return '(无效 URL)';
  }
}

export function configSummary() {
  const lines = [];
  const cfg = path.join(CODEX_DIR, 'config.toml');
  if (!exists(cfg)) {
    lines.push('config.toml 不存在（全部使用默认配置）');
    return lines;
  }
  const content = fs.readFileSync(cfg, 'utf8');

  // 极简 TOML 分段解析：根级键 + 各表的 key=value（仅取本工具关心的键）
  const root = {};
  const tables = [];
  let cur = null;
  for (const raw of content.split(/\r?\n/)) {
    const l = raw.trim();
    if (!l || l.startsWith('#')) continue;
    const tm = l.match(/^\[([^\]]+)\]$/);
    if (tm) {
      cur = tm[1].trim();
      tables.push({ name: cur, kv: {} });
      continue;
    }
    const kv = l.match(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/);
    if (kv) {
      const key = kv[1];
      const val = kv[2].trim().replace(/^["']|["']$/g, '');
      if (cur) tables[tables.length - 1].kv[key] = val;
      else root[key] = val;
    }
  }

  lines.push(`模型: ${root.model || '(默认)'}`);
  lines.push(`provider: ${root.model_provider || 'openai（官方）'}`);
  lines.push(`审批策略: ${root.approval_policy || '(默认)'}`);
  lines.push(`沙箱模式: ${root.sandbox_mode || '(默认)'}`);

  // 只显示「两段式」表名；更深的嵌套表（如 mcp_servers.x.env）是子配置，不是实体
  const seg = (t) => t.name.split('.').length;
  const profiles = tables.filter((t) => t.name.startsWith('profiles.') && seg(t) === 2);
  if (profiles.length > 0) {
    lines.push(`profiles: ${profiles.map((t) => t.name.replace('profiles.', '')).join(', ')}`);
  }

  const providers = tables.filter((t) => t.name.startsWith('model_providers.') && seg(t) === 2);
  for (const p of providers) {
    const id = p.name.replace('model_providers.', '');
    const bu = p.kv.base_url ? host(p.kv.base_url) : '(未配置 base_url)';
    const ek = p.kv.env_key ? `（Key 在环境变量 ${p.kv.env_key}，不显示）` : '';
    lines.push(`中转 ${id}: ${bu}${ek}`);
  }

  const mcp = tables.filter((t) => t.name.startsWith('mcp_servers.') && seg(t) === 2);
  if (mcp.length > 0) {
    lines.push(`MCP servers: ${mcp.map((t) => t.name.replace('mcp_servers.', '')).join(', ')}`);
  }

  // 认证方式（不看内容，只看结构）
  const auth = path.join(CODEX_DIR, 'auth.json');
  if (exists(auth)) {
    try {
      const j = JSON.parse(fs.readFileSync(auth, 'utf8'));
      if (j.tokens) lines.push('认证: ChatGPT 账号登录');
      else if (j.OPENAI_API_KEY) lines.push('认证: API Key（已脱敏）');
    } catch {
      lines.push('auth.json 无法解析——可运行 codex-doctor auth reset 重置');
    }
  }
  return lines;
}
