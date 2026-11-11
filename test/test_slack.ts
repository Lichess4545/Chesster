import { assert } from 'chai'
import { isSlackFatalError, SlackBot } from '../src/slack'
import { Env } from '../src/env'

const env: Env = {
    DATABASE_URL:
        'postgres://chesster:chesster@localhost:5432/chesster?sslmode=disable',
    LICHESS_4545_APP_TOKEN: 'xapp-test',
    LICHESS_4545_SIGNING_SECRET: 'test-signing-secret',
    LICHESS_4545_BOT_TOKEN: 'xoxb-test',
    FORWARD_APP_TOKEN: 'xapp-test',
    FORWARD_SIGNING_SECRET: 'test-signing-secret',
    FORWARD_BOT_TOKEN: 'xoxb-test',
    CHESSTER_HELTOUR_TOKEN: 'test-heltour-token',
    CHESSTER_LICHESS_TOKEN: 'test-lichess-token',
    CHESSTER_CONFIG: 'development',
}

function slackFatalError() {
    return Object.assign(new Error('An API error occurred: fatal_error'), {
        code: 'slack_webapi_platform_error',
        data: { ok: false, error: 'fatal_error' },
    })
}

describe('slack', function () {
    describe('#isSlackFatalError()', function () {
        it('matches only a Slack platform fatal_error', function () {
            assert.isTrue(isSlackFatalError(slackFatalError()))
            assert.isFalse(
                isSlackFatalError(
                    Object.assign(new Error('invalid auth'), {
                        code: 'slack_webapi_platform_error',
                        data: { ok: false, error: 'invalid_auth' },
                    })
                )
            )
            assert.isFalse(isSlackFatalError(new Error('boom')))
            assert.isFalse(isSlackFatalError(undefined))
        })
    })

    describe('#refresh()', function () {
        it('survives a Slack fatal_error and keeps the previous sync', async function () {
            const bot = new SlackBot(
                'lichess4545',
                env,
                false, // debug
                false, // connectToModels
                false, // refreshLeagues
                false // logToThisSlack
            )
            bot.updatesUsers = async () => {
                throw slackFatalError()
            }
            bot.updateChannels = async () => {}

            await bot.refresh(600 * 1000)
        })
    })
})
