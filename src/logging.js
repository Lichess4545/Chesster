//------------------------------------------------------------------------------
// Winston transport implementation that writes log data to a Slack instance
// Based off of work by andy.batchelor on 2/26/14.
//------------------------------------------------------------------------------

const _ = require("lodash");
const util = require('util'),
    winston = require('winston');

var Slack = module.exports.Slack  = function (options) {
    var self = this;
    options = options || {};
    this.channel    = options.channel;
    this.domain     = options.domain;
    this.username   = options.username || "winston-slack";
    this.level      = options.level    || 'info';
    this.silent     = options.silent   || false;
    this.raw        = options.raw      || false;
    this.name       = options.name     || 'slack';
    //- Enabled loging of uncaught exceptions
    this.handleExceptions = options.handleExceptions || false;

    self.controller = options.controller;
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
    var icon_emoji;
    if (_.isEqual(level, "info")) {
        icon_emoji = ":information_source:";
    } else if (_.isEqual(level, "debug")) {
        icon_emoji = ":grey_question:";
    } else if (_.isEqual(level, "warning")) {
        icon_emoji = ":warning:";
    } else if (_.isEqual(level, "error")) {
        icon_emoji = ":interrobang:";
    }
    //- Use custom formatter for message if set
    var message = { text: icon_emoji + " [" + level + "] " + msg,
            channel: this.channel,
            username: this.username,
            icon_emoji: icon_emoji
        };
    this.bot.say(message);

    callback(null, true);
};
