// -----------------------------------------------------------------------------
// Bot / Slack related helpers
// -----------------------------------------------------------------------------
import { RTMClient } from '@slack/rtm-api'
import {
    WebClient,
    WebAPICallResult,
    ChatPostMessageArguments,
} from '@slack/web-api'
import _ from 'lodash'
import * as winston from 'winston'
import moment from 'moment'

import * as league from './league'
import * as heltour from './heltour'
import * as fuzzy from './fuzzy_match'
import * as models from './models'
import SlackLogger, { LogWithPrefix } from './logging'
import { isDefined } from './utils'
import * as config from './config'

export type SlackUserID = string
export type SlackUserName = string
export type SlackChannelName = string
export type SlackTeamID = string
export interface SlackResponseMetadata {
    next_cursor: string
}
export interface SlackProfile {
    avatar_hash: string
    status_text: string
    status_emoji: string
    real_name: string
    display_name: string
    real_name_normalized: string
    display_name_normalized: string
    email: string
    image_24: string
    image_32: string
    image_48: string
    image_72: string
    image_192: string
    image_512: string
    team: string
}
export interface SlackUser {
    id: SlackUserID
    team_id: SlackTeamID
    name: SlackUserName
    deleted: boolean
    color: string
    real_name: string
    tz: string
    tz_label: string
    tz_offset: number
    profile: SlackProfile
    is_admin: boolean
    is_owner: boolean
    is_primary_owner: boolean
    is_restricted: boolean
    is_ultra_restricted: boolean
    is_bot: boolean
    updated: number
    is_app_user: boolean
    has_2fa: boolean
}
export interface SlackUserListResponse extends WebAPICallResult {
    ok: boolean
    members: SlackUser[]
    cache_ts: number
    response_metadata: SlackResponseMetadata
}
export interface SlackChannelTopicOrPurpose {
    value: string
    creator: SlackUserID
    last_set: number
}
export interface SlackChannelMembersList extends WebAPICallResult {
    ok: boolean
    members: string[]
    response_metadata: SlackResponseMetadata
}

export interface SlackChannel {
    id: string
    name: string
    is_channel: boolean
    is_group: boolean
    is_im: boolean
    created: number
    creator: SlackUserID
    is_archived: boolean
    is_general: boolean
    name_normalized: SlackChannelName
    is_shared: boolean
    is_org_shared: boolean
    is_member: boolean
    is_private: boolean
    is_mpim: boolean
    user?: string
    topic: SlackChannelTopicOrPurpose
    purpose: SlackChannelTopicOrPurpose
    previous_names: SlackChannelName[]
    num_members: number
    tz: string
    tz_offset: number
}
export interface SlackChannelListResponse extends WebAPICallResult {
    ok: boolean
    channels: SlackChannel[]
    cache_ts: number
    response_metadata: SlackResponseMetadata
}
export interface SlackChannelInfoResponse extends WebAPICallResult {
    ok: boolean
    channel: SlackChannel
}
export interface SlackUserInfoResponse extends WebAPICallResult {
    ok: boolean
    user: SlackUser
}
export interface SlackConversationChannel {
    id: string
}
export interface SlackConversation extends WebAPICallResult {
    ok: boolean
    channel: SlackConversationChannel
}
interface SlackEntityWithNameAndId {
    id: string
    name?: string
    lichess_username?: string
}
export interface SlackTeam {
    domain: string
    id: string
    name: string
}
interface SlackBotSelf {
    id: string
    name: string
}

export interface LeagueMember extends SlackUser {
    lichess_username: string
}

export function localTime(lm: LeagueMember, datetime: moment.Moment) {
    return datetime.clone().tz(lm.tz)
}

export function isLeagueMember(l: LeagueMember | undefined): l is LeagueMember {
    return l !== undefined
}

export interface SlackAttachmentField {
    title: string
    value: string
    short: boolean
}

