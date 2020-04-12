//------------------------------------------------------------------------------
// Commands and helpers for scheduling games
//------------------------------------------------------------------------------
import moment from 'moment-timezone'
import _ from 'lodash'
import winston from 'winston'

import * as heltour from '../heltour'
import * as subscription from './subscription'
import { League, SchedulingOptions } from '../league'
import { SlackBot, CommandMessage, LeagueMember } from '../slack'
import { isDefined } from '../utils'

type Results = any

export interface ExtremaParameters {
    start: moment.Moment
    end: moment.Moment
    referenceDate: moment.Moment
    warning: moment.Moment
}

export class Extrema {
    constructor(
        public start: moment.Moment,
        public end: moment.Moment,
        public referenceDate: moment.Moment,
        public warning: moment.Moment
    ) {}
}
// Construct an extrema from default paramters
export function makeExtrema({
    start,
    end,
    referenceDate,
    warning,
}: ExtremaParameters) {
    return new Extrema(start, end, referenceDate, warning)
}

interface SchedulingResult {
    white?: string
    black?: string
    date: moment.Moment
    warn: boolean
    outOfBounds: boolean
}

let BASE_DATE_FORMATS = [
    'YYYY-MM-DD MM DD',
    'YYYY-MM DD',
    'YYYY-MM-DD',
    'YYYY-MM-D',
    'YYYY-M-DD',
    'YYYY-M-D',
    'YY-MM-DD',
    'YY-MM-D',
    'YY-M-DD',
    'YY-M-D',
    'MM-DD-YYYY',
    'MM-D-YYYY',
    'M-DD-YYYY',
    'M-D-YYYY',
    'MM-DD-YY',
    'MM-D-YY',
    'M-DD-YY',
    'M-D-YY',
    'YYYY-DD-MM',
    'YYYY-D-MM',
    'YYYY-DD-M',
    'YYYY-D-M',
    'YY-DD-MM',
    'YY-D-MM',
    'YY-DD-M',
    'YY-D-M',
    'DD-MM-YYYY',
    'D-MM-YYYY',
    'DD-M-YYYY',
    'D-M-YYYY',
    'DD-MM-YY',
    'D-MM-YY',
    'DD-M-YY',
    'D-M-YY',
    'YYYY-MMMM DD',
    'YY-MMMM DD',
    'MMMM DD YYYY',
    'MMMM DD YY',
    'YYYY-DD MMMM',
    'YY-DD MMMM',
    'DD MMMM YYYY',
    'DD MMMM YY',
    'YYYY-MMMM D',
    'YY-MMMM D',
    'MMMM D YYYY',
    'MMMM D YY',
    'YYYY-D MMMM',
    'YY-D MMMM',
    'D MMMM YYYY',
    'D MMMM YY',
]
let BASE_TIME_FORMATS = ['HHmm', 'Hmm', 'HH-mm', 'H-mm', 'HH']
let DATE_FORMATS: string[] = []
BASE_DATE_FORMATS.forEach(function (dateFormat) {
    BASE_TIME_FORMATS.forEach(function (timeFormat) {
        DATE_FORMATS.push(dateFormat + ' ' + timeFormat)
        DATE_FORMATS.push(timeFormat + ' ' + dateFormat)
    })
})
let WORDS_TO_IGNORE = [
    '',
    '-',
    '–',
    'at',
    'on',
    'gmt',
    'gmt.',
    'gmt:',
    'utc',
    'utc.',
    'utc:',
    'rescheduled',
    'reschedule',
    'reschedule:',
    'to',
    'v',
    'vs',
    'versus',
    'white',
    'black',
    'pieces',
]

// A scheduling error (as opposed to other errors)
export class ScheduleParsingError extends Error {}

