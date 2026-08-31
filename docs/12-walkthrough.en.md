English | [中文](12-walkthrough.md)

# 12 · Walkthrough: Building a Project from Scratch with Codex

> This walkthrough strings the manual's best practices into one complete path: from an empty directory to a working project. Exact commands depend on your version's `/help` output.

## Step 0: a clean foundation

1. Create the project in a normal user directory — **never inside OneDrive / a sync folder** (why: [03](03-network-proxy.en.md)); on Windows, prefer working inside WSL ([06](06-sandbox-windows.en.md));
2. Run the [doctor script](../scripts/codex-doctor.sh) first — confirm network and credentials are healthy before you start, so you don't troubleshoot mid-task;
3. **`git init` before launching codex** — with version control, every step the agent produces is reviewable and revertible.

## Step 1: teach it before using it

Launch `codex` in the project directory; the first command:

```text
/init
```

It scans the project and generates a starter `AGENTS.md`. Then **prune it by hand** (details in [11](11-tips.en.md)):

- Build/test commands: `npm test`, `pytest`, etc.;
- Boundaries: `never touch .env; ask me before any database migration`;
- Style: `commit messages in Chinese; validate all inputs`.

This file applies to every subsequent task — 10 minutes up front saves explanations forever after.

## Step 2: the first task

Describe it as **goal + constraints + acceptance criteria**, not one vague sentence:

```text
Implement a CLI todo tool:
1. Three subcommands: add / list / done; store data in a JSON file
2. Write tests first, then the implementation, for each command
3. Done means: npm test fully green, README has usage examples
Show me the plan first; I'll confirm before you code.
```

Make it **plan first, code second** — reviewing a plan is much faster than reviewing 500 lines of code. For daily work, `--full-auto` is the usual approval/sandbox balance (see [06](06-sandbox-windows.en.md)).

## Step 3: iteration rhythm

- **Small steps**: one feature per session, `git commit` when done. Small context = cheaper + faster + fewer stream drops ([03](03-network-proxy.en.md), [05](05-models-limits.en.md));
- **Make it prove completion**: end every task with "run the tests and paste the output" — never assume it's done;
- **Stay aligned**: unsure what it changed? `git diff` now, don't batch-review at the end.

## Step 4: sediment lessons into AGENTS.md

When it repeats the same mistake (e.g. always forgetting to format), don't correct it verbally every time — add one line to `AGENTS.md`: `run npm run lint:fix before committing`. Project memory compounds.

## Step 5: script the routine

Stable, repetitive tasks go to non-interactive mode (see [11](11-tips.en.md)):

```bash
# PR description after a dependency upgrade
codex exec "Diff package.json against the last release and write a PR description"

# Weekly report material
codex exec "Summarize this week's git log grouped by feature/fix"
```

In CI, use a read-only sandbox or a disposable container ([06](06-sandbox-windows.en.md)).

## Common mistakes checklist

| Mistake | Consequence | Instead |
|---|---|---|
| Ten requirements in one sentence | Model improvises, mass rework | Split tasks; one acceptance point at a time |
| Complaining "the model is bad" without `/status` | It was actually the wrong model/config | `/status` is always triage step one |
| Project inside OneDrive | Stream disconnects | Move it out of the sync folder |
| One session all day | Expensive, slow, fragile | Split sessions |
| Letting it hardcode API keys | Credential leak | Keys in env vars / `.env` + `.gitignore` |

## When things break

Search keywords in the [08 quick reference](08-errors-quickref.en.md); if it's not there, ask in [Discussions](https://github.com/qlw088697-ui/codex-troubleshooting/discussions) or contribute a case per [CONTRIBUTING](../CONTRIBUTING.md).
