//------------------------------------------------------------------------------
// Commands and helpers related to subscriptions
//------------------------------------------------------------------------------
import _ from 'lodash'
import winston from 'winston'

import * as league from '../league'
import * as db from '../models'
import { SlackBot, CommandMessage } from '../slack'
import { isDefined } from '../utils'

// The emitter we will use.
import { EventEmitter } from 'events'
class ChessLeagueEmitter extends EventEmitter {}
export const emitter = new ChessLeagueEmitter()

type Context = any
type Callback = any

var events: string[] = [
    //'a-game-starts',
    //'a-game-is-scheduled',
    //'a-game-is-over',
    //'a-pairing-is-released',
]

//------------------------------------------------------------------------------
// Format the help response message
//------------------------------------------------------------------------------
function formatHelpResponse(bot: SlackBot) {
    var leagueNames = _.map(league.getAllLeagues(bot), 'options.name')

    return (
        'The subscription system supports the following commands: \n' +
        '1. `tell <listener> when <event> in <league> for <target-user-or-team>` to ' +
        ' subscribe to an event\n' +
        '2. `subscription list` to list your current subscriptions\n' +
        '3. `subscription remove <id>` to remove a specific subscription\n' +
        '\n--------------------------------------------------------------------\n' +
        'For command 1, these are the options: \n' +
        '1. `<listener>` is either `me` to subscribe yourself or ' +
        ' `my-team-channel` to subscribe your team channel (_Note: you must be ' +
        ' be team captain to use `my-team-channel`_).\n' +
        '2. `<event>` is one of:`' +
        events.join('` or `') +
        '`\n' +
        '3. `<league>` is one of: `' +
        leagueNames.join('` or `') +
        '`\n' +
        '4. `<target-user-or-team>` is the target username or teamname that you are ' +
        'subscribing to (_Note: You can use `my-team` to target your team_).'
    )
}

//------------------------------------------------------------------------------
// tell them they chose an invalid league
//------------------------------------------------------------------------------
function formatInvalidLeagueResponse(bot: SlackBot) {
    var leagueNames = _.map(league.getAllLeagues(bot), 'options.name')

    return (
        "You didn't specify a valid league. These are your options:\n" +
        '```' +
        leagueNames.join('\n') +
        '```'
    )
}

//------------------------------------------------------------------------------
// Tell them they can only listen for themselves
//------------------------------------------------------------------------------
function formatCanOnlyListenForYouResponse(listener: string) {
    if (_.isEqual(listener, 'my-team-channel')) {
        return (
            "You can't subscribe " +
            listener +
            " because you aren't the team captain." +
            " As a non-captain you can only subscribe yourself. Use 'me' as " +
            ' listener.'
        )
    } else {
        return (
            "You can't subscribe " +
            listener +
            " because you aren't a moderator." +
            " As a non-moderator you can only subscribe yourself. Use 'me' as " +
            ' listener.'
        )
    }
}

//------------------------------------------------------------------------------
// This is not a listener that we recognize
//------------------------------------------------------------------------------
function formatInvalidListenerResponse(listener: string) {
    return (
        "I don't recognize '" + listener + "'. Please use 'me' as the listener."
    )
}

//------------------------------------------------------------------------------
// Format the invalid event handler
//------------------------------------------------------------------------------
function formatInvalidEventResponse(event: string) {
    return (
        '`' +
        event +
        '` is not one of the events that I recognize. Use one of: ' +
        '```' +
        events.join('\n') +
        '```'
    )
}

//------------------------------------------------------------------------------
// Format the response for when the source is not valid
//------------------------------------------------------------------------------
function formatInvalidSourceResponse(source: string) {
    return (
        '`' +
        source +
        '` is not a valid source of that event. Please target a valid user or team.'
    )
}

//------------------------------------------------------------------------------
// Format the response for when the user is not on a team
//------------------------------------------------------------------------------
function formatNoTeamResponse() {
    return "You can't use my-team or my-team-channel since you don't have a team right now."
}

//------------------------------------------------------------------------------
// Format the a-game-is-scheduled response
//------------------------------------------------------------------------------
export function formatAGameIsScheduled(
    bot: SlackBot,
    target: string,
    context: Context
) {
    // TODO: put these date formats somewhere, probably config?
    var friendlyFormat = 'ddd @ HH:mm'
    let member = bot.getSlackUserFromNameOrID(target)
    var message = ''
    var fullFormat = 'YYYY-MM-DD @ HH:mm UTC'
    let realDate = context.result.date.format(fullFormat)
    if (member && member.tz_offset) {
        var targetDate = context.result.date
            .clone()
            .utcOffset(member.tz_offset / 60)
        context['yourDate'] = targetDate.format(friendlyFormat)
        message = `${context.white.name} vs ${context.black.name} in ${context.leagueName} has been scheduled for ${realDate}, which is {context.yourDate} for you.`
    } else {
        message = `${context.white.name} vs ${context.black.name} in ${context.leagueName} has been scheduled for ${realDate}.`
    }
    return message
}

