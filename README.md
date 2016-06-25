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
1. Install nodejs and npm - use your favorite installation method
2. To get all dependencies installed locally `npm install` from the root.

### Manual Installation
1. Install botkit.  ` > npm install --save botkit `
2. Install google-spreadsheet. ` > npm install --save google-spreadsheet `
3. Install async. ` > npm install --save async `
4. Install fast-levenshtein. ` > npm install --save fast-levenshtein `
5. Install mocha. ` > npm install --save mocha `
6. Install chai. ` > npm install --save chai `
7. Install moment. ` > npm install --save moment `
8. Install underscore. ` > npm install --save underscore `
9. Install q. ` > npm install --save q `
10. Install string-format. ` > npm install --save string-format `

## Start Chesster
1. Generate a bot token in your Slack Team's Services and Customization.
2. Install your bot's token in the start script, start_chesster.
3. Start the bot. ` > ./bin./start ../config/config.js`

## Spreadsheet account
The bot needs a service account for the spreadsheets, you can obtain one of these from google and the google-spreadsheet module documentation has instructions on how to do so. These credentials are sensitive, keep them secret.

The bot should now be available for addition to your Slack Team.
