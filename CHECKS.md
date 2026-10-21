# CHECKS.md — human checks

`mox check` imports the open items below into the attention queue (nothing else
in this file is parsed). Add a line whenever a human must verify something the
agent cannot: a VPS service or cron, an API key/quota, a deploy, a data sample.

Format — one check per line, only the title is required:

```text
- [ ] Short imperative title | due: +2h | kind: vps | priority: high | detail: what to look at | every: 1d | probe: systemctl is-active fetcher
```

* `due`: `+30m`, `+2h`, `+3d`, `+1w`, `now`, or an RFC3339 timestamp. Omit for
  "whenever you get to it".
* `kind`: `vps`, `api`, `deploy`, `manual`, `data`, `security`, `other`.
* `priority`: `low`, `normal`, `high`, `critical`.
* `detail`: one extra sentence, no secrets.
* `every`: recurrence (`1d`, `12h`); marking it done reschedules it.
* `probe`: read-only VPS check. Supported forms:
  `systemctl is-active <unit>`, `disk_free > 5G`, `http 200 https://…`.
  `mox check probe` marks failures due now with high priority.

Rules:

* Never put tokens, keys, passwords or personal data in this file.
* Mark a line `- [x]` only after the human confirmed; `mox` ignores those.
* Keep titles short and actionable ("Verify the fetcher cron ran", not "VPS").
* Re-running sync refreshes an open item with the same title; done items stay
  done.
