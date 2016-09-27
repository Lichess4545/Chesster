# CHESSTER [![Build Status](https://travis-ci.org/endrawes0/Chesster.svg?branch=master)](https://travis-ci.org/endrawes0/Chesster) [![Test Coverage](https://codeclimate.com/github/endrawes0/Chesster/badges/coverage.svg)](https://codeclimate.com/github/endrawes0/Chesster/coverage) 
## Introduction
This bot was created to help moderate the Lichess45+45 league.

It has a simple interface that integrates our slack team with Lichess and Google Spreadsheets.

I hope to make future improvements as time goes on.

If you have any issues, reach out to me here on github.

Cheers.
Andrew W. Haddad

ps. I will add more detail here later. I just want to get some bare bones instructions in for the time being.

## Installation
0. Clone this repo
1. Install vagrant
2. Use the included Vagrantfile to bring up the environment
3. Migrate databases: `npm run migrate config/testconfig.js`

## Start Chesster
1. Generate a bot token in your Slack Team's Services and Customization.
2. Install your bot's token in the start script, start_chesster.
3. Start the bot. ` > ./bin./start ../config/config.js`

## Website Integration
This bot utilizes the heltour api from this repo: https://github.com/cyanfish/heltour/
You will need to create a token from an installation of this app in order to access and manipulate data.

The bot should now be available for addition to your Slack Team.
