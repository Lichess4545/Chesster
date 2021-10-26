# CHESSTER [![Build Status](https://github.com/Lichess4545/Chesster/actions/workflows/build.yml/badge.svg?branch=main)](https://github.com/Lichess4545/Chesster/actions/workflows/build.yml) [![Test Coverage](https://codeclimate.com/github/Lichess4545/Chesster/badges/coverage.svg)](https://codeclimate.com/github/Lichess4545/Chesster/coverage) 
## Introduction
This bot was created to help moderate the Lichess45+45 league.

It has a simple interface that integrates our Slack team, with Lichess and Website HTTP API.

## Installation
0. Clone this repo
1. Install vagrant
2. Use the included Vagrantfile to bring up the environment - `vagrant up`, `vagrant ssh`, and `cd chesster`
3. Install the yarn modules - `yarn install --dev`
4. Generate a classic bot token in your Slack Team's Services and Customization.
5. Generate a heltour token from Heltour's Administration interfaces.
6. Add both to your `.env`:
    ```
    CHESSTER_4545_SLACK_TOKEN="xoxb-<token>"
    CHESSTER_CHESSTER_SLACK_TOKEN="xoxb-<token>"
    CHESSTER_HELTOUR_TOKEN="<token>"
    CHESSTER_LICHESS_TOKEN="<token>"
    ```
7. Migrate databases: `yarn run migrate config/testconfig.js`
8. Install your bot's token in the start script, start_chesster.
9. Start the bot. `yarn run start`

## Useful Commands

Run these before submitting a PR:

- `yarn test`
- `yarn run lint`

## Website Integration
This bot utilizes the heltour api from this repo: https://github.com/cyanfish/heltour/
You will need to create a token from an installation of this app in order to access and manipulate data.

The bot should now be available for addition to your Slack Team.