export interface SlackAttachment {
    fallback: string
    color: string
    pretext: string
    author_name: string
    author_link: string
    author_icon: string
    title: string
    title_link: string
    text: string
    fields: SlackAttachmentField[]
    image_url: string
    thumb_url: string
    footer: string
    footer_icon: string
    ts: number
}

export interface SlackMessage {
    type: 'message' | 'app_mention'
    subtype: string
    client_msg_id: string
    user: SlackUserID
    bot_id?: SlackUserID
    channel: string
    text: string
    ts: string
    team: string
    // blocks: [ { type: 'rich_text', block_id: 'I4jc1', elements: [Array] } ],
    source_team: string
    user_team: string
    event_ts: string
    attachments: SlackAttachment[]
}

export interface ChessterMessage {
    type: 'message'
    user: SlackUserID
    channel: SlackChannel
    text: string
    member?: LeagueMember
    league?: league.League
    isModerator?: boolean
    ts: string
    attachments: SlackAttachment[]
}

export interface CommandMessage extends ChessterMessage {
    matches: RegExpMatchArray
}

export interface LeagueCommandMessage extends ChessterMessage {
    member: LeagueMember
    league: league.League
    isModerator: boolean
    matches: RegExpMatchArray
}

// -------------------------------------------------------------------------------
// Callback related types
export type HearsEventType =
    | 'ambient'
    | 'direct_message'
    | 'direct_mention'
    | 'bot_message'

export type MiddlewareFn = (
    bot: SlackBot,
    message: CommandMessage
) => CommandMessage

// export type ChessterCallbackFn = (bot: SlackBot, message: CommandMessage) => void
export type CommandCallbackFn = (bot: SlackBot, message: CommandMessage) => void
export type LeagueCommandCallbackFn = (
    bot: SlackBot,
    message: LeagueCommandMessage
) => void

export interface CommandEventOptions {
    type: 'command'
    patterns: RegExp[]
    messageTypes: HearsEventType[]
    middleware?: MiddlewareFn[]
    callback: CommandCallbackFn
}
export interface LeagueCommandEventOptions {
    type: 'league_command'
    patterns: RegExp[]
    messageTypes: HearsEventType[]
    middleware?: MiddlewareFn[]
    callback: LeagueCommandCallbackFn
}

export type SlackRTMEventListenerOptions =
    | CommandEventOptions
    | LeagueCommandEventOptions

function wantsBotMessage(options: SlackRTMEventListenerOptions) {
    return options.messageTypes.findIndex((t) => t === 'bot_message') !== -1
}
function wantsDirectMessage(options: SlackRTMEventListenerOptions) {
    return options.messageTypes.findIndex((t) => t === 'direct_message') !== -1
}
function wantsDirectMention(options: SlackRTMEventListenerOptions) {
    return options.messageTypes.findIndex((t) => t === 'direct_mention') !== -1
}
function wantsAmbient(options: SlackRTMEventListenerOptions) {
    return options.messageTypes.findIndex((t) => t === 'ambient') !== -1
}

export type OnEventType = 'member_joined_channel'

export interface MemberJoinedChannel {
    type: 'member_joined_channel'
    user: string
    channel: string
    channel_type: string
    team: string
    inviter: string
}
export type OnEvent = MemberJoinedChannel
export function isMemberJoinedChannelEvent(
    event: OnEvent
): event is MemberJoinedChannel {
    return event.type === 'member_joined_channel'
}
export type SlackOnCallbackFn = (bot: SlackBot, event: OnEvent) => void
export interface OnOptions {
    event: OnEventType
    callback: SlackOnCallbackFn
}

const SECONDS = 1000 // ms

const slackIDRegex = (module.exports.slackIDRegex = /<@([^\s]+)>/)

class StopControllerError extends Error {
    constructor(error: string) {
        super(error)
    }
}