// Get an appropriate set of base tokens for the scheduling messages
function getTokensScheduling(inputString: string) {
    // Do some basic preprocessing
    // Replace non-date punctuation/symbols with spaces
    inputString = inputString.replace(/[@,\(\)]/g, ' ')
    inputString = inputString.replace(/[<\>]/g, '')

    let parts = _.map(inputString.split(' '), function (item) {
        // Remove . and / and : and - from the beginning and end of the word
        item = item.replace(/^[:\.\/-]/g, '')
        item = item.replace(/[:\.\/-]$/g, '')

        return item
    })
    parts = _.filter(parts, function (i) {
        return i.length > 0
    })
    parts = _.filter(parts, function (i) {
        return WORDS_TO_IGNORE.indexOf(i.toLowerCase()) === -1
    })
    return parts
}

// Take the string they posted and turn it into a set of possible date
// strings by doing things like:
//
// Unifying the punctuation.
// removing gmt/utc
// Adding the current-year
// replacing day of the week tokens with the appropriate date format
function getPossibleDateStrings(dateString: string, extrema: Extrema) {
    let dateStrings = []

    // Unify some common stuff first.
    //
    // Change /.: to -
    dateString = dateString.replace(/[\/:\.]/g, '-')
    dateString = dateString.toLowerCase()
    dateString = dateString.replace(/gmt/g, '')
    dateString = dateString.replace(/utc/g, '')

    let dateNameMappings: Record<string, string> = {}

    let cur = extrema.start.clone()
    let now = extrema.referenceDate || moment.utc()
    let month
    while (!cur.isAfter(extrema.end)) {
        let monthDay = cur.format('MM-DD')
        // Deal with a couple of formats that moment doesn't produce but are used.
        if (_.isEqual(cur.format('dddd'), 'Thursday')) {
            dateNameMappings['thurs'] = monthDay
        }
        if (_.isEqual(cur.format('dddd'), 'Wednesday')) {
            dateNameMappings['weds'] = monthDay
        }
        dateNameMappings[cur.format('dd').toLowerCase()] = monthDay
        dateNameMappings[cur.format('ddd').toLowerCase()] = monthDay
        dateNameMappings[cur.format('dddd').toLowerCase()] = monthDay
        dateNameMappings[cur.format('Do').toLowerCase()] = cur.format('DD')
        month = cur.format('MM')
        dateNameMappings[cur.format('MMM').toLowerCase()] = month
        dateNameMappings[cur.format('MMMM').toLowerCase()] = month
        cur.add(1, 'days')
    }

    // Now make one where we map date names to their date
    let tokens = dateString.split(' ')
    tokens = _.map(tokens, function (part) {
        if (dateNameMappings[part.toLowerCase()]) {
            return dateNameMappings[part.toLowerCase()]
        } else {
            return part
        }
    })
    dateStrings.push(tokens.join(' '))

    // now make one wher we remove date names completely.
    tokens = dateString.split(' ')
    tokens = _.map(tokens, function (part) {
        if (dateNameMappings[part.toLowerCase()]) {
            return ''
        } else {
            return part
        }
    })
    tokens = _.filter(tokens, function (i) {
        return i.length > 0
    })
    dateStrings.push(tokens.join(' '))

    // Now make some where we inject the year at the beginning
    let year = now.format('YYYY')
    month = now.format('MM')
    dateStrings.slice().forEach(function (dateString) {
        dateStrings.push('' + year + '-' + dateString)
        dateStrings.push(dateString + '-' + year)
    })
    return dateStrings
}

