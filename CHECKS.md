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

## Open items

- [ ] Deploy the web app on the VPS | due: +2h | kind: deploy | priority: high | detail: copy the web files and run deploy/deploy.sh on the server, then check https://thibautfontaine.space/eisenhower/ | probe: http 200 https://thibautfontaine.space/eisenhower/
- [ ] Check the extension in Firefox | due: +4h | kind: manual | priority: high | detail: load the unpacked extension from about:debugging, open the popup and the full matrix, and add, move and delete a task | probe: systemctl is-active eisenhower-matrix-web
- [ ] Confirm the data stays in the browser | due: +1d | kind: manual | priority: normal | detail: add a task, reload the page, export the JSON and check that the file holds the task and that no request leaves the browser | probe: systemctl is-active eisenhower-matrix-web
- [ ] Decide about the eisenhower subdomain | due: +1w | kind: manual | priority: low | detail: the subdomain does not resolve, the site is served under /eisenhower; create the DNS record and a certificate if a subdomain is wanted | probe: http 200 https://thibautfontaine.space/eisenhower/
