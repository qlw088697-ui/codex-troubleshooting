#!/usr/bin/env node
// codex-doctor CLI 入口：codex-doctor <command> [options]
import { collectChecks, summarize, renderHuman } from './checks.mjs';
import { cleanTarget } from './clean.mjs';
import { backupConfig, restoreBackup, resetAuth, listVersions, listArchives, deleteArchive, checkUpdate } from './ops.mjs';
import { listSessions, searchSessions, readTranscript, exportTranscriptMarkdown, sessionStats } from './sessions.mjs';
import { listLogs, resolveLogFile, tailLog, searchLogs, errorLines } from './logs.mjs';
import { buildReport } from './report.mjs';
import { configSummary } from './config.mjs';
import { CODEX_DIR, exists } from './util.mjs';
import path from 'node:path';

const VERSION = '1.6.0';

const HELP = `codex-doctor v${VERSION} — Codex CLI 维护与排障工具（零依赖）

用法: codex-doctor <command> [options]

命令:
  doctor                        全套环境自检
                                  --no-network   跳过网络探测
                                  --json         输出 JSON（供脚本消费）
                                  --strict       有 WARN 也返回非零退出码
  clean <sessions|logs>         归档超过 N 天的会话/日志（默认预演，--yes 才执行）
                                  --days N       阈值天数（sessions 默认 30，logs 默认 14）
                                  --yes          真正执行（否则仅预演）
  backup [--out DIR]            备份 config.toml + auth.json 到带时间戳目录
  restore <dir>                 从备份目录恢复
  auth reset                    备份并删除 auth.json，引导重新登录（401 终极大招）
  archive list                  查看归档目录与体积
  archive delete <名称|--all>   删除归档（需 --yes 或交互确认）
  versions [-n N]               查看 openai/codex 最近 N 个版本（默认 10）
  config                        只读摘要：模型 / provider / 审批沙箱 / profiles / 中转 / MCP / 认证方式
  sessions [-n N] [--dir 关键字] 浏览历史会话：时间、目录、来源、首条提问预览
             [--search 关键词] [--deep] 按关键词搜索会话（--deep 全文扫描）
             --show [--search 关键词] [--pick N] [--full] 查看会话完整对话
             --stats [--days 7]  会话用量统计：输入/输出/合计 tokens（429 自查）
  logs [-n N]                   列出 ~/.codex/log/ 下的日志文件（时间 / 大小）
        --tail N [--file 关键字]  查看日志末尾 N 行（默认最新一个文件，N 默认 50）
        --search 关键词 [--all]   在日志里搜关键词（默认最新一个，--all 扫全部日志）
        --errors [--all]          只看 ERROR/WARN/PANIC/FATAL 级别行（提 Issue 前取证）
  update                        查询 npm 最新版本与更新方式
  report [--out FILE]           一键生成脱敏取证报告（Markdown）：doctor + config + 报错日志 + 用量
  help                          显示本帮助

全局: --yes 跳过交互确认（非 TTY 环境必须显式提供）。设置了 CODEX_HOME 时，所有路径跟随它（默认 ~/.codex）。文档: docs/13-codex-doctor.md`;

function parseFlags(args) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--yes') flags.yes = true;
    else if (a === '--json') flags.json = true;
    else if (a === '--no-network') flags.network = false;
    else if (a === '--strict') flags.strict = true;
    else if (a === '--days') flags.days = Number(args[++i]);
    else if (a === '-n' || a === '--limit') flags.limit = Number(args[++i]);
    else if (a === '--dir') flags.dir = args[++i];
    else if (a === '--search') flags.search = args[++i];
    else if (a === '--deep') flags.deep = true;
    else if (a === '--show') flags.show = true;
    else if (a === '--pick') flags.pick = Number(args[++i]);
    else if (a === '--full') flags.full = true;
    else if (a === '--out') flags.out = args[++i];
    else if (a === '--tail') flags.tail = Number(args[++i]);
    else if (a === '--file') flags.file = args[++i];
    else if (a === '--errors') flags.errors = true;
    else if (a === '--all') flags.all = true;
    else if (a === '--stats') flags.stats = true;
    else rest.push(a);
  }
  return { flags, rest };
}

