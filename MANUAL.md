# Continue without mox

This project is self-contained. `mox` schedules agents and tracks progress; it is
**not required** to read, edit, build, test or continue the project.

## Start OpenCode manually

Run this in the project directory:

```bash
opencode
```

Or start non-interactively and let the agent continue from the brief:

```bash
opencode run --auto "Read AGENTS.md, TASK.md, TASKS.md and MILESTONES.json. Continue from STATUS.md, keep the tests green, update the board and commit/push when done."
```

`opencode.json` in this directory supplies the project permissions; the rules in
`AGENTS.md` still apply even when mox is not running.

## Files that matter

| File | Purpose |
| --- | --- |
| `TASK.md` | Brief, constraints and definition of done |
| `TASKS.md` | Milestone checklist with estimates |
| `MILESTONES.json` | Plan and live progress board |
| `CHECKS.md` | Items a human must verify |
| `STATUS.md` | Last known state and next actions (agents keep it current) |
| `AGENTS.md` | Project rules |
| `opencode.json` | OpenCode permissions for this project |

## Progress without mox

- `MILESTONES.json` is ordinary JSON. If mox is unavailable, edit it directly:
  keep it valid, update `status`, `started_at`, `finished_at`, `actual_secs` and
  the todo flags consistently.
- Keep `STATUS.md` current: what works, what is untested, and the next three
  actions.
- Use the project's normal build/test commands and Git workflow. No mox state
  outside this directory is required.
- Never put tokens, keys, passwords or personal data in any project file.
