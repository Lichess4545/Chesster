/**
 * Based off of work by andy.batchelor on 2/26/14.
 */

var Botkit = require('botkit');
var util = require('util'),
    winston = require('winston');

var Slack = module.exports.Slack  = function (options) {
    var self = this;
    options = options || {};
    if(!options.token || !options.channel){
        throw new Error("Token and channel can't be null.");
    }
    else{
        this.token      = options.token;
        this.channel    = options.channel;
        this.domain     = options.domain;
        this.username   = options.username || "winston-slack";
        this.level      = options.level    || 'info';
        this.silent     = options.silent   || false;
        this.raw        = options.raw      || false;
        this.name       = options.name     || 'slack';
        //- Enabled loging of uncaught exceptions
        this.handleExceptions = options.handleExceptions || false

        self.controller = Botkit.slackbot({
            debug: false
        });
        self.controller.spawn({
          token: options.token
        }).startRTM(function(err, bot) {
            self.bot = bot;
            winston.info("[LOGGING] - Logging to slack started");
        });
    }
};

//
// Inherit from `winston.Transport` so you can take advantage
// of the base functionality and `.handleExceptions()`.
//
util.inherits(Slack, winston.Transport);

//- Attaches this Transport to the list of available transports
winston.transports.Slack = Slack;


Slack.prototype.log = function (level, msg, meta, callback) {
    if (!this.bot) {
        return;
    }
    //- Use custom formatter for message if set
    var message = { text: "[" + level + "] " + msg,
            channel: this.channel,
            username: this.username
        };
    this.bot.say(message);

    callback(null, true);
};