//------------------------------------------------------------------------------
// Format the A Game Starts response.
//------------------------------------------------------------------------------
export function formatAGameStarts(
    bot: SlackBot,
    target: string,
    context: Context
) {
    return `${context.white.name} vs ${context.black.name} in ${context.leagueName} has started: ${context.result.gamelink}`
}

//------------------------------------------------------------------------------
// Format the a game is over response.
//------------------------------------------------------------------------------
export function formatAGameIsOver(
    bot: SlackBot,
    target: string,
    context: Context
) {
    return `${context.white.name} vs ${context.black.name} in ${context.leagueName} is over. The result is ${context.result.result}.`
}

//------------------------------------------------------------------------------
// Processes a tell command.
//
// A tell command is made up like so:
//      tell <listener> when <event> in <league> for <source>
//------------------------------------------------------------------------------
function processTellCommand(
    bot: SlackBot,
    message: CommandMessage
): Promise<string> {
    return new Promise((resolve, reject) => {
        var requester = bot.getSlackUserFromNameOrID(message.user)
        if (!isDefined(requester)) return
        var components = message.text.split(' ')
        var args = _.map(components.slice(0, 7), _.toLower)
        var sourceName = components.splice(7).join(' ')
        var tell = args[0],
            listener = args[1],
            when = args[2],
            event = args[3],
            _in = args[4],
            targetLeague = args[5],
            _for = args[6]

        // Ensure the basic command format is valid
        if (
            !_.isEqual(['tell', 'when', 'in', 'for'], [tell, when, _in, _for])
        ) {
            let message = formatHelpResponse(bot)
            return resolve("I didn't understand you.\n" + message)
        }

        // Ensure they chose a valid league.
        var _league = league.getLeague(bot, targetLeague)
        if (_.isUndefined(_league)) {
            return resolve(formatInvalidLeagueResponse(bot))
        }
        // TODO: this is hacky, but required at the moment. :(
        //       otherwise message.player.isModerator won't work.
        //       this is usually set by the requiresLeague middleware,
        //       but we are in a DM, not a league specific channel
        message.league = _league
        var team = message.league.getTeamByPlayerName(
            message.member.lichess_username
        )
        var captainName =
            team && _(team.players).filter('isCaptain').map('username').value()
        var isCaptain =
            captainName &&
            _.isEqual(
                _.toLower(captainName[0]),
                _.toLower(message.member.lichess_username)
            )

        var possibleListeners = ['me', 'my-team-channel']

        if (
            !(
                _.isEqual(listener, 'me') ||
                _league.isModerator(message.member.lichess_username) ||
                (_.isEqual(listener, 'my-team-channel') && isCaptain)
            )
        ) {
            return resolve(formatCanOnlyListenForYouResponse(listener))
        }

        if (!_.includes(possibleListeners, listener)) {
            return resolve(formatInvalidListenerResponse(listener))
        }

        // TODO: hrmmm. this seems bad.
        var target: string = ''
        if (_.isEqual(listener, 'me')) {
            listener = 'you'
            target = requester.name
        } else if (_.isEqual(listener, 'my-team-channel')) {
            if (!team) {
                return formatNoTeamResponse()
            }
            listener = 'your team channel'
            target = 'channel_id:' + team.slack_channel
        }

        // Ensure the event is valid
        if (!_.includes(events, event)) {
            return resolve(formatInvalidEventResponse(event))
        }

        if (_.isEqual(sourceName, 'my-team')) {
            if (!team) {
                return resolve(formatNoTeamResponse())
            }
            sourceName = team.name
        }
        // Ensure the source is a valid user or team within slack
        var source = bot.getSlackUserFromNameOrID(sourceName)
        let teams = _league.getTeams()
        var team = _.find(teams, (team) => {
            return team.name.toLowerCase() === sourceName.toLowerCase()
        })
        if (_.isUndefined(source) && _.isUndefined(team)) {
            return resolve(formatInvalidSourceResponse(sourceName))
        }
        if (!_.isUndefined(source)) {
            sourceName = source.name
        } else if (!_.isUndefined(team)) {
            sourceName = team.name
        }
        return db.Subscription.findOrCreate({
            where: {
                requester: requester.name.toLowerCase(),
                source: sourceName.toLowerCase(),
                event: event.toLowerCase(),
                league: _league.name.toLowerCase(),
                target: target.toLowerCase(),
            },
        })
            .then(() =>
                resolve(
                    `Great! I will tell ${target} when ${event} for ${source} in ${league}`
                )
            )
            .catch((error) => reject(error))
    })
}

