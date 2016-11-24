# CHESSTER [![Build Status](https://travis-ci.org/endrawes0/Chesster.svg?branch=master)](https://travis-ci.org/endrawes0/Chesster) [![Test Coverage](https://codeclimate.com/github/endrawes0/Chesster/badges/coverage.svg)](https://codeclimate.com/github/endrawes0/Chesster/coverage) 
## Introduction
This bot was created to help moderate the Lichess45+45 league.

It has a simple interface that integrates our Slack team, with Lichess and Website HTTP API.

If you have any issues, reach out to me here on github or on Slack.

Cheers.
Andrew W. Haddad

## Installation
0. Clone this repo
1. Install vagrant
2. Use the included Vagrantfile to bring up the environment - `vagrant up`, `vagrant ssh`, and `cd chesster`
3. Install the npm modules - `npm install`
4. Generate a bot token in your Slack Team's Services and Customization.
5. `cp config/slack_token.js.example config/slack_token.js`
6. update config/slack_token.js with your token 
7. `cp config/heltour_token.js.example config/test_heltour_token.js`
8. `cp config/heltour_token.js.example config/heltour_token.js`
9. update config/config/test_heltour_token.js with a token from the heltour site
10. Migrate databases: `npm run migrate config/testconfig.js`
11. Install your bot's token in the start script, start_chesster.
12. Start the bot. ` > ./bin/start ../config/config.js`

## Website Integration
This bot utilizes the heltour api from this repo: https://github.com/cyanfish/heltour/
You will need to create a token from an installation of this app in order to access and manipulate data.

The bot should now be available for addition to your Slack Team.