export function appendPlayerRegex(command: string, optional: boolean) {
    /*
     * regex explanation
     * (?:           non capturing group, don't care about the space and @ part
     * @?            @ is optional (accepts "@user" or "user")
     * ([^\\s]+)     match one more more non-whitespace characters and capture it.  This
     *               is what will show up in the match[1] place.
     * )
     */
    const playerRegex = command + '(?: @?([^\\s]+))'

    if (optional) {
        // If the username is optional (as in the "rating" command), append
        // a ? to the whole player matching regex.
        return new RegExp(playerRegex + '?', 'i')
    }

    return new RegExp(playerRegex, 'i')
}

/*
   updates the user list
   updates the channel lists
   then repeats in new thread

   if it encounters an error it will exit the process with exit code 1
*/
function criticalPath<T>(promise: Promise<T>) {
    exceptionLogger(promise).catch(() => {
        winston.error(
            'An exception was caught in a critical code-path. I am going down.'
        )
        process.exit(1)
    })
    return promise
}

// a promise and ensures that uncaught exceptions are logged.
const exceptionLogger = <T>(promise: Promise<T>) =>
    new Promise((resolve, reject) => {
        promise.then(resolve).catch((e) => {
            const errorLog =
                'An error occurred:' +
                '\nDatetime: ' +
                new Date() +
                '\nError: ' +
                JSON.stringify(e) +
                '\nStack: ' +
                e.stack
            winston.error(errorLog)
            reject(e)
        })
    })

// -----------------------------------------------------------------------------
// Various middleware
// -----------------------------------------------------------------------------
export function requiresModerator(
    bot: SlackBot,
    message: CommandMessage
): CommandMessage {
    if (_.isUndefined(message.league)) {
        throw new Error('requiresModerator MUST be called after withLeague.')
    }
    if (!message.league) {
        throw new Error('Not in a league context')
    }
    if (!message.isModerator) {
        bot.reply(
            message,
            `You are not a moderator of the ${message.league.name} league. Your temerity has been logged.`
        )
        throw new StopControllerError('Not a moderator.')
    }
    return message
}

function findLeagueByMessageText(bot: SlackBot, message: ChessterMessage) {
    const allLeagues = league.getAllLeagues(bot)
    const leagueTargets: string[] = []
    const targetToLeague: Record<string, league.League> = {}
    function add_target(l: league.League, target: string) {
        leagueTargets.push(target)
        targetToLeague[target] = l
    }
    _.each(allLeagues, (l) => {
        add_target(l, l.name)
        _.each(l.config.alsoKnownAs, (aka) => add_target(l, aka))
    })

    // Now fuzzy match them based on each arg in the message
    const matches: fuzzy.Result[][] = []
    const args = message.text.split(' ')
    _.each(args, (arg) => {
        const results = fuzzy.rankChoices(arg.toLowerCase(), leagueTargets)
        matches.push(results)
    })
    const bestMatches = fuzzy.findBestMatches(_.flatten(matches))
    const possibleLeagues: Record<string, league.League> = {}
    _.each(bestMatches, (match) => {
        const l = targetToLeague[match.value]
        possibleLeagues[l.name] = l
    })
    const matchingLeagueNames = _.keys(possibleLeagues)
    if (matchingLeagueNames.length > 1) {
        throw new StopControllerError('Ambiguous leagues.')
    }
    if (matchingLeagueNames.length === 1) {
        return _.values(possibleLeagues)[0]
    }
    return null
}

