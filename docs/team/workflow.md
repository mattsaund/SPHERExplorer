# Team workflow

## Getting started (Austin)

1. Clone the repo: `git clone https://github.com/mattsaund/SPHERExplorer.git`
2. Open Claude Code in the repo folder and accept the workspace trust prompt. `CLAUDE.md` loads automatically.
3. The writing-rule hook runs `python3`. Install Python 3 if it's missing. If the hook can't run, Claude Code shows an error but doesn't block edits.
4. Put personal settings in `.claude/settings.local.json` and personal notes in `CLAUDE.local.md`. Both are gitignored.

## Roles

- Matt's Claude: data access, backend, science logic, heavy lifting.
- Austin's Claude: UI, styling, fonts, buttons, polish.
- Matt and Austin own the concept and every product decision (see Rule 1 in `CLAUDE.md`).

## Git

- Work on short-lived branches named `matt/<topic>` and `austin/<topic>`.
- Run `git pull --rebase origin main` before pushing. Merge to `main` often. Never force-push `main`.
- Commits written with Claude end with the Co-Authored-By trailer.
- Austin's side opens pull requests. Matt's Claude reviews and merges them. Matt's side may push small, checked commits straight to `main`.
- CI runs the text check, the API tests, and the web typecheck, tests, and build on every pull request.
- Avoid editing the same file at the same time, especially shared config such as `package.json`. Announce changes to shared contracts first.

## Parallel sessions on one machine

- `claude -w <name>` starts a session in its own git worktree under `.claude/worktrees/` (gitignored). New worktrees start without installed dependencies.
- Background sessions (`claude --bg "<prompt>"`) each draw on the same plan quota.

## Usage and context

- `/usage` shows plan limits. Press d or w for 24-hour or 7-day views.
- `/model` switches models. `/effort` sets reasoning depth. Opus 5.5 defaults to medium.
- `/context` shows context use. `/compact` summarizes the conversation. `/clear` starts fresh, and the old session stays resumable.
- Resuming a very long conversation uses a large share of the 5-hour limit. Prefer fresh sessions that read `CLAUDE.md` and `docs/`.

## Matt's research session

- Session ID `8cf1021e-1776-420c-937a-a5383bdbb170` holds the full research conversation behind `docs/research/`.
- Resume it with `claude --resume 8cf1021e-1776-420c-937a-a5383bdbb170` (it works from any folder on Matt's machine).

## Space Apps project page

- The Project tab opened at kickoff. It has an edit lock. Turn it on while editing so you don't overwrite each other, and save often.
