#!/usr/bin/env bash
# Environment verification for Gate 0. Local only — no network, no deploy.
set -euo pipefail

fail=0
check() {
  local name="$1" cmd="$2"
  if command -v "$cmd" >/dev/null 2>&1; then
    printf '%-12s OK   %s\n' "$name" "$($cmd --version 2>/dev/null | head -n1)"
  else
    printf '%-12s MISSING (expected %s)\n' "$name" "$cmd"
    fail=1
  fi
}

echo "Verifying development environment..."
echo "-----------------------------------"
check Node node
check pnpm pnpm
check git git

echo "-----------------------------------"
if command -v node >/dev/null 2>&1; then
  node -e 'const m=process.versions.node.split(".")[0]; if(+m<20){console.error("Node >=20 required, found "+process.versions.node);process.exit(1)}'
  echo "Node major     OK   >=20"
fi

if [ "$fail" -ne 0 ]; then
  echo "Environment verification FAILED"
  exit 1
fi
echo "Environment OK"