// Make an attempt to parse a scheduling string.
//
// Parameters:
//     inputString: the string to try and parse
//     options: options for both this method and are passed along to
//         getRoundExtrema options
//     options.warningHours: an integer specifying how many hours
//         before the round end that we want to warn people about.
export function parseScheduling(
    inputString: string,
    options: SchedulingOptions
): SchedulingResult {
    let parts = getTokensScheduling(inputString)

    // Filter out word that we know we want to ignore.
    let date_parts = parts
    let name_parts: string[] = []
    // If it's longer than 3, then they provided names, so use them.
    if (parts.length >= 3) {
        date_parts = parts.slice(2)
        name_parts = parts.slice(0, 2)
    }

    // Now build up some possible strings and try a bunch of patterns
    // to find a date in our range.
    let extrema = getRoundExtrema(options)
    let dateStrings = getPossibleDateStrings(date_parts.join(' '), extrema)

    let validInBoundsDate: moment.Moment[] = []
    let validOutOfBoundsDate: moment.Moment[] = []
    // Using _.every and returning false to break out of loops
    // checking every possible date format even after we have found
    // a valid one is wasteful, so this allows us to short circuit that process.
    _.every(dateStrings, function (dateString) {
        _.every(DATE_FORMATS, function (format) {
            let date = moment.utc(dateString, format, true)
            if (!date.isValid()) {
                return true
            }
            validOutOfBoundsDate.push(date)
            // TODO: This check will prevent us from publishing pairings
            //       early AND having people announce their schedule early.
            //       Which is unfortunate, but I haven't thought of an elegant
            //       or easy way to allow for this. :/
            if (date.isBefore(extrema.start) || date.isAfter(extrema.end)) {
                return true
            }
            validInBoundsDate.push(date)
            return false
        })
        if (validInBoundsDate.length > 0) {
            return false
        }
        return true
    })
    if (validInBoundsDate.length === 0 && validOutOfBoundsDate.length === 0) {
        winston.error('Unable to parse date: [' + inputString + ']')
        throw new ScheduleParsingError()
    }

    // strip out any punctuation from the usernames
    let white = undefined
    let black = undefined
    if (name_parts.length > 0) {
        white = name_parts[0].replace(/[@\.,\(\):]/g, '')
    }
    if (name_parts.length > 1) {
        black = name_parts[1].replace(/[@\.,\(\):]/g, '')
    }

    let date
    let outOfBounds = false
    let warn = false

    if (validInBoundsDate.length === 0 && validOutOfBoundsDate.length > 0) {
        date = validOutOfBoundsDate[0]
        outOfBounds = true
    } else {
        date = validInBoundsDate[0]
        if (date.isAfter(extrema.warning)) {
            warn = true
        }
    }
    return {
        white: white,
        black: black,
        date: date,
        warn: warn,
        outOfBounds: outOfBounds,
    }
}

// Calculate the extrema of the current round for both leagues.
//
// Each league has  slightly different requirements for when your
// game must be played. This method will return the given start datetime
// and end datetime for the round.
//
// Options:
//     extrema.referenceDate: If this is provided it the round is guaranteed
//       to include this date. Mostly used for tests.
//     extrema.isoWeekday: The weekday after which games cannot be scheduled.
//     extrema.hour: The hour after which games cannot be scheduled.
//     extrema.hour: The weekday on which the pairings are released.
//     extrema.warningHours: The amount of hours before the final scheduling
//       cutoff during which we will warn users they are cutting it close.
export function getRoundExtrema(options: SchedulingOptions): Extrema {
    // Get the reference date, which is either today or the referenceDate
    // from the options
    let roundStart = (options.referenceDate || moment.utc()).clone()
    let referenceDate = roundStart.clone()
    // Make it the right time of day.
    roundStart.hour(options.hour).minute(options.minute).second(0)

    // Find the first day that comes before our reference date
    // which is on th same weekday as the round starts.
    while (
        roundStart.isoWeekday() !== options.isoWeekday ||
        roundStart.isAfter(referenceDate)
    ) {
        roundStart.subtract(1, 'days')
    }

    // The end is always 7 days in advance
    let roundEnd = roundStart.clone().add(7, 'days')
    let warningEnd = roundEnd.clone().subtract(options.warningHours, 'hours')
    return makeExtrema({
        start: roundStart,
        end: roundEnd,
        warning: warningEnd,
        referenceDate: referenceDate,
    })
}

// There is not active round
function replyNoActiveRound(bot: SlackBot, message: CommandMessage) {
    let user = '<@' + message.user + '>'
    bot.reply(
        message,
        ':x: ' +
            user +
            ' There is currently no active round. If this is a mistake, contact a mod'
    )
}