function print(lines) {
  for (const l of lines) console.log(l);
}

function fmtSize(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return `${bytes} B`;
}

async function main() {
  const cmd = process.argv[2] || 'help';
  const { flags, rest } = parseFlags(process.argv.slice(3));

  switch (cmd) {
    case 'doctor': {
      const results = await collectAndRun(flags);
      break;
    }
    case 'clean': {
      const target = rest[0];
      if (target !== 'sessions' && target !== 'logs') {
        console.error('用法: codex-doctor clean <sessions|logs> [--days N] [--yes]');
        process.exitCode = 1;
        break;
      }
      const defaultDays = target === 'logs' ? 14 : 30;
      const days = Number.isFinite(flags.days) && flags.days > 0 ? flags.days : defaultDays;
      const r = cleanTarget({ target, days, yes: flags.yes === true });
      print(r.lines);
      break;
    }
    case 'backup': {
      const r = backupConfig(flags.out);
      print(r.lines);
      if (!r.ok) process.exitCode = 1;
      break;
    }
    case 'restore': {
      const r = restoreBackup(rest[0]);
      print(r.lines);
      if (!r.ok) process.exitCode = 1;
      break;
    }
    case 'auth': {
      if (rest[0] !== 'reset') {
        console.error('用法: codex-doctor auth reset [--yes]');
        process.exitCode = 1;
        break;
      }
      const r = await resetAuth(flags.yes === true);
      print(r.lines);
      break;
    }
    case 'versions': {
      const rels = await listVersions(flags.limit);
      console.log('版本        日期        预发布');
      for (const r of rels) {
        console.log(`${r.tag.padEnd(24)} ${r.date}  ${r.prerelease ? '是' : ''}`);
      }
      break;
    }
    case 'archive': {
      const sub = rest[0];
      if (sub === 'list') {
        const r = listArchives();
        if (r.items.length > 0) {
          for (const it of r.items) {
            console.log(`${it.name.padEnd(36)} ${(it.bytes / 1024 / 1024).toFixed(1).padStart(8)} MB   ${it.files} 个文件`);
          }
        } else {
          print(r.lines);
        }
        break;
      }
      if (sub === 'delete') {
        // --all 既可作旗标解析，也兼容放在位置参数上
        const allFlag = flags.all === true || rest[1] === '--all';
        const r = await deleteArchive(rest[1], { all: allFlag, yes: flags.yes === true });
        print(r.lines);
        if (r.bad) process.exitCode = 1;
        break;
      }
      console.error('用法: codex-doctor archive <list|delete <名称|--all>> [--yes]');
      process.exitCode = 1;
      break;
    }
    case 'sessions': {
      if (flags.stats) {
        // 用量统计：窗口内每个会话的累计 tokens + 汇总（429 自查）
        const days = Number.isFinite(flags.days) && flags.days > 0 ? flags.days : 7;
        const { items, totals, skipped } = sessionStats({ days, cwdFilter: flags.dir || null });
        if (items.length === 0) {
          console.log(
            `最近 ${days} 天没有带用量数据的会话${flags.dir ? `（--dir ${flags.dir}）` : ''}${
              skipped > 0 ? `；另有 ${skipped} 个会话无 token 统计（旧版本或已截断）` : ''
            }`
          );
          break;
        }
        const fmt = (n) => n.toLocaleString('en-US');
        console.log('时间                工作目录                    输入 tokens  输出 tokens  合计 tokens');
        const rows = items.slice(0, Number.isFinite(flags.limit) && flags.limit > 0 ? flags.limit : 15);
        for (const it of rows) {
          console.log(
            `${it.date.padEnd(18)} ${it.dirName.padEnd(24).slice(0, 24)} ${fmt(it.input).padStart(12)} ${fmt(it.output).padStart(13)} ${fmt(it.total).padStart(13)}`
          );
        }
        if (items.length > rows.length) console.log(`（仅显示最近 ${rows.length} 个会话，-n 调整；汇总按全部 ${items.length} 个计）`);
        console.log(
          `\n—— 合计（最近 ${days} 天，${items.length} 个会话）：输入 ${fmt(totals.input)} / 输出 ${fmt(totals.output)} / 总计 ${fmt(totals.total)} tokens（缓存读取 ${fmt(totals.cached)}）`
        );
        if (skipped > 0) console.log(`（另有 ${skipped} 个会话无 token 统计，未计入——旧版本会话或文件被截断属正常）`);
        console.log('统计口径：每个会话取最后一条 token_count 的累计值；限额与重置时间以 /status 为准（见 docs/05）');
        break;
      }
      if (flags.show) {
        // 展示会话完整对话：默认最近一次；--search 按关键词定位；--pick N 选第 N 个命中
        const items = flags.search
          ? searchSessions({ keyword: flags.search, limit: 20, deep: true })
          : listSessions({ limit: 20 });
        if (items.length === 0) {
          console.log(flags.search ? `没有找到包含「${flags.search}」的会话` : '~/.codex/sessions 里没有会话记录');
          break;
        }
        const pick = Math.min(Math.max(Number(flags.pick) || 1, 1), items.length);
        const item = items[pick - 1];
        console.log(`== 会话 ${item.date} @ ${item.dirName} ==`);
        console.log(`文件: ${item.file}\n`);
        if (flags.out) {
          // 导出为 Markdown 文件
          const r = exportTranscriptMarkdown(item.file, flags.out, { maxLen: flags.full ? Infinity : 400 });
          if (!r) {
            console.log('（该会话没有可导出的对话消息）');
            break;
          }
          console.log(`已导出 ${r.count} 条消息 → ${r.outFile}`);
          break;
        }
        const transcript = readTranscript(item.file, { maxLen: flags.full ? Infinity : 400 });
        if (!transcript || transcript.length === 0) {
          console.log('（该会话没有可展示的对话消息）');
          break;
        }
        for (const msg of transcript) {
          const who = msg.role === 'user' ? '[用户]' : '[Codex]';
          console.log(`${who} ${msg.text}\n`);
        }
        console.log(`（共 ${transcript.length} 条消息${flags.full ? '' : '，单条超 400 字已截断，--full 查看全文'}）`);
        break;
      }
      if (flags.search) {
        const items = searchSessions({
          keyword: flags.search,
          limit: Number.isFinite(flags.limit) ? flags.limit : 10,
          deep: flags.deep === true,
        });
        if (items.length === 0) {
          console.log(
            `没有找到包含「${flags.search}」的会话${flags.deep ? '' : '（默认只搜每个文件开头部分，可加 --deep 全文搜索）'}`
          );
          break;
        }
        console.log('时间                工作目录              匹配片段');
        for (const it of items) {
          console.log(`${it.date.padEnd(18)} ${it.dirName.padEnd(20).slice(0, 20)} ${it.snippet}`);
        }
        break;
      }
      const items = listSessions({
        limit: Number.isFinite(flags.limit) ? flags.limit : 10,
        cwdFilter: flags.dir || null,
      });
      if (items.length === 0) {
        console.log(flags.dir ? `没有匹配「${flags.dir}」的会话记录` : '~/.codex/sessions 里没有会话记录');
        break;
      }
      console.log('时间                工作目录              来源              首条提问');
      for (const it of items) {
        const origin = (it.originator || '?') + (it.subagent ? '(子代理)' : '');
        console.log(
          `${it.date.padEnd(18)} ${it.dirName.padEnd(20).slice(0, 20)} ${origin.padEnd(16).slice(0, 16)} ${it.preview || ''}`
        );
      }
      console.log(`\n会话文件位于 ${path.join(CODEX_DIR, 'sessions')}（-n 条数 / --dir 按目录关键字过滤）`);
      break;
    }
    case 'logs': {
      // 三种聚焦视图：--tail / --search / --errors；都不带则列出日志文件
      if (flags.tail !== undefined) {
        const it = resolveLogFile(flags.file);
        if (!it) {
          console.log(exists(path.join(CODEX_DIR, 'log')) ? '没有匹配的日志文件（--file 按文件名关键字选择）' : '~/.codex/log 里没有日志文件');
          break;
        }
        const n = Number.isFinite(flags.tail) && flags.tail > 0 ? flags.tail : 50;
        console.log(`== ${it.rel}（${it.mtime}，${fmtSize(it.bytes)}）==`);
        for (const l of tailLog(it.file, n)) console.log(l);
        break;
      }
      if (flags.search || flags.errors) {
        if (listLogs({ limit: 1 }).length === 0) {
          console.log('~/.codex/log 里没有日志文件（还没跑过 codex，或日志已被清理/归档）');
          break;
        }
        const hits = flags.search
          ? searchLogs({ keyword: flags.search, all: flags.all === true, file: flags.file, limit: 40 })
          : errorLines({ all: flags.all === true, file: flags.file, limit: 40 });
        if (hits.length === 0) {
          console.log(
            flags.search
              ? `日志里没有「${flags.search}」${flags.all ? '' : '（默认只搜最新一个日志，--all 扫全部）'}`
              : `没有 ERROR/WARN 级别行${flags.all ? '' : '（默认只看最新一个日志，--all 扫全部）'}`
          );
          break;
        }
        if (hits[0].truncated) console.log('（日志超过 128MB，只扫描了末尾部分）');
        for (const h of hits) console.log(`${h.file}:${h.line}: ${h.text}`);
        break;
      }
      const items = listLogs({ limit: Number.isFinite(flags.limit) ? flags.limit : 10 });
      if (items.length === 0) {
        console.log('~/.codex/log 里没有日志文件（还没跑过 codex，或日志已被清理/归档）');
        break;
      }
      console.log('时间                大小        文件');
      for (const it of items) {
        console.log(`${it.mtime.padEnd(18)} ${fmtSize(it.bytes).padStart(9)}  ${it.rel}`);
      }
      console.log('\n--tail N 看末尾 / --search 关键词 / --errors 只看报错级别行（--file 按文件名选）');
      break;
    }
    case 'config': {
      for (const l of configSummary()) console.log(l);
      break;
    }
    case 'update': {
      const r = await checkUpdate(VERSION);
      print(r.lines);
      break;
    }
    case 'report': {
      const r = await buildReport({ version: VERSION, network: flags.network !== false, outFile: flags.out });
      console.log(`已生成取证报告: ${r.outFile}`);
      console.log(`包含: 环境自检 ${r.checks} 项 / 配置摘要 / 报错日志 ${r.errLines} 行${r.hasUsage ? ' / 7 天用量' : ''}`);
      console.log('敏感模式（API Key、token、邮箱）已自动脱敏；auth.json 内容不会包含。');
      console.log('分享前请快速过一遍，确认没有遗漏的敏感信息。');
      break;
    }
    case 'help':
    case '--help':
    case '-h':
      console.log(HELP);
      break;
    case '-v':
    case '--version':
      console.log(`codex-doctor v${VERSION}`);
      break;
    default:
      console.error(`未知命令: ${cmd}\n`);
      console.log(HELP);
      process.exitCode = 1;
  }
}

async function collectAndRun(flags) {
  const results = await collectChecks({ network: flags.network !== false });
  const summary = summarize(results);
  if (flags.json) {
    console.log(JSON.stringify({ results, summary }, null, 2));
  } else {
    console.log(renderHuman(results, summary));
  }
  if (summary.fail > 0 || (flags.strict && summary.warn > 0)) process.exitCode = 1;
  return { results, summary };
}

main().catch((e) => {
  console.error(`出错: ${e?.message || e}`);
  process.exitCode = 1;
});
