# Changelog

Rendered by [git-cliff](https://git-cliff.org) from the conventional commits
behind each tag. `release` rewrites this file in full on every release, so an
edit made here is lost — edit the commit messages instead.

## v1.2.3 — 2026-10-08

### Fixes

- report which Slack credential is rejected at startup ([#435](https://github.com/Lichess4545/Chesster/pull/435)) ([e659acb](https://github.com/Lichess4545/Chesster/commit/e659acbd40ccaa0aa4f76e5f7c4f7e5ba58939a4))

## v1.2.2 — 2026-10-07

### Fixes

- use the same SSL settings for migrations as for the bot ([#434](https://github.com/Lichess4545/Chesster/pull/434)) ([6adbfc9](https://github.com/Lichess4545/Chesster/commit/6adbfc9486f4aa34eadafb0203351162f2752dc0))

## v1.2.1 — 2026-10-07

### Fixes

- read DATABASE_URL_FILE when running migrations ([#433](https://github.com/Lichess4545/Chesster/pull/433)) ([f8eb2db](https://github.com/Lichess4545/Chesster/commit/f8eb2db2caeb8e66c601a4e1b178e07bce630732))

## v1.2.0 — 2026-10-07

### Features

- read secrets from Docker secret files and harden container startup ([defe0b7](https://github.com/Lichess4545/Chesster/commit/defe0b7af240ed6251d0c90c3f6d22b90ac4fe78))

### Tooling

- redeploy the Portainer stack after a release ([#431](https://github.com/Lichess4545/Chesster/pull/431)) ([23b3121](https://github.com/Lichess4545/Chesster/commit/23b31219d3cfd75f70e5dd3ad5efe490d08a0278))

## v1.1.0 — 2026-10-07

### Features

- log the database the bot connects to ([#428](https://github.com/Lichess4545/Chesster/pull/428)) ([a64dbc6](https://github.com/Lichess4545/Chesster/commit/a64dbc6a3afee4622b9dfdcfd556a8b23f640205))
- allow SSL connections to the database ([#429](https://github.com/Lichess4545/Chesster/pull/429)) ([46d2cde](https://github.com/Lichess4545/Chesster/commit/46d2cde45b51aa650ece87c20a781588fbc1c0e5))
- **breaking** — build a nix container image, release via git-cliff, configure secrets from the env ([af199ca](https://github.com/Lichess4545/Chesster/commit/af199ca3f860192e27ecc39f73c32d34d1c9267e))

### Fixes

- Fixing the config for the new sequelize requirements ([4e693c6](https://github.com/Lichess4545/Chesster/commit/4e693c662a1c7db548354a729bbbddf6ebfb296a))
- PR fixes ([b5cb293](https://github.com/Lichess4545/Chesster/commit/b5cb29314a0a34f869fef36b5f383ad57de7e082))
- removing a todo ([f05f267](https://github.com/Lichess4545/Chesster/commit/f05f2679bb0051aea1027af2a8370083000db39a))
- Remove unnecessary comments ([8961d88](https://github.com/Lichess4545/Chesster/commit/8961d88e9d02aaab5bbc08e5cd2bfbfb2b61218c))
- Remove unecessary console.logs ([677fd84](https://github.com/Lichess4545/Chesster/commit/677fd84c2106f6d265b3ad9a9b113f7b57dea6b6))
- Further PR improvements ([0e21706](https://github.com/Lichess4545/Chesster/commit/0e21706bffd64f7c0dcad9d7ef94456339022ede))
- Fix the type ([b008810](https://github.com/Lichess4545/Chesster/commit/b008810254535471acd16d04f09c10c499bb8bd6))
- Fix types for loggin ([4a6166b](https://github.com/Lichess4545/Chesster/commit/4a6166bba4dd2683a832a034d584b12918b03913))
- Update yarn and node versiohns ([5c0e55b](https://github.com/Lichess4545/Chesster/commit/5c0e55b77917a562556ba2dd3d86efbf8745de48))
- update the build ([02e1df6](https://github.com/Lichess4545/Chesster/commit/02e1df6c1d3ad70f798ebc492324789273332dff))
- Tests ([dc2250c](https://github.com/Lichess4545/Chesster/commit/dc2250c32e9cd92d4d2966e9cd459f657fdd6396))
- We shouldn't be querying lichess directly during our CI ([de1c3e0](https://github.com/Lichess4545/Chesster/commit/de1c3e0d276ac46e89f42b861f2ac74e750020a5))
- create the league directly rather than creating a slack bot for this test. ([4b16252](https://github.com/Lichess4545/Chesster/commit/4b16252206994520307aeaa896f90d35d8181469))
- Ignore this file as well ([961b91a](https://github.com/Lichess4545/Chesster/commit/961b91a2b5ea37f94c5dcd839b5e27328ab47c90))
- rebase ([2969531](https://github.com/Lichess4545/Chesster/commit/29695310fee9e19aec03ec307085f3d3936dee12))
- Improve watcher resilience ([50495f5](https://github.com/Lichess4545/Chesster/commit/50495f5cae645049cf4aac075e8cdfd3c096bc7a))
- parse the database port from config ([#427](https://github.com/Lichess4545/Chesster/pull/427)) ([89a279e](https://github.com/Lichess4545/Chesster/commit/89a279e6602a243c44b15172ad831e6bdd840f2b))

### Other

- Starting on meging my remote changes ([4f39c45](https://github.com/Lichess4545/Chesster/commit/4f39c45ba9bde746708ba8d14cd255f9b9fffe2d))