// Can't find the pairing
function schedulingReplyMissingPairing(bot: SlackBot, message: CommandMessage) {
    let user = '<@' + message.user + '>'
    bot.reply(
        message,
        ':x: ' +
            user +
            " I couldn't find your pairing. Please use a format like: @white v @black 04/16 @ 16:00"
    )
}

// you are very close to the cutoff
function schedulingReplyTooCloseToCutoff(
    bot: SlackBot,
    message: CommandMessage,
    schedulingOptions: SchedulingOptions,
    white: LeagueMember,
    black: LeagueMember
) {
    bot.reply(
        message,
        ':heavy_exclamation_mark: @' +
            white.name +
            ' @' +
            black.name +
            ' ' +
            schedulingOptions.warningMessage
    )
}

// the pairing is ambiguous
function schedulingReplyAmbiguous(bot: SlackBot, message: CommandMessage) {
    bot.reply(
        message,
        'The pairing you are trying to schedule is ambiguous. Please contact a moderator.'
    )
}

// Game has been scheduled.
function schedulingReplyScheduled(
    bot: SlackBot,
    message: CommandMessage,
    results: Results,
    white: LeagueMember,
    black: LeagueMember,
    white_name: string,
    black_name: string
) {
    let whiteDate = results.date.clone()
    let blackDate = results.date.clone()
    whiteDate = white.tz
        ? whiteDate.tz(white.tz)
        : whiteDate.utcOffset(white.tz_offset / 60)
    blackDate = black.tz
        ? blackDate.tz(black.tz)
        : blackDate.utcOffset(black.tz_offset / 60)
    let format = 'YYYY-MM-DD @ HH:mm UTC'
    let friendly_format = 'ddd @ HH:mm'
    let dates = [
        results.date.format(format) + ' ',
        whiteDate.format(friendly_format) + ' for ' + white_name,
        blackDate.format(friendly_format) + ' for ' + black_name,
    ]
    let date_formats = dates.join('\n\t')
    if (
        white.tz &&
        moment().tz(white.tz).utcOffset() !== whiteDate.utcOffset()
    ) {
        date_formats +=
            '\n*<@' +
            white.id +
            '>: A daylight savings transition is in effect. Double check your time.*'
    }
    if (
        black.tz &&
        moment().tz(black.tz).utcOffset() !== blackDate.utcOffset()
    ) {
        date_formats +=
            '\n*<@' +
            black.id +
            '>: A daylight savings transition is in effect. Double check your time.*'
    }

    bot.reply(
        message,
        ':heavy_check_mark: <@' +
            white.id +
            '> (_white pieces_) vs <@' +
            black.id +
            '> (_black pieces_) scheduled for: \n\t' +
            date_formats
    )
}

// Your game is out of bounds
function schedulingReplyTooLate(
    bot: SlackBot,
    message: CommandMessage,
    schedulingOptions: SchedulingOptions
) {
    let user = '<@' + message.user + '>'
    bot.reply(message, ':x: ' + user + ' ' + schedulingOptions.lateMessage)
}

// can't find the users you menteiond
function schedulingReplyCantScheduleOthers(
    bot: SlackBot,
    message: CommandMessage
) {
    let user = '<@' + message.user + '>'
    bot.reply(
        message,
        ':x: ' +
            user +
            ' you may not schedule games for other people. You may only schedule your own games.'
    )
}

// can't find the users you menteiond
function schedulingReplyCantFindUser(bot: SlackBot, message: CommandMessage) {
    let user = '<@' + message.user + '>'
    bot.reply(
        message,
        ':x: ' + user + " I don't recognize one of the players you mentioned."
    )
}

