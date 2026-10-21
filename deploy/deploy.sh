#!/usr/bin/env bash
#
# Install the Eisenhower Matrix web app on the VPS.
#
# The script is run on the VPS, as the ubuntu user, after the web files have
# been copied to /tmp/eisenhower-matrix-web. It:
#
#   1. installs the static files in /srv/eisenhower-matrix-web
#   2. installs and starts the systemd unit on 127.0.0.1:8792
#   3. adds the nginx location, checks the configuration and reloads nginx
#   4. checks that the site answers
#
# It never touches another site, another service or the firewall.
#
# Usage: bash deploy.sh

set -euo pipefail

SITE_DIR=/srv/eisenhower-matrix-web
UNIT=/etc/systemd/system/eisenhower-matrix-web.service
STAGE=${STAGE_DIR:-/tmp/eisenhower-matrix-web}
NGINX_SITE=${NGINX_SITE:-}

log() { printf '[eisenhower-matrix] %s\n' "$*"; }

# Find the nginx file that serves thibautfontaine.space.
find_nginx_site() {
  if [ -n "$NGINX_SITE" ]; then
    printf '%s' "$NGINX_SITE"
    return 0
  fi
  local candidate
  for candidate in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*; do
    [ -f "$candidate" ] || continue
    if sudo grep -qs "thibautfontaine\.space" "$candidate"; then
      printf '%s' "$candidate"
      return 0
    fi
  done
  return 1
}

if [ ! -d "$STAGE" ]; then
  log "the staged files are missing: $STAGE"
  exit 1
fi

log "installing the static files in $SITE_DIR"
sudo install -d -o root -g root -m 755 "$SITE_DIR"
sudo cp -a "$STAGE"/. "$SITE_DIR"/
sudo find "$SITE_DIR" -type d -exec chmod 755 {} +
sudo find "$SITE_DIR" -type f -exec chmod 644 {} +

log "installing the systemd unit"
sudo install -m 644 "$(dirname "$0")/eisenhower-matrix-web.service" "$UNIT"
sudo systemctl daemon-reload
sudo systemctl enable --now eisenhower-matrix-web.service
sleep 1
systemctl is-active --quiet eisenhower-matrix-web.service || {
  log "the service did not start"
  sudo journalctl -u eisenhower-matrix-web.service -n 20 --no-pager
  exit 1
}

log "the service listens on 127.0.0.1:8792"
curl -fsS http://127.0.0.1:8792/index.html > /dev/null

log "adding the nginx location"
NGINX_SITE=$(find_nginx_site) || {
  log "no nginx file for thibautfontaine.space was found"
  log "set NGINX_SITE=/path/to/the/site.conf and run the script again"
  exit 1
}
log "the nginx site is $NGINX_SITE"
if ! sudo grep -q "location /eisenhower/" "$NGINX_SITE"; then
  sudo cp -a "$NGINX_SITE" "$NGINX_SITE.bak-$(date -u +%Y%m%dT%H%M%SZ)"
  sudo tee -a "$NGINX_SITE" < "$(dirname "$0")/nginx-eisenhower.conf" > /dev/null
  log "the location was added, the previous file is kept as a backup"
else
  log "the location is already there, nothing is changed"
fi

log "checking the nginx configuration"
sudo nginx -t

log "reloading nginx"
sudo systemctl reload nginx

log "checking the site"
curl -fsS http://127.0.0.1/eisenhower/ | head -5
curl -fsS -o /dev/null -w 'app.css: %{http_code}\n' http://127.0.0.1/eisenhower/app.css
curl -fsS -o /dev/null -w 'core/app.js: %{http_code}\n' http://127.0.0.1/eisenhower/core/app.js

log "done: the site answers on http://127.0.0.1/eisenhower/"
