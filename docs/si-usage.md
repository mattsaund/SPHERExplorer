# SI usage log

Space Apps 2026 uses the term "Super Intelligence (SI)" for tools such as Claude Code. We use SI tools and label their output. This log feeds the README and the submission's SI answer.

## Tools

| Tool | Provider | Models |
|---|---|---|
| Claude Code | Anthropic | Claude Opus 5.5, Claude Fable 5.2 |

## How SI output is labeled

- Commits written or co-written by Claude end with a `Co-Authored-By` trailer.
- Source files written with Claude start with a header comment saying so.
- SI-generated images or video carry a visible watermark.
- Notable uses are logged below.

## Background research

Claude gathered the notes in `docs/research/`: SPHEREx data access, test target facts, libraries and services, and Space Apps rules and resources. Matt chose the questions and reviewed the findings. The research came before kickoff, under the Space Apps rule that lets teams research the topic. No project code was written before the event started.

## Log

| Date | Who | What Claude did | Human role |
|---|---|---|---|
| 2026-11-14 | Matt | Set up this repo: CLAUDE.md, README, docs, license, .gitignore, and the writing-rule hook. Moved the research into `docs/research/`. | Matt requested the setup and the public repo |
| 2026-11-14 | Matt | Wrote the architecture, the project skeleton (API, web app, CI, text check), and merged Austin's first pull request. | Matt and Austin set the concept and feature list. Matt named Claude the build lead |
