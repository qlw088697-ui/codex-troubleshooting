#!/usr/bin/env node
// codex-doctor CLI 入口：codex-doctor <command> [options]
import { collectChecks, summarize, renderHuman } from './checks.mjs';
import { cleanTarget } from './clean.mjs';
import { backupConfig, restoreBackup, resetAuth, listVersions, listArchives, deleteArchive, checkUpdate } from './ops.mjs';
import { listSessions, searchSessions } from './sessions.mjs';
import { CODEX_DIR } from './util.mjs';
import path from 'node:path';

const VERSION = '0.7.0';

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
  sessions [-n N] [--dir 关键字] 浏览历史会话：时间、目录、来源、首条提问预览
             [--search 关键词] [--deep] 按关键词搜索会话（--deep 全文扫描）
  update                        查询 npm 最新版本与更新方式
  help                          显示本帮助

全局: --yes 跳过交互确认（非 TTY 环境必须显式提供）。文档: docs/13-codex-doctor.md`;

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
    else if (a === '--out') flags.out = args[++i];
    else rest.push(a);
  }
  return { flags, rest };
}

function print(lines) {
  for (const l of lines) console.log(l);
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
        const r = await deleteArchive(rest[1], { all: rest[1] === '--all', yes: flags.yes === true });
        print(r.lines);
        if (r.bad) process.exitCode = 1;
        break;
      }
      console.error('用法: codex-doctor archive <list|delete <名称|--all>> [--yes]');
      process.exitCode = 1;
      break;
    }
    case 'sessions': {
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
    case 'update': {
      const r = await checkUpdate(VERSION);
      print(r.lines);
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