//------------------------------------------------------------------------------
// Processes the subscriptions command
//
// `subscription list` (by itself) simply lists your subscriptions with ID #s
//------------------------------------------------------------------------------
function processSubscriptionListCommand(
    bot: SlackBot,
    message: CommandMessage
): Promise<string> {
    return new Promise((resolve, reject) => {
        var requester = bot.getSlackUserFromNameOrID(message.user)
        if (!isDefined(requester)) return
        return db.Subscription.findAll({
            where: {
                requester: requester.name.toLowerCase(),
            },
            order: [['id', 'ASC']],
        })
            .then((subscriptions) => {
                var response = ''
                _.each(subscriptions, (subscription) => {
                    var context: Context = subscription.get()
                    if (_.startsWith(context['target'], 'channel_id:')) {
                        context['target'] = 'your team channel'
                    }
                    response += `\nID ${context.id} -> tell ${context.target} when ${context.event} for ${context.source} in ${context.league}`
                })
                if (response.length === 0) {
                    response = 'You have no subscriptions'
                }

                return resolve(response)
            })
            .catch(reject)
    })
}

//------------------------------------------------------------------------------
// Processes the remove subscription command
//
// `subscription remove <id>` removes subscription with ID: <id>
//------------------------------------------------------------------------------
function processSubscriptionRemoveCommand(
    bot: SlackBot,
    message: CommandMessage,
    id: string
): Promise<string> {
    return new Promise((resolve, reject) => {
        var requester = bot.getSlackUserFromNameOrID(message.user)
        if (!isDefined(requester)) return
        return db.Subscription.findAll({
            where: {
                requester: requester.name.toLowerCase(),
                id: id,
            },
        }).then((subscriptions) => {
            if (subscriptions.length === 0) {
                return resolve('That is not a valid subscription id')
            } else if (subscriptions.length === 1) {
                return subscriptions[0].destroy().then(() => {
                    return resolve('Subscription deleted')
                })
            } else {
                return reject('This should never occur')
            }
        })
    })
}

//------------------------------------------------------------------------------
// Register an event + message handler
//------------------------------------------------------------------------------
export function register(bot: SlackBot, eventName: string, cb: Callback) {
    // Ensure this is a known event.
    events.push(eventName)

    // Handle the event when it happens
    emitter.on(eventName, async (league, sources, context) => {
        return getListeners(bot, league.options.name, sources, eventName).then(
            (targets) => {
                var allDeferreds: Promise<void>[] = targets.map(
                    (target) =>
                        new Promise((resolve, reject) => {
                            var message = cb(bot, target, _.clone(context))
                            if (_.startsWith(target, 'channel_id:')) {
                                var channelID = _.toUpper(target.substr(11))
                                bot.say({
                                    channel: channelID,
                                    text: message,
                                    attachments: [],
                                })
                            } else {
                                bot.startPrivateConversation([target])
                                    .then((convo) => {
                                        bot.say({
                                            channel: convo.channel.id,
                                            text: message,
                                        })
                                        resolve()
                                    })
                                    .catch((error) => {
                                        winston.error(JSON.stringify(error))
                                        reject(error)
                                    })
                            }
                        })
                )
                return Promise.all(allDeferreds)
            }
        )
    })
}

//------------------------------------------------------------------------------
// Get listeners for a given event and source
//------------------------------------------------------------------------------
export function getListeners(
    bot: SlackBot,
    leagueName: string,
    sources: string[],
    event: string
): Promise<string[]> {
    return new Promise((resolve, reject) => {
        sources = _.map(sources, _.toLower)
        // These are names of users, not users. So we have to go get the real
        // user and teams. This is somewhat wasteful - but I'm not sure whether
        // this is the right design or if we should pass in users to this point.
        var _league = league.getLeague(bot, leagueName)
        if (!isDefined(_league)) return reject()
        var teamNames = _(sources)
            .map(_league.getTeamByPlayerName)
            .filter(isDefined)
            .map('name')
            .map(_.toLower)
            .value()
        var possibleSources = _.concat(sources, teamNames)
        return db.Subscription.findAll({
            where: {
                league: leagueName.toLowerCase(),
                source: {
                    $in: possibleSources,
                },
                event: event.toLowerCase(),
            },
        }).then(function (subscriptions) {
            return resolve(_(subscriptions).map('target').uniq().value())
        })
    })
}

