// -----------------------------------------------------------------------------
// Bot / Slack related helpers
// -----------------------------------------------------------------------------
import { App } from '@slack/bolt'

// Load environment variables; don't delete this
// This is particularly for Events API stuff
import dotenv from 'dotenv'
dotenv.config({
    path: './local.env',
})

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
    isPingModerator: boolean
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
    public nameDuplicates: Record<string, SlackEntity[]> = {}
    public idDuplicates: Record<string, SlackEntity[]> = {}
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

    _addByIdWithDuplicate(id: string, entity: SlackEntity) {
        if (isDefined(this.byId[id])) {
            this.idDuplicates[id].push(entity)
        } else {
            this.idDuplicates[id] = [entity]
        }
        this.byId[id] = entity
    }

    _addByNameWithDuplicate(key: string, entity: SlackEntity) {
        if (isDefined(this.byName[key])) {
            this.nameDuplicates[key].push(entity)
        } else {
            this.nameDuplicates[key] = [entity]
        }
        this.byName[key] = entity
    }

    idDuplicateCount(id: string) {
        id = id.toUpperCase()
        const l = this.idDuplicates[id]
        if (isDefined(l)) {
            return l.length
        }
        return 0
    }

    getIdDuplicates(id: string): SlackEntity[] {
        id = id.toUpperCase()
        const l = this.idDuplicates[id]
        if (isDefined(l)) {
            return l
        }
        return []
    }

    // In SlackEntityLookup class, update the add method:
    add(entity: SlackEntity) {
        // Always add by ID
        this._addByIdWithDuplicate(entity.id.toUpperCase(), entity)

        // Special handling for DM channels (they won't have names)
        if (entity.id.startsWith('D')) {
            // For DM channels, we just store them by ID and don't require names
            return
        }

        // Warning for non-DM entities without names
        if (entity.name === undefined) {
            this.log.warn(`${entity.id} does not have a name`)
            return
        }

        // Add by name if it exists
        if (entity.name) {
            const slackName = entity.name.toLowerCase()
            this._addByNameWithDuplicate(slackName, entity)
        }

        // Add by lichess username if it exists
        if (entity.lichess_username) {
            const lichessId = entity.lichess_username.toLowerCase()
            this._addByNameWithDuplicate(lichessId, entity)
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
    // public rtm: RTMClient
    public web: WebClient
    public controller?: SlackBotSelf
    private team?: SlackTeam
    private refreshCount = 0
    private listeners: SlackRTMEventListenerOptions[] = []
    private app: App

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

        // Confusing naming; chesster is the name of adminSlack; lichess4545 is the name of actual chesster
        // @ts-expect-error it thinks token can be undefined here but it's incorrect
        this.token =
            this.slackName === 'lichess4545'
                ? process.env.SLACK_APP_TOKEN // Chesster bot token
                : this.slackName === 'chesster'
                ? process.env.CHESSTER_CHESSTER_SLACK_TOKEN // AdminSlack bot token'
                : "It won't work without this"

        if (!this.token) {
            const error = `Failed to load token for ${this.slackName} from ${this.configFile}`
            this.log.error(error)
            throw new Error(error)
        }

        // Confusing naming conventions; chesster is the name of adminSlack; lichess4545 is the name of actual chesster
        const signingSecret =
            this.slackName === 'lichess4545'
                ? process.env.SLACK_SIGNING_SECRET // Chesster
                : process.env.ADMIN_SLACK_SIGNING_SECRET // AdminSlack

        // Confusing naming conventions; chesster is the name of adminSlack; lichess4545 is the name of actual chesster
        const appToken =
            this.slackName === 'lichess4545'
                ? process.env.SLACK_APP_TOKEN // Chesster
                : process.env.ADMIN_SLACK_APP_TOKEN // adminSlack

        // May need changing with events API migration
        this.users = new SlackEntityLookup<LeagueMember>(
            slackName,
            'Users',
            '@'
        )
        // May need changing with events API migration
        this.channels = new SlackEntityLookup<SlackChannel>(
            slackName,
            'Channels',
            '#'
        )

        // Naming conventions are confusing here
        // chesster is the name of adminSlack; lichess4545 is the name of actual chesster
        const botToken =
            this.slackName === 'lichess4545'
                ? process.env.SLACK_APP_BOT_TOKEN // Chesster
                : process.env.ADMIN_SLACK_BOT_TOKEN // adminSlack

        this.web = new WebClient(botToken)

        // TODO maybe these tokens should go in config or something?
        this.app = new App({
            token: botToken,
            signingSecret,
            // Websocket that continously listens for events
            socketMode: true,
            appToken,
        })
    }
    async start() {
        this.log.info('Starting Chesster with Events API')

        // Turns chesster on
        await this.app.start()
        this.log.info('Bolt app started successfully')

        // Connect to the database FIRST
        if (this.connectToModels) {
            try {
                winston.info(
                    '[SlackBot.start()] Attempting to connect to database...'
                )

                await models.connect(this.config)
                winston.info('Database connected successfully')
            } catch (error) {
                this.log.error(`Database connection error: ${error}`)
                // Continue execution even after database error
                this.log.warn(
                    'Continuing without database connection (features requiring database will not work)'
                )
            }
        }
        // Get bot information to set controller/self ID SECOND
        try {
            const authInfo = await this.app.client.auth.test()
            this.log.info(`Auth info: ${JSON.stringify(authInfo)}`)

            if (authInfo.ok) {
                this.controller = {
                    id: authInfo.user_id as string,
                    name: authInfo.user as string,
                }
                this.log.info(
                    `Bot controller set - ID: ${this.controller.id}, Name: ${this.controller.name}`
                )
            } else {
                this.log.error('Failed to get bot information')
            }
        } catch (error) {
            this.log.error(`Error getting bot info: ${error}`)
        }

        // Load users and channels THIRD
        try {
            this.log.info('Loading users...')
            await this.updatesUsers()
            this.log.info('Users loaded successfully')

            this.log.info('Loading channels...')
            await this.updateChannels()
            this.log.info('Channels loaded successfully')
        } catch (error) {
            this.log.error(`Error loading users/channels: ${error}`)
        }

        // Set up event listeners LAST - after all data is loaded
        this.log.info('Setting up event listeners')
        await this.startOnListener()

        this.log.info('Chesster is ready!')

        this.app.logger.info('Starting app')

        // Connect to Slack
        // const { self, team } = await this.rtm.start()
        // this.controller = self as SlackBotSelf
        // this.team = team as SlackTeam

        // Listen to events that we need
        // https://api.slack.com/events
        // this.rtm.on('goodbye', () => {
        //     // TODO: figure out how to better handle this
        //     this.log.error(
        //         'RTM connection closing unexpectedly. I am going down.'
        //     )
        //     process.exit(1)
        // })

        // -----------------------------------------------------------------------------
        // Log lifecycle events
        // this.rtm.on('connecting', () => {
        //     this.log.info('Connecting')
        // })
        // this.rtm.on('authenticated', (connectData) => {
        //     this.log.info(`Authenticating: ${JSON.stringify(connectData)}`)
        // })
        // this.rtm.on('connected', () => {
        //     this.log.info('Connected')
        // })
        // this.rtm.on('ready', () => {
        //     this.log.info('Ready')
        // })
        // this.rtm.on('disconnecting', () => {
        //     this.log.info('Disconnecting')
        // })
        // this.rtm.on('reconnecting', () => {
        //     this.log.info('Reconnecting')
        // })
        // this.rtm.on('disconnected', (error) => {
        //     this.log.error(`Disconnecting: ${JSON.stringify(error)}`)
        // })
        // this.rtm.on('error', (error) => {
        //     this.log.error(`Error: ${JSON.stringify(error)}`)
        // })
        // this.rtm.on('unable_to_rtm_start', (error) => {
        //     this.log.error(`Unable to RTM start: ${JSON.stringify(error)}`)
        // })

        // refresh your user and channel list every 10 minutes.
        // used to be every 2 minutes but we started to hit rate limits.
        // would be nice if this was push model, not poll but oh well.
        await this.refresh(600 * SECONDS)

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
        for await (const page of this.web.paginate(
            'users.list'
        ) as unknown as AsyncIterable<SlackUserListResponse>) {
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
        _.forOwn(slackIDByLichessUsername, (slackID, lichessUsername) => {
            const slackUser = newUsers.getByNameOrID(slackID)
            if (!slackUser) {
                return
            }
            newUsers.add({
                ...slackUser,
                lichess_username: lichessUsername.toLowerCase(),
            })
        })
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
        // @ https://api.slack.com/methods/conversations.list
        for await (const page of this.web.paginate('conversations.list', {
            types: 'public_channel,private_channel',
            exclude_archived: true,
        }) as unknown as AsyncIterable<SlackChannelListResponse>) {
            if (page.ok) {
                page.channels.map((c) => {
                    if (c.is_channel) newChannels.add(c)
                })
            }
        }
        this.channels = newChannels
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
            new Promise<void>((resolve) => {
                this.refreshCount++
                this.log.info(`doing refresh ${this.refreshCount}`)

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

    async hasSingleUser(message: CommandMessage) {
        const usernames = Array.from(
            new Set<string>(
                this.users
                    .getIdDuplicates(message.user)
                    .map((u) => u.lichess_username)
            )
        )
        const c = usernames.length
        if (c === 1) {
            return true
        } else {
            await this.reply(
                message,
                `This command requires you to have a single lichess account associated with your slack account. you have ${c}:
${usernames.join(', ')}`
            )
            return false
        }
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
        options.as_user = true
        // Ensure attachments is always an array as required by Bolt's client
        if (!options.attachments) {
            options.attachments = []
        }

        // @ts-ignore
        return this.app.client.chat.postMessage({
            ...options,
            attachments: options.attachments ? options.attachments : [],
            reply_broadcast: options.reply_broadcast
                ? options.reply_broadcast
                : false,
            thread_ts: options.thread_ts ? options.thread_ts : '',
            as_user: true,
            icon_emoji: undefined,
        })
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

    // Events API migration: I don't believe this needs changes because webClient is the same
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
        this.log.info(
            `handleMatch called with pattern: ${listener.patterns
                .map((p) => p.source)
                .join(', ')} and message: ${message.text}`
        )

        let allowedTypes = ['command', 'league_command']
        let member: LeagueMember | undefined
        if (message.user) {
            member = this.users.getByNameOrID(message.user)
            // Add this debugging line
            this.log.info(
                `Handle match found user: ${
                    member?.name || 'UNDEFINED'
                } for ID: ${message.user}`
            )
        }
        const _league = getLeague(this, message, false)
        if (!_league || !member) {
            allowedTypes = ['command']
        }
        message.isPingModerator =
            message.channel.id in this.config.pingMods &&
            !!member &&
            this.config.pingMods[message.channel.id].includes(member.id)

        try {
            try {
                if (
                    listener.type === 'command' &&
                    allowedTypes.indexOf('command') !== -1
                ) {
                    // IMPORTANT FIX: Log before callback
                    this.log.info(
                        `Executing command callback for pattern: ${listener.patterns
                            .map((p) => p.source)
                            .join(', ')}`
                    )

                    // Run any middleware first
                    if (listener.middleware) {
                        listener.middleware.forEach((m) =>
                            m(this, { member, ...message })
                        )
                    }

                    // Execute the command callback - THIS IS THE CRUCIAL PART
                    listener.callback(this, { member, ...message })

                    // Log after execution
                    this.log.info('Command executed successfully')
                } else if (
                    listener.type === 'league_command' &&
                    allowedTypes.indexOf('league_command') !== -1
                ) {
                    if (_league && member) {
                        // SAME FIX HERE
                        this.log.info(
                            `Executing league_command callback for pattern: ${listener.patterns
                                .map((p) => p.source)
                                .join(', ')}`
                        )

                        // Run middleware first
                        if (listener.middleware) {
                            listener.middleware.forEach((m) => m(this, message))
                        }

                        const leagueCommandMessage: LeagueCommandMessage = {
                            ...message,
                            league: _league,
                            member,
                            isModerator: _league.isModerator(
                                member.lichess_username
                            ),
                        }

                        // Execute command
                        listener.callback(this, leagueCommandMessage)

                        this.log.info('League command executed successfully')
                    } else {
                        this.log.warn(
                            'Cannot execute league command - missing league or member'
                        )
                    }
                }
            } catch (error) {
                this.log.error(
                    `Error in command execution: ${
                        error instanceof Error ? error.message : String(error)
                    }`
                )
                if (error instanceof StopControllerError) {
                    this.log.error(
                        `Middleware asked to not process controller callback: ${JSON.stringify(
                            error
                        )}`
                    )
                }
            }
        } catch (e) {
            this.log.error(
                `Critical error handling event: ${
                    e instanceof Error ? e.message : String(e)
                }`
            )
            this.say({
                channel: message.channel.id,
                text: 'Something has gone terribly terribly wrong. Please forgive me.',
            })
        }
    }

    // Events API migration notes:
    // This function does the following (per Lakin):
    // Gets info about the channel of the message
    // Makes a chessterMessage object with our data in it.
    // Checks a bunch of attributes is it a bot? is it a DM?
    // Then it routes the message to the appropriate "listener"
    // The listener concept is just the idea of a callback.
    async startOnListener() {
        // Set up event handler for direct messages and ambient messages
        // Messages that ping chesster directly are handled in `this.app.event('app_mention', ...)`
        this.app.message(/.*/, async ({ message, say, context }) => {
            try {
                const channel = await this.getChannel(message.channel)
                if (!channel) {
                    this.log.warn(
                        `Unable to get details for channel: ${message.channel}`
                    )
                    return
                }

                // @ts-expect-error user exists on message
                const user = message.user
                // @ts-expect-error text exists on message
                const text = message.text || ''

                const chessterMessage: ChessterMessage = {
                    type: 'message',
                    user,
                    channel,
                    text,
                    ts: message.ts,
                    // @ts-ignore
                    attachments: message.attachments || [],
                    isPingModerator: false,
                }

                // Message context
                const isDirectMessage = channel?.is_im && !channel?.is_group
                const isAmbient = !isDirectMessage
                const isBotMessage =
                    // @ts-expect-error these properties exist on the message
                    message.subtype === 'bot_message' || message.bot_id

                this.log.debug(
                    `Message context: DM=${isDirectMessage}, ambient=${isAmbient}, bot=${isBotMessage}`
                )

                // Process each listener
                this.listeners.forEach((listener) => {
                    let isWanted = false

                    if (isDirectMessage && wantsDirectMessage(listener)) {
                        isWanted = true
                    } else if (isAmbient && wantsAmbient(listener)) {
                        isWanted = true
                    } else if (isBotMessage && wantsBotMessage(listener)) {
                        isWanted = true
                    }

                    if (!isWanted) return

                    this.log.debug(
                        `Checking patterns for listener: ${listener.patterns
                            .map((p) => p.source)
                            .join(', ')}`
                    )

                    for (const pattern of listener.patterns) {
                        const matches = text.match(pattern)
                        if (!matches) continue

                        this.log.debug(
                            `Found match for pattern: ${pattern.source}`
                        )
                        this.handleMatch(listener, {
                            ...chessterMessage,
                            matches,
                        })
                        break
                    }
                })
            } catch (error) {
                this.log.error(`Error handling message: ${error}`)
                await say(
                    'Error processing your message. Please try again later.'
                )
            }
        })

        // Set up event handler for @mentions
        // Messages that don't ping chesster directly are handled in `this.app.message...`
        // TODO this.app.event and this.app.message have very similar logic; combine them into a util of some sort
        this.app.event('app_mention', async ({ event, say }) => {
            try {
                const channel = await this.getChannel(event.channel)
                if (!channel) {
                    this.log.warn(
                        `Unable to get details for channel: ${event.channel}`
                    )
                    return
                }

                let text = event.text || ''

                this.log.info(
                    `Original text: "${text}", controller id: ${
                        this.controller?.id || 'undefined'
                    }`
                )

                if (this.controller?.id) {
                    text = text.replace(
                        new RegExp(`<@${this.controller.id}>\\s*`, 'g'),
                        ''
                    )
                    this.log.info(`Text after removing mention: "${text}"`)
                }

                const chessterMessage: ChessterMessage = {
                    type: 'message',
                    user: event.user || '',
                    channel,
                    text,
                    ts: event.ts,
                    attachments: [],
                    isPingModerator: false,
                }

                // Loop through ALL command listeners to find matches
                let matched = false

                // Find command listeners first
                for (const listener of this.listeners) {
                    if (
                        listener.type === 'command' &&
                        listener.messageTypes.includes('direct_mention')
                    ) {
                        for (const pattern of listener.patterns) {
                            this.log.info(
                                `Checking pattern: ${pattern.source} against text: "${text}"`
                            )
                            const matches = text.match(pattern)
                            if (matches) {
                                this.log.info(
                                    `✓ MATCHED pattern: ${pattern.source}`
                                )
                                matched = true
                                await this.handleMatch(listener, {
                                    ...chessterMessage,
                                    matches,
                                })
                                return // Exit after first match
                            }
                        }
                    }
                }

                // If no command match, try league_command listeners
                if (!matched) {
                    for (const listener of this.listeners) {
                        if (
                            listener.type === 'league_command' &&
                            listener.messageTypes.includes('direct_mention')
                        ) {
                            for (const pattern of listener.patterns) {
                                const matches = text.match(pattern)
                                if (matches) {
                                    this.log.info(
                                        `✓ MATCHED league pattern: ${pattern.source}`
                                    )
                                    await this.handleMatch(listener, {
                                        ...chessterMessage,
                                        matches,
                                    })
                                    return // Exit after first match
                                }
                            }
                        }
                    }
                }

                if (!matched) {
                    this.log.info(
                        `No matching listener found for text: "${text}" among ${this.listeners.length} listeners`
                    )
                }
            } catch (error) {
                this.log.error(`Error handling app_mention: ${error}`)
            }
        })
    }

    hears(options: SlackRTMEventListenerOptions): void {
        this.listeners.push(options)
    }

    on(options: OnOptions) {
        if (options.event === 'member_joined_channel') {
            this.app.event('member_joined_channel', async ({ event }) => {
                // @ts-ignore hope I don't regret this lol
                options.callback(this, event)
            })
        }
    }
}
