// NOTE: Neither of these files are committed and for good reason.
//       You must provide your own.
var token = require("./slack_token.js").token;
var private_key = require("./test_service_account_key.js").key;
try {
    var logging_token = require("./test_logging_token.js").token;
} catch (e) {
    var logging_token = null;
}
var heltour_token = require("./test_heltour_token.js").token;

const UNSTABLE_BOT_ID = "C0VCCPMJ8";
const UNSTABLE_BOT_LONEWOLF_ID = "C0XQM31SL";

var config = require("./config.js");
config['winston']['token'] = logging_token;
config['winston']['channel'] = "#modster-logging";

config["welcome"]["channel"] = "unstable_bot";

config["leagues"]["45+45"]["spreadsheet"]["key"] = "1BeRN76zaB_uCCrCra2yTEEw_r6C5_b8P59aN_BrJsyA";
config["leagues"]["45+45"]["spreadsheet"]["serviceAccountAuth"] = {
    "client_email": "tesster@chesster-lichess-4545-bot.iam.gserviceaccount.com",
    "private_key": private_key,
};
config["leagues"]["lonewolf"]["spreadsheet"]["key"] = "1xBofd1bFIB4OBUOErWqFWTjTc0dFuTf6WlHxZf3FbIU";
config["leagues"]["lonewolf"]["spreadsheet"]["serviceAccountAuth"] = {
    "client_email": "tesster@chesster-lichess-4545-bot.iam.gserviceaccount.com",
    "private_key": private_key,
};
config["leagues"]["45+45"]["heltour"]["token"] = heltour_token;
config["leagues"]["45+45"]["heltour"]["baseEndpoint"] = "https://staging.lichess4545.com/api/";
config["leagues"]["lonewolf"]["heltour"]["token"] = heltour_token;
config["leagues"]["lonewolf"]["heltour"]["baseEndpoint"] = "https://staging.lichess4545.com/api/";

config["leagues"]["45+45"]["scheduling"]["channel"] = "unstable_bot";
config["leagues"]["45+45"]["results"]["channel"] = "unstable_bot";
config["leagues"]["45+45"]["results"]["channel_id"] = UNSTABLE_BOT_ID;
config["leagues"]["45+45"]["gamelinks"]["channel"] = "unstable_bot";
config["leagues"]["45+45"]["gamelinks"]["channel_id"] = UNSTABLE_BOT_ID;
config["leagues"]["45+45"]["alternate"]["channel_id"] = UNSTABLE_BOT_ID;
config["leagues"]["lonewolf"]["scheduling"]["channel"] = "unstable_bot-lonewolf";
config["leagues"]["lonewolf"]["results"]["channel"] = "unstable_bot-lonewolf";
config["leagues"]["lonewolf"]["results"]["channel_id"] = UNSTABLE_BOT_LONEWOLF_ID;
config["leagues"]["lonewolf"]["gamelinks"]["channel"] = "unstable_bot-lonewolf";
config["leagues"]["lonewolf"]["gamelinks"]["channel_id"] = UNSTABLE_BOT_LONEWOLF_ID;

config["channel_map"][UNSTABLE_BOT_ID] = "45+45";
config["channel_map"]["unstable_bot"] = "45+45";
config["channel_map"]["unstabled_bot-lonewolf"] = "lonewolf";
config["channel_map"][UNSTABLE_BOT_LONEWOLF_ID] = "lonewolf";

module.exports = config;