//------------------------------------------------------------------------------
// Format the not a moderator response
//------------------------------------------------------------------------------
function formatNotModerator() {
    return "You are not a moderator and so you can't run this command"
}

//------------------------------------------------------------------------------
// Process the subscribe teams command.
//
// A tell command is made up like so:
//      tell <listener> when <event> in <league> for <source>
//------------------------------------------------------------------------------
function processTeamSubscribeCommand(
    bot: SlackBot,
    message: CommandMessage
): Promise<string> {
    return new Promise((resolve, reject) => {
        var _leagueOr = league.getLeague(bot, '45+45')
        if (!isDefined(_leagueOr)) return
        var _league: league.League = _leagueOr
        // Needed for isModerator to work
        message.league = _league
        if (!_league.isModerator(message.member.lichess_username)) {
            return resolve(formatNotModerator())
        }
        let teams = _league.getTeams()
        var processed = 0
        var missing_channel = 0
        var promises = teams.map((team) => {
            if (!team.slack_channel) {
                missing_channel++
            } else {
                var target = 'channel_id:' + team.slack_channel
                processed++
                ;['a-game-starts', 'a-game-is-over'].forEach(function (event) {
                    return db.Subscription.findOrCreate({
                        where: {
                            requester: 'chesster',
                            source: team.name.toLowerCase(),
                            event: event.toLowerCase(),
                            league: _league.name.toLowerCase(),
                            target: target.toLowerCase(),
                        },
                    })
                })
            }
        })
        return Promise.all(promises)
            .then(function () {
                return resolve(
                    `Processed ${processed} teams. ${missing_channel} are missing channels.`
                )
            })
            .catch(reject)
    })
}

//------------------------------------------------------------------------------
// Handler the tell me when command
//------------------------------------------------------------------------------
export function tellMeWhenHandler() {
    return async (bot: SlackBot, message: CommandMessage) => {
        let convo = await bot.startPrivateConversation([message.user])
        return processTellCommand(bot, message)
            .then((response) => {
                bot.say({
                    channel: convo.channel.id,
                    text: response,
                })
            })
            .catch((error) => {
                winston.error(JSON.stringify(error))
                bot.say({
                    channel: convo.channel.id,
                    text:
                        "I'm sorry, but an error occurred processing this subscription command",
                })
            })
    }
}

//------------------------------------------------------------------------------
// Handle the help message command
//------------------------------------------------------------------------------
export function helpHandler() {
    return async (bot: SlackBot, message: CommandMessage) => {
        let convo = await bot.startPrivateConversation([message.user])
        bot.say({
            channel: convo.channel.id,
            text: formatHelpResponse(bot),
        })
    }
}

//------------------------------------------------------------------------------
// Handle the subscription list command.
//------------------------------------------------------------------------------
export function listHandler() {
    return async (bot: SlackBot, message: CommandMessage) => {
        let convo = await bot.startPrivateConversation([message.user])
        return processSubscriptionListCommand(bot, message)
            .then(function (response) {
                bot.say({
                    channel: convo.channel.id,
                    text: response,
                })
            })
            .catch(function (error) {
                bot.say({
                    channel: convo.channel.id,
                    text:
                        "I'm sorry, but an error occurred processing this subscription command",
                })
                winston.error(JSON.stringify(error))
            })
    }
}

//------------------------------------------------------------------------------
// Handle the subscription remove command.
//------------------------------------------------------------------------------
export function removeHandler() {
    return async (bot: SlackBot, message: CommandMessage) => {
        let convo = await bot.startPrivateConversation([message.user])
        return processSubscriptionRemoveCommand(
            bot,
            message,
            message.matches[1]
        )
            .then(function (response) {
                bot.say({
                    channel: convo.channel.id,
                    text: response,
                })
            })
            .catch(function (error) {
                bot.say({
                    channel: convo.channel.id,
                    text:
                        "I'm sorry, but an error occurred processing this subscription command",
                })
                winston.error(JSON.stringify(error))
            })
    }
}

//------------------------------------------------------------------------------
// Handle the subscribe teams command
//------------------------------------------------------------------------------
export function subscribeTeams() {
    return async (bot: SlackBot, message: CommandMessage) => {
        let convo = await bot.startPrivateConversation([message.user])
        return processTeamSubscribeCommand(bot, message)
            .then(function (response) {
                bot.say({
                    channel: convo.channel.id,
                    text: response,
                })
            })
            .catch(function (error) {
                bot.say({
                    channel: convo.channel.id,
                    text:
                        "I'm sorry, but an error occurred processing this subscription command",
                })
                winston.error(JSON.stringify(error))
            })
    }
}