function getLeague(
    bot: SlackBot,
    message: ChessterMessage,
    channelOnly: boolean
): league.League | undefined {
    message.league = undefined

    // generate a set of possible target leagues
    let l
    // If they didn't ask for a specific league, then we will use the channel
    // to determine it
    let targetLeague
    const channel = message.channel
    if (channel && channel.name) {
        targetLeague = bot.config.channelMap[channel.name]
        l = league.getLeague(bot, targetLeague)
        if (l) {
            message.league = l
            return l
        }
    }

    // If no channel name matched, try the channel Id this is necessary for private channels
    // it makes me sad ... :(
    if (channel && channel.id) {
        const channelId = channel.id
        targetLeague = bot.config.channelMap[channelId]
        if (targetLeague) {
            l = league.getLeague(bot, targetLeague)
            if (l) {
                message.league = l
                return l
            }
        }
    }

    // See if the person asked for a specific league first
    if (!channelOnly) {
        l = findLeagueByMessageText(bot, message)
        if (l) {
            message.league = l
            return l
        }
    }

    return undefined
}

export function requiresLeague(
    bot: SlackBot,
    message: CommandMessage
): CommandMessage {
    if (!message.league) {
        bot.reply(
            message,
            'This command requires you to specify the league you are interested in. Please include that next time'
        )
        throw new StopControllerError('No league specified')
    }
    return message
}

export class SlackEntityLookup<SlackEntity extends SlackEntityWithNameAndId> {
    public byName: Record<string, SlackEntity> = {}
    public byId: Record<string, SlackEntity> = {}
    private log: LogWithPrefix

    constructor(
        public slackName: string,
        public typePostfix: string,
        public idStringPrefix: string
    ) {
        this.log = new LogWithPrefix(`[Slack${typePostfix}(${slackName})]`)
    }

    clear() {
        this.byName = {}
        this.byId = {}
    }

    add(entity: SlackEntity) {
        this.byId[entity.id.toUpperCase()] = entity
        if (entity.name === undefined) {
            this.log.warn(`${entity.id} does not have a name`)
            return
        }
        this.byName[entity.name.toLowerCase()] = entity
        if (entity.lichess_username) {
            this.byName[entity.lichess_username.toLowerCase()] = entity
        }
    }

    getId(name: string): string | undefined {
        const entity = this.byName[name.toLowerCase()]
        if (!entity) {
            this.log.error("Couldn't find entity by name: " + name)
            return undefined
        }
        return entity.id
    }

    getName(id: string): string | undefined {
        const entity = this.byId[id]
        if (!entity) {
            this.log.error("Couldn't find entity by id: " + id)
            return undefined
        }
        return entity.name
    }

    getIdString(name: string): string | undefined {
        const id = this.getId(name)
        return `<${this.idStringPrefix}${id}>`
    }

    getByNameOrID(nameOrId: string): SlackEntity | undefined {
        return (
            this.byId[nameOrId.toUpperCase()] ||
            this.byName[nameOrId.toLowerCase()]
        )
    }
}

export class SlackBot {
    private log: LogWithPrefix
    public config: config.ChessterConfig
    private token: string
    public users: SlackEntityLookup<LeagueMember>
    public channels: SlackEntityLookup<SlackChannel>
    public mpims: SlackEntityLookup<SlackChannel>
    public dms: SlackEntityLookup<SlackChannel>
    public rtm: RTMClient
    public web: WebClient
    public controller?: SlackBotSelf
    private team?: SlackTeam
    private refreshCount = 0
    private listeners: SlackRTMEventListenerOptions[] = []

