# CHESSTER [![Build Status](https://github.com/Lichess4545/Chesster/actions/workflows/build.yml/badge.svg?branch=main)](https://github.com/Lichess4545/Chesster/actions/workflows/build.yml) [![Test Coverage](https://codeclimate.com/github/Lichess4545/Chesster/badges/coverage.svg)](https://codeclimate.com/github/Lichess4545/Chesster/coverage)

## Introduction

This bot was created to help moderate the Lichess45+45 league.

It has a simple interface that integrates our Slack team, with Lichess and Website HTTP API.

## Development

The development shell comes from [devenv](https://devenv.sh) and loads
automatically with direnv. It provides node, yarn and a local postgres.

1. Clone this repo and run `direnv allow` (or `devenv shell`).
2. Install the yarn modules: `yarn install`.
3. Copy `.env.example` to `.env` and fill it in. You will need two Slack apps
   (Chesster itself and the one that receives forwarded messages), a heltour
   token from heltour's API Keys admin page, and a lichess token.
4. Start postgres with `devenv up -d`. It listens on `127.0.0.1:5432` with the
   role and database the default `DATABASE_URL` expects, so no `DATABASE_URL`
   is needed locally.
5. Apply migrations: `yarn run migrate`.
6. Start the bot against the development config: `yarn run start`.
7. Stop postgres with `devenv processes down`.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `LICHESS_4545_APP_TOKEN`, `LICHESS_4545_SIGNING_SECRET`, `LICHESS_4545_BOT_TOKEN` | The Chesster Slack app |
| `FORWARD_APP_TOKEN`, `FORWARD_SIGNING_SECRET`, `FORWARD_BOT_TOKEN` | The Slack app that receives forwarded messages |
| `CHESSTER_HELTOUR_TOKEN` | heltour API token |
| `CHESSTER_LICHESS_TOKEN` | lichess API token, used by the game watcher |
| `DATABASE_URL` | Postgres connection URL; `sslmode` in the query string controls SSL (defaults to SSL without certificate verification) |
| `CHESSTER_CONFIG` | `production` or `development`, selects which config in `src/config/` to run with (defaults to `production`) |

## Container image

`nix build .#container` builds an OCI image as a docker archive. On start, the image applies any pending migrations,
then runs the bot, so a new or upgraded database needs no separate migration
step. Logs go to stdout.

The build needs a hash of the dependencies in `yarn.lock`, kept in
`yarn-deps.hash`. Nobody edits it by hand: when `yarn.lock` changes, the devenv
pre-commit hook rewrites it (stage it and commit again), and on a pull request
the `Yarn deps hash` workflow pushes the fix. Fork and dependabot branches
can't be pushed to; run `ci/yarn-deps-hash.sh` and commit `yarn-deps.hash`.

`compose.local.yml` runs that image on the host network against the devenv
postgres, with the development config and the secrets in `.env`. With
`devenv up -d` running:

```
nix build .#container
open --raw result | docker load
docker compose -f compose.local.yml up
```

## Releasing

Run `release` from the devenv shell on an up-to-date `main`. It reads the
next version from the [conventional commit](https://www.conventionalcommits.org)
subjects since the last `v*` tag (`feat` is a minor, any other type a patch, `!`
or `BREAKING CHANGE` a major). It writes `CHANGELOG.md`, the version in
`package.json` and the image version `compose.yml` deploys, asks you to
confirm, then pushes `main` and the tag. Pushing
the tag runs `.github/workflows/release.yml`, which builds the image and
publishes it as `ghcr.io/lichess4545/chesster:<version>`. For a stable release
it also moves `:latest`.

`release minor` or `release v1.2.3` override the derived version. There are no
`v*` tags yet, so the first release would be derived from `0.0.0`. Name it
explicitly instead, e.g. `release v1.1.0`, since `package.json` is already at
1.0.3.

## Deployment

`compose.yml` is the production stack for Portainer. It reads its secrets
from Docker secrets, created in Portainer before the stack is deployed:

| Secret | Holds |
| --- | --- |
| `chesster_database_url` | `DATABASE_URL`; points at an external managed postgres |
| `chesster_heltour_token` | `CHESSTER_HELTOUR_TOKEN` |
| `chesster_lichess_token` | `CHESSTER_LICHESS_TOKEN` |
| `chesster_lichess_4545_app_token` | `LICHESS_4545_APP_TOKEN` |
| `chesster_lichess_4545_signing_secret` | `LICHESS_4545_SIGNING_SECRET` |
| `chesster_lichess_4545_bot_token` | `LICHESS_4545_BOT_TOKEN` |
| `chesster_forward_app_token` | `FORWARD_APP_TOKEN` |
| `chesster_forward_signing_secret` | `FORWARD_SIGNING_SECRET` |
| `chesster_forward_bot_token` | `FORWARD_BOT_TOKEN` |

The stack pins an explicit image version, which `release` updates;
redeploying the stack picks it up. The bot uses Slack socket mode, so it
exposes no ports.

The Portainer stack is created from this repo (`main`, `compose.yml`) with its
webhook enabled; the webhook URL is stored as the `PORTAINER_WEBHOOK_URL`
repo secret, so stable releases redeploy automatically.

## Useful Commands

Run these before submitting a PR:

-   `yarn test`
-   `yarn run lint`

## Website Integration

This bot utilizes the heltour api from this repo: https://github.com/cyanfish/heltour/
You will need to create a token from an installation of this app in order to access and manipulate data.

The bot should now be available for addition to your Slack Team.
