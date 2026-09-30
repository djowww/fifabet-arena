#!/bin/sh
set -eu

# Install as /etc/letsencrypt/renewal-hooks/deploy/fifago-reload.
# Renewing another application's certificate must not invoke this hook.
[ "${RENEWED_LINEAGE:-}" = "/etc/letsencrypt/live/betfifa.com.br" ] || exit 0
/usr/sbin/nginx -t
/bin/systemctl reload nginx
