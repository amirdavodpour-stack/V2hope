#!/bin/sh
set -eu
mkdir -p /certs
if [ ! -s /certs/provider.key ] || [ ! -s /certs/provider.crt ]; then
  openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout /certs/provider.key \
    -out /certs/provider.crt \
    -days 2 \
    -subj "/CN=provider-sim" \
    -addext "subjectAltName=DNS:provider-sim,DNS:localhost,IP:127.0.0.1" \
    >/dev/null 2>&1
fi
exec node /app/provider-simulator.mjs
