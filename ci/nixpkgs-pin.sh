#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

rev() {
  jq -r '.nodes[.nodes.root.inputs.nixpkgs].locked.rev' "$1"
}

flake=$(rev flake.lock)
devenv=$(rev devenv.lock)

if [[ $flake == "$devenv" ]]; then
  exit 0
fi
printf 'nixpkgs pins differ: flake.lock %s, devenv.lock %s\n' "$flake" "$devenv" >&2
printf 'Run: nix flake update nixpkgs, then devenv update nixpkgs, until both match.\n' >&2
exit 1
