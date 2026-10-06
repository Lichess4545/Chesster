#!/usr/bin/env bash
set -euo pipefail

readonly published_image=ghcr.io/lichess4545/chesster

refuse() {
  if [[ ${GITHUB_ACTIONS-} == true ]]; then
    printf '::error::%s\n' "$*" >&2
  else
    printf 'refusing to release: %s\n' "$*" >&2
  fi
  return 1
}

assert_ready() {
  command -v jq >/dev/null 2>&1 \
    || refuse 'jq is missing; enter the devenv shell'
}

assert_unpublished() {
  local version=${1-} reference="docker://$published_image:${1#v}"
  local -a skopeo=(skopeo) authfile=()
  command -v skopeo >/dev/null 2>&1 || skopeo=(nix run nixpkgs#skopeo --)
  if [[ -n ${GHCR_AUTHFILE-} ]]; then authfile=(--authfile "$GHCR_AUTHFILE"); fi
  "${skopeo[@]}" inspect --no-tags "${authfile[@]}" "$reference" >/dev/null 2>&1 || return 0
  refuse "$published_image:${version#v} is already published"
}

describe() {
  local version=${1-} latest
  if release-guards is-stable "$version"; then
    latest="moves to $version"
  else
    latest="unchanged -- $version is a prerelease"
  fi
  printf '%-9s %s:%s\n' image "$published_image" "${version#v}"
  printf '%-9s %s\n' ':latest' "$latest"
  printf '%-9s %s\n' compose "compose.yml deploys ${version#v}"
}

set_version() {
  local version=${1-} updated pattern="^(    image: $published_image:).*$"
  (($(grep -cE "$pattern" compose.yml) == 1)) \
    || refuse "compose.yml must have exactly one '    image: $published_image:' line"

  updated=$(jq --indent 4 --arg version "${version#v}" '.version = $version' package.json) || return 1
  printf '%s\n' "$updated" >package.json
  sed -i -E "s|$pattern|\\1${version#v}|" compose.yml
  printf 'package.json\ncompose.yml\n'
}

case ${1-} in
  assert-ready) assert_ready ;;
  assert-unpublished) assert_unpublished "${2-}" ;;
  describe) describe "${2-}" ;;
  set-version) set_version "${2-}" ;;
  image) printf '%s\n' "$published_image" ;;
  *)
    printf 'usage: release-hooks {assert-ready|assert-unpublished|describe|set-version|image} ARGUMENT\n' >&2
    exit 2
    ;;
esac
