# CHESSTER
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
2. Install botkin
```
 > node install --save botkin
```
3. Install google-spreadsheet
```
 > node install --save google-spreadsheet
```
4. Install asynch
```
 > node install --save async
```

## Start Chesster
1. Generate a bot token in your Slack Team's Services and Customization.
2. Install your bot's token in the start script. start_chesster
3. Start the bot
```
 > node chesster.js
```

The bot should now be available for addition to your Slack Team.
