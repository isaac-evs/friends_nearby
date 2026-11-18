#!/usr/bin/env bash
# Builds the Go Lambdas into infra/.build/{api,worker}.zip (run before terraform plan/apply).
# Requires Go and zip.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
out="$root/infra/.build"
mkdir -p "$out"

for fn in api worker; do
  tmp="$(mktemp -d)"
  (cd "$root/backend" && GOOS=linux GOARCH=amd64 CGO_ENABLED=0 \
    go build -tags lambda.norpc -trimpath -o "$tmp/bootstrap" "./cmd/$fn")
  rm -f "$out/$fn.zip"
  (cd "$tmp" && zip -q -X "$out/$fn.zip" bootstrap)
  rm -rf "$tmp"
  echo "built $out/$fn.zip"
done