    constructor(
        public slackName: string,
        public configFile = './config/config.js',
        public debug = false,
        public connectToModels = true,
        public refreshLeagues = true,
        public logToThisSlack = false
    ) {
        this.log = new LogWithPrefix(`[SlackBot: ${this.slackName}]`)
        this.log.info(`Loading config from: ${this.configFile}`)
        this.config = config.ChessterConfigDecoder.decodeJSON(
            JSON.stringify(require(this.configFile))
        )
        this.token = this.config.slackTokens[this.slackName]

        if (!this.token) {
            const error = `Failed to load token for ${this.slackName} from ${this.configFile}`
            this.log.error(error)
            throw new Error(error)
        }
        this.users = new SlackEntityLookup<LeagueMember>(
            slackName,
            'Users',
            '@'
        )
        this.channels = new SlackEntityLookup<SlackChannel>(
            slackName,
            'Channels',
            '#'
        )
        this.mpims = new SlackEntityLookup<SlackChannel>(
            slackName,
            'Channels',
            '#'
        )
        this.dms = new SlackEntityLookup<SlackChannel>(
            slackName,
            'Channels',
            '#'
        )

        this.rtm = new RTMClient(this.token)
        this.web = new WebClient(this.token)
    }
    async start() {
        // Connect to Slack
        const { self, team } = await this.rtm.start()
        this.controller = self as SlackBotSelf
        this.team = team as SlackTeam

        // Listen to events that we need
        // https://api.slack.com/events
        this.rtm.on('goodbye', () => {
            // TODO: figure out how to better handle this
            this.log.error(
                'RTM connection closing unexpectedly. I am going down.'
            )
            process.exit(1)
        })

        // connect to the database
        if (this.connectToModels) {
            await models.connect(this.config)
        }

        this.startOnListener()

        // refresh your user and channel list every 2 minutes
        // would be nice if this was push model, not poll but oh well.
        await this.refresh(120 * SECONDS)

        // TODO: get this working again
        if (this.logToThisSlack) {
            // setup logging
            // Pass in a reference to ourselves.
            winston.info('adding slack logger')
            winston.add(
                new SlackLogger(
                    this,
                    this.config.winston.channel,
                    this.config.winston.username,
                    this.config.winston.level,
                    this.config.winston.handleExceptions
                )
            )
        }
    }

    async updatesUsers() {
        // Get our lichess username to slack username map
        const slackIDByLichessUsername = await heltour.getUserMap(
            this.config.heltour
        )
        if (this.controller) {
            slackIDByLichessUsername.chesster = this.controller.id
        }
        const lichessUsernameBySlackID: Record<SlackUserID, SlackUserName> = {}
        _.forOwn(slackIDByLichessUsername, (slackID, lichessUsername) => {
            lichessUsernameBySlackID[slackID] = lichessUsername.toLowerCase()
        })

        const newUsers = new SlackEntityLookup<LeagueMember>(
            this.users.slackName,
            this.users.typePostfix,
            this.users.idStringPrefix
        )

        // TODO: follow this bug report: https://github.com/slackapi/node-slack-sdk/issues/779
        // @ https://api.slack.com/methods/users.list
        //
        // Iterate over all of the slack users and map them up
        for await (const page of (this.web.paginate(
            'users.list'
        ) as unknown) as AsyncIterable<SlackUserListResponse>) {
            if (page.ok) {
                page.members.map((slackUser) => {
                    newUsers.add({
                        ...slackUser,
                        lichess_username:
                            lichessUsernameBySlackID[slackUser.id],
                    })
                })
            }
        }
        this.log.info('Updating Users')
        this.users = newUsers
    }

    async updateChannels() {
        const newChannels = new SlackEntityLookup<SlackChannel>(
            this.channels.slackName,
            this.channels.typePostfix,
            this.channels.idStringPrefix
        )
        const newMPIMs = new SlackEntityLookup<SlackChannel>(
            this.channels.slackName,
            this.channels.typePostfix,
            this.channels.idStringPrefix
        )
        const newDMs = new SlackEntityLookup<SlackChannel>(
            this.channels.slackName,
            this.channels.typePostfix,
            this.channels.idStringPrefix
        )
        // @ https://api.slack.com/methods/conversations.list
        for await (const page of (this.web.paginate('conversations.list', {
            types: 'public_channel,private_channel,mpim,im',
            exclude_archived: true,
        }) as unknown) as AsyncIterable<SlackChannelListResponse>) {
            if (page.ok) {
                page.channels.map((c) => {
                    if (c.is_channel) newChannels.add(c)
                    if (c.is_im) newDMs.add(c)
                    else newMPIMs.add(c)
                })
            }
        }
        this.channels = newChannels
        this.mpims = newMPIMs
        this.dms = newDMs
    }

