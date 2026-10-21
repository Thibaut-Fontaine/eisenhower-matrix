# Deployment of the Eisenhower Matrix web app

The web app is a static site: a few HTML, CSS and JavaScript files, served by
a small systemd unit on `127.0.0.1:8792` and proxied by the existing nginx.

The subdomain `eisenhower.thibautfontaine.space` does **not** resolve yet
(`thibautfontaine.space` points at the VPS, the subdomain does not exist), so
the site is served under `/eisenhower/`. A subdomain and a certificate can be
added later with certbot once the DNS record exists; nothing in the project
depends on it.

## What is deployed

Only the web application is served. The extension files stay in the
repository and are never copied to the server.

| File | Role |
|---|---|
| `index.html` | the page |
| `app.css` | the styles |
| `boot.js` | the entry point |
| `icon.png` | the icon |
| `core/*.js` | the shared core |

The extension files (`manifest.json`, `popup.html`, `matrix.html`) are **not**
deployed.

## The commands

On the workstation, copy the web files to the server:

```bash
cd ~/mox-projects/eisenhower-matrix
rm -rf /tmp/eisenhower-matrix-web
mkdir -p /tmp/eisenhower-matrix-web
cp -a index.html app.css boot.js icon.png core /tmp/eisenhower-matrix-web/
scp -r /tmp/eisenhower-matrix-web ubuntu@vps-ovh:/tmp/eisenhower-matrix-web
scp -r deploy ubuntu@vps-ovh:/tmp/eisenhower-matrix-deploy
```

On the VPS, install everything:

```bash
ssh vps-ovh 'bash /tmp/eisenhower-matrix-deploy/deploy.sh'
```

The script:

1. installs the files in `/srv/eisenhower-matrix-web` (root, `644`/`755`);
2. installs and starts `eisenhower-matrix-web.service` on `127.0.0.1:8792`;
3. appends the `location /eisenhower/` block to the nginx site of
   `thibautfontaine.space`, after keeping a backup of the previous file;
4. runs `nginx -t` **before** the reload, and reloads nginx only if it
   passes;
5. checks that the page, the stylesheet and the core answer.

No other nginx site, service, port or firewall rule is touched.

## Manual installation

If the script does not fit, the same steps by hand:

```bash
sudo install -d -o root -g root -m 755 /srv/eisenhower-matrix-web
sudo cp -a /tmp/eisenhower-matrix-web/. /srv/eisenhower-matrix-web/
sudo install -m 644 deploy/eisenhower-matrix-web.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now eisenhower-matrix-web
sudo tee -a /etc/nginx/sites-available/thibautfontaine.space < deploy/nginx-eisenhower.conf
sudo nginx -t && sudo systemctl reload nginx
```

## Checking the deployment

```bash
systemctl is-active eisenhower-matrix-web
curl -I https://thibautfontaine.space/eisenhower/
curl -s https://thibautfontaine.space/eisenhower/ | head -20
sudo journalctl -u eisenhower-matrix-web -n 20 --no-pager
```

## Updating the site

Copy the new files and run the script again; the unit and the nginx block
are left in place, so only the files change.
