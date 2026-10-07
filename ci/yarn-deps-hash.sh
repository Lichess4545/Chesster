#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

prefetch=(prefetch-yarn-deps)
command -v prefetch-yarn-deps >/dev/null 2>&1 || prefetch=(nix run nixpkgs#prefetch-yarn-deps --)

hash=$(nix hash convert --hash-algo sha256 --to sri "$("${prefetch[@]}" yarn.lock 2>/dev/null)")

if [[ $hash == "$(cat yarn-deps.hash 2>/dev/null)" ]]; then
  exit 0
fi
printf '%s\n' "$hash" >yarn-deps.hash
printf 'yarn-deps.hash updated to %s\n' "$hash" >&2
exit 1