    async getChannelMemberList(
        channel: SlackChannel
    ): Promise<SlackChannelMembersList> {
        const response = (await this.web.conversations.members({
            channel: channel.id,
        })) as SlackChannelMembersList
        return response
    }

    getLeagueMemberTarget(message: CommandMessage): LeagueMember | undefined {
        if (!isDefined(message.member)) {
            return
        }
        // The user is either a string or an id
        let nameOrId = message.member.id

        if (message.matches[1]) {
            nameOrId = message.matches[1]
        }
        const player = this.getSlackUserFromNameOrID(nameOrId)

        return player
    }

    getSlackUserFromNameOrID(nameOrId: string): LeagueMember | undefined {
        const self = this

        // The name or Id was provided, so parse it out
        const player = self.users.getByNameOrID(nameOrId)

        // If the player didn't exist that way, then it could be the @notation
        if (!player) {
            // Slack user ids are tranlated in messages to something like <@U17832>.  This
            // regex will capture the U17832 part so we can send it through the getByNameOrId
            // function
            const userIdExtraction = nameOrId.match(slackIDRegex)
            if (userIdExtraction) {
                return self.users.getByNameOrID(userIdExtraction[1])
            } else {
                return self.users.getByNameOrID(nameOrId.toLowerCase())
            }
        }
        return player
    }
    async refresh(delay: number) {
        return criticalPath(
            new Promise((resolve) => {
                this.refreshCount++
                this.log.info(`doing refresh ${this.refreshCount}`)

                // TODO: I can't find this in the new api
                // bot.rtm.ping()

                this.updatesUsers()
                this.updateChannels()
                if (this.refreshLeagues) {
                    this.log.info('Refreshing Leagues')
                    league.getAllLeagues(this).map((l) => l.refresh())
                    setTimeout(() => {
                        this.refresh(delay)
                    }, delay)
                }
                resolve()
            })
        )
    }

    async startPrivateConversation(
        nameOrId: string[]
    ): Promise<SlackConversation> {
        const targetUsers = nameOrId
            .map((u) => this.getSlackUserFromNameOrID(u))
            .filter(isDefined)
            .map((u) => u.id)
            .join(',')
        if (_.isNil(targetUsers)) {
            throw new Error('Unable to find user')
        } else {
            return (await this.web.conversations.open({
                users: targetUsers,
            })) as SlackConversation
        }
    }

    async reply(message: ChessterMessage, response: string) {
        if (!message.channel) return
        return this.say({
            channel: message.channel.id,
            text: response,
        })
    }

    async say(options: ChatPostMessageArguments) {
        // Replace user links in the form <@user> with <@U12345|user>
        if (options.text) {
            options.text = options.text.replace(
                /<\@([\w-\.]+)>/g,
                (match: string, username: string) => {
                    const user = this.users.getByNameOrID(username)
                    if (user) {
                        return '<@' + user.id + '|' + user.name + '>'
                    }
                    return match
                }
            )
        }
        return this.web.chat.postMessage(options)
    }

    async getChannel(channelId: string): Promise<SlackChannel | undefined> {
        let channel = this.channels.getByNameOrID(channelId)
        if (channel) return channel
        const channelResponse = (await this.web.conversations.info({
            channel: channelId,
        })) as SlackChannelInfoResponse
        if (channelResponse.ok) {
            channel = channelResponse.channel
            this.channels.add(channel)
            return channel
        }
        return undefined
    }

    async getUser(userId: string): Promise<SlackUser | undefined> {
        let user: SlackUser | undefined = this.users.getByNameOrID(userId)
        if (user) return user
        const userResponse = (await this.web.users.info({
            user: userId,
        })) as SlackUserInfoResponse
        if (userResponse.ok) {
            user = userResponse.user
            return user
        }
        return undefined
    }