export async function ambientScheduling(
    bot: SlackBot,
    message: CommandMessage
) {
    if (!isDefined(message.league)) {
        return
    }
    let league: League = message.league

    let speakerOr = bot.users.getByNameOrID(message.user)
    if (!isDefined(speakerOr)) return
    let speaker: LeagueMember = speakerOr

    let schedulingOptions = league.scheduling
    let channel = message.channel
    if (
        !schedulingOptions ||
        !channel ||
        !_.isEqual(channel.name, schedulingOptions.channel)
    ) {
        return
    }

    let heltourOptions = league.heltour
    if (!heltourOptions) {
        winston.error(
            `[SCHEDULING] ${league.name} league doesn't have heltour options!?`
        )
        return
    }

    let schedulingResults: SchedulingResult | undefined = undefined

    // Step 1. See if we can parse the dates
    try {
        schedulingResults = parseScheduling(message.text, schedulingOptions)
    } catch (e) {
        if (!(e instanceof ScheduleParsingError)) {
            throw e // let others bubble up
        } else {
            winston.debug(
                `[SCHEDULING] Received an exception: ${JSON.stringify(e)}`
            )
            winston.debug(`[SCHEDULING] Stack: ${e.stack}`)
        }
        return
    }

    // Step 2. See if we have valid named players
    let white: LeagueMember | undefined = undefined
    let black: LeagueMember | undefined = undefined
    if (schedulingResults.white && schedulingResults.black) {
        white = bot.users.getByNameOrID(schedulingResults.white)
        black = bot.users.getByNameOrID(schedulingResults.black)
        let referencesSlackUsers = false
        if (white && black) {
            referencesSlackUsers = true
        }

        if (!referencesSlackUsers) {
            winston.warn(
                `[SCHEDULING] Couldn't find slack users: ${JSON.stringify(
                    schedulingResults
                )}`
            )
            schedulingReplyCantFindUser(bot, message)
            return
        }
    } else {
        let pairings = message.league.findPairing(speaker.name)
        if (pairings.length === 1) {
            let pairing = pairings[0]
            schedulingResults.white = pairing.white
            schedulingResults.black = pairing.black
            white = bot.users.getByNameOrID(pairing.white)
            black = bot.users.getByNameOrID(pairing.black)
        }
    }
    if (!white || !black) {
        return
    }

    if (
        !_.isEqual(white.id, speaker.id) &&
        !_.isEqual(black.id, speaker.id) &&
        !league.isModerator(speaker.lichess_username)
    ) {
        schedulingReplyCantScheduleOthers(bot, message)
        return
    }

    winston.debug(
        `[SCHEDULING] Attempting to update the website: ${JSON.stringify(
            schedulingResults
        )}`
    )
    // Step 3. attempt to update the website
    try {
        let updateScheduleResults = await heltour.updateSchedule(
            heltourOptions,
            schedulingResults
        )

        if (updateScheduleResults['reversed']) {
            let tmp = white
            white = black
            black = tmp
        }

        if (schedulingResults.outOfBounds) {
            schedulingReplyTooLate(bot, message, schedulingOptions)
            return
        }
        if (schedulingResults.warn) {
            schedulingReplyTooCloseToCutoff(
                bot,
                message,
                schedulingOptions,
                white,
                black
            )
        }

        let leagueName = league.name
        let white_name = updateScheduleResults['white']
        let black_name = updateScheduleResults['black']
        schedulingReplyScheduled(
            bot,
            message,
            schedulingResults,
            white,
            black,
            white_name,
            black_name
        )
        // TODO: test this.
        subscription.emitter.emit(
            'a-game-is-scheduled',
            message.league,
            [white.name, black.name],
            {
                result: schedulingResults,
                white: white,
                black: black,
                leagueName: leagueName,
            }
        )
    } catch (error) {
        if (error.code === 'not_found') {
            schedulingReplyMissingPairing(bot, message)
        } else if (error.code === 'no_matching_rounds') {
            replyNoActiveRound(bot, message)
        } else if (error.code === 'ambiguous') {
            schedulingReplyAmbiguous(bot, message)
        } else {
            bot.reply(message, 'Something went wrong. Notify a mod')
        }
        winston.error(JSON.stringify(error))
        bot.reply(
            message,
            "Sorry, I couldn't update the scheduling. Try again later or reach out to a moderator to make the update manually."
        )
    }
}