    async react(message: CommandMessage, emoji: string) {
        if (!message.ts) return
        return this.web.reactions.add({
            channel: message.channel.id,
            name: emoji,
            timestamp: message.ts.toString(),
        })
    }

    async handleMatch(
        listener: SlackRTMEventListenerOptions,
        message: CommandMessage
    ) {
        let allowedTypes = ['command', 'league_command']
        const member = this.users.getByNameOrID(message.user)
        const _league = getLeague(this, message, false)
        if (!_league || !member) {
            allowedTypes = ['command']
        }

        try {
            try {
                if (
                    listener.type === 'command' &&
                    allowedTypes.indexOf('command') !== -1
                ) {
                    _.map(listener.middleware, (m) => m(this, message))
                    listener.callback(this, message)
                } else if (
                    listener.type === 'league_command' &&
                    allowedTypes.indexOf('league_command') !== -1
                ) {
                    if (_league && member) {
                        // Typescript should have been able know that they are set appropriately
                        // here.
                        _.map(listener.middleware, (m) => m(this, message))
                        const leagueCommandMessage: LeagueCommandMessage = {
                            ...message,
                            league: _league,
                            member,
                            isModerator: _league.isModerator(message.user),
                        }
                        listener.callback(this, leagueCommandMessage)
                    } else {
                        this.log.warn('Typescript failed me')
                    }
                }
            } catch (error) {
                if (error instanceof StopControllerError) {
                    this.log.error(
                        `Middleware asked to not process controller callback: ${JSON.stringify(
                            error
                        )}`
                    )
                }
            }
        } catch (e) {
            this.log.info(`Error handling event: ${message}`)
            this.say({
                channel: message.channel.id,
                text:
                    'Something has gone terribly terribly wrong. Please forgive me.',
            })
        }
    }

    async startOnListener() {
        this.rtm.on('message', async (event: SlackMessage) => {
            try {
                const channel = await this.getChannel(event.channel)
                if (!channel) {
                    this.log.warn(
                        `Unable to get details for channel: ${event.channel}`
                    )
                    return
                }
                const chessterMessage: ChessterMessage = {
                    ...event,
                    type: 'message',
                    channel,
                }

                const isDirectMessage =
                    channel && channel.is_im && !channel.is_group
                const isDirectMention =
                    chessterMessage.text.indexOf(
                        `<@${this.controller?.id}>`
                    ) !== -1
                const isBotMessage = event.subtype === 'bot_message'
                const isAmbient = !(
                    isDirectMention ||
                    isDirectMessage ||
                    isBotMessage
                )
                this.listeners.map(async (listener) => {
                    let isWanted = false
                    let text = event.text
                    if (isDirectMessage && wantsDirectMessage(listener)) {
                        isWanted = true
                    } else if (
                        isDirectMention &&
                        wantsDirectMention(listener)
                    ) {
                        isWanted = true
                        text = text.replace(`<@${this.controller?.id}> `, '')
                        text = text.replace(`<@${this.controller?.id}>`, '')
                    } else if (isAmbient && wantsAmbient(listener)) {
                        isWanted = true
                    } else if (isBotMessage && wantsBotMessage(listener)) {
                        isWanted = true
                    }

                    if (!isWanted) return

                    listener.patterns.some((p) => {
                        const matches = text.match(p)
                        if (!matches) return false
                        this.handleMatch(listener, {
                            ...chessterMessage,
                            text: text.trim(),
                            matches,
                        })
                        return true
                    })
                })
            } catch (error) {
                this.log.error(
                    `Uncaught error in handling an rtm message: ${JSON.stringify(
                        error
                    )}`
                )
            }
        })
    }

    hears(options: SlackRTMEventListenerOptions): void {
        this.listeners.push(options)
    }

    on(options: OnOptions) {
        return this.rtm.on(options.event, (event) =>
            options.callback(this, event)
        )
    }
}
