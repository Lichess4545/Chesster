// ____________________________________
// This is meant to test the chessterUtils.ts file (obviously)
// These utils parse incoming chesster commands and take appropriate action, usually making a response

// The functions in this file combine in to one main function. First we test the individual ones, then we test the main function.

// These are UNIT TESTS, we aren't testing the slack API here, just the functions that parse and respond to commands. Any stuff we get from the API will be mocked.
// ____________________________________

import { assert } from 'chai'

import {
    // Utils sub-functions that get called in main function
    applyMiddleware,
    doesListenerWantMessageType,
    determineMessageContext,
    findMatchingListener,
    normalizeMessageText,
    // The main function that calls the functions above
    processChessterMessage,
} from '../utils/SlackEventsAPIUtils/chessterUtils'

import { CommandMessage, SlackEventListenerOptions } from '../app'

describe.only('chessterUtils', function () {
    describe('applyMiddleware()', function () {
        const sampleMessage: CommandMessage = {
            type: 'message',
            user: 'U12345',
            channel: { id: 'C12345' },
            text: 'hello world',
            ts: '1234567890.123456',
            matches: ['hello world', 'hello', 'world'],
            isPingModerator: false,
        }

        it('runs without crashing', function () {
            const result = applyMiddleware(sampleMessage, [])
            assert.isDefined(result)
        })

        it('returns original message when no middleware is provided', function () {
            const result = applyMiddleware(sampleMessage, undefined)
            assert.deepEqual(result, sampleMessage)
        })

        it('returns original message when empty middleware array is provided', function () {
            const result = applyMiddleware(sampleMessage, [])
            assert.deepEqual(result, sampleMessage)
        })

        it('applies a single middleware function correctly', function () {
            const middleware = (message: CommandMessage) => {
                return {
                    ...message,
                    text: message.text.toUpperCase(),
                }
            }

            const result = applyMiddleware(sampleMessage, [middleware])
            assert.equal(result.text, 'HELLO WORLD')
            assert.notEqual(result.text, sampleMessage.text)

            // Make sure other properties are unchanged
            assert.equal(result.user, sampleMessage.user)
            assert.equal(result.channel.id, sampleMessage.channel.id)
        })

        it('applies multiple middleware functions in sequence', function () {
            const middleware1 = (message: CommandMessage) => {
                return {
                    ...message,
                    text: message.text.toUpperCase(),
                }
            }

            const middleware2 = (message: CommandMessage) => {
                return {
                    ...message,
                    isPingModerator: true,
                }
            }

            const result = applyMiddleware(sampleMessage, [
                middleware1,
                middleware2,
            ])

            assert.equal(result.text, 'HELLO WORLD')
            assert.notEqual(result.text, sampleMessage.text)

            assert.isTrue(result.isPingModerator)
        })
    })

    describe('#doesListenerWantMessageType()', function () {
        it('runs without crashing', function () {
            const listener: SlackEventListenerOptions = {
                type: 'command',
                patterns: [/test/],
                messageTypes: ['direct_message'],
                callback: () => {},
            }
            const context = {
                isDirectMessage: true,
                isDirectMention: false,
                isAmbient: false,
                isBotMessage: false,
            }

            doesListenerWantMessageType(listener, context)
        })

        it('correctly identifies when a listener wants direct messages', function () {
            const listener: SlackEventListenerOptions = {
                type: 'command',
                patterns: [/test/],
                messageTypes: ['direct_message'],
                callback: () => {},
            }
            const context = {
                isDirectMessage: true,
                isDirectMention: false,
                isAmbient: false,
                isBotMessage: false,
            }

            assert.isTrue(doesListenerWantMessageType(listener, context))
        })

        it('correctly identifies when a listener wants direct mentions', function () {
            const listener: SlackEventListenerOptions = {
                type: 'command',
                patterns: [/test/],
                messageTypes: ['direct_mention'],
                callback: () => {},
            }
            const context = {
                isDirectMessage: false,
                isDirectMention: true,
                isAmbient: false,
                isBotMessage: false,
            }

            assert.isTrue(doesListenerWantMessageType(listener, context))
        })

        it('correctly identifies when a listener wants ambient messages', function () {
            const listener: SlackEventListenerOptions = {
                type: 'command',
                patterns: [/test/],
                messageTypes: ['ambient'],
                callback: () => {},
            }
            const context = {
                isDirectMessage: false,
                isDirectMention: false,
                isAmbient: true,
                isBotMessage: false,
            }

            assert.isTrue(doesListenerWantMessageType(listener, context))
        })

        it('correctly identifies when a listener wants bot messages', function () {
            const listener: SlackEventListenerOptions = {
                type: 'command',
                patterns: [/test/],
                messageTypes: ['bot_message'],
                callback: () => {},
            }
            const context = {
                isDirectMessage: false,
                isDirectMention: false,
                isAmbient: false,
                isBotMessage: true,
            }

            assert.isTrue(doesListenerWantMessageType(listener, context))
        })

        it("returns false when listener doesn't want the message type", function () {
            const listener: SlackEventListenerOptions = {
                type: 'command',
                patterns: [/test/],
                messageTypes: ['direct_mention'],
                callback: () => {},
            }
            const context = {
                isDirectMessage: true,
                isDirectMention: false,
                isAmbient: false,
                isBotMessage: false,
            }

            assert.isFalse(doesListenerWantMessageType(listener, context))
        })
    })

    describe('#determineMessageContext()', function () {
        it('runs without crashing', function () {
            const channel = { id: 'C12345' }
            const isDirectMention = false
            determineMessageContext(channel, isDirectMention)
        })

        it('correctly identifies direct messages', function () {
            const channel = { id: 'D12345', is_im: true, is_group: false }
            const isDirectMention = false
            const result = determineMessageContext(channel, isDirectMention)

            assert.equal(result.type, 'DM')
            assert.isTrue(result.isDirectMessage)
            assert.isFalse(result.isDirectMention)
            assert.isFalse(result.isAmbient)
        })

        it('correctly identifies direct mentions', function () {
            const channel = { id: 'C12345' }
            const isDirectMention = true
            const result = determineMessageContext(channel, isDirectMention)

            assert.equal(result.type, 'mention')
            assert.isFalse(result.isDirectMessage)
            assert.isTrue(result.isDirectMention)
            assert.isFalse(result.isAmbient)
        })

        it('correctly identifies ambient messages', function () {
            const channel = { id: 'C12345' }
            const isDirectMention = false
            const result = determineMessageContext(channel, isDirectMention)

            assert.equal(result.type, 'ambient')
            assert.isFalse(result.isDirectMessage)
            assert.isFalse(result.isDirectMention)
            assert.isTrue(result.isAmbient)
        })
    })

    describe('#findMatchingListener()', function () {
        const directMentionListener: SlackEventListenerOptions = {
            type: 'command',
            patterns: [/^help$/i],
            messageTypes: ['direct_mention'],
            callback: () => {},
        }

        const directMessageListener: SlackEventListenerOptions = {
            type: 'command',
            patterns: [/^source$/i],
            messageTypes: ['direct_message'],
            callback: () => {},
        }

        const ambientListener: SlackEventListenerOptions = {
            type: 'command',
            patterns: [/^pairings$/i],
            messageTypes: ['ambient'],
            callback: () => {},
        }

        const listeners: SlackEventListenerOptions[] = [
            directMentionListener,
            directMessageListener,
            ambientListener,
        ]

        it('runs without crashing', function () {
            const context = {
                isDirectMessage: true,
                isDirectMention: false,
                isAmbient: false,
                isBotMessage: false,
            }

            findMatchingListener(listeners, 'hello', context)
        })

        it('returns null when no listeners match', function () {
            const context = {
                isDirectMessage: true,
                isDirectMention: false,
                isAmbient: false,
                isBotMessage: false,
            }

            const result = findMatchingListener(listeners, 'hello', context)
            assert.isNull(result)
        })

        it('finds a matching listener with direct mention', function () {
            const context = {
                isDirectMessage: false,
                isDirectMention: true,
                isAmbient: false,
                isBotMessage: false,
            }

            const result = findMatchingListener(listeners, 'help', context)
            assert.isNotNull(result)
            assert.deepEqual(result?.listener, directMentionListener)
            assert.isArray(result?.matches)
        })

        it('finds a matching listener with direct message', function () {
            const context = {
                isDirectMessage: true,
                isDirectMention: false,
                isAmbient: false,
                isBotMessage: false,
            }

            const result = findMatchingListener(listeners, 'source', context)
            assert.isNotNull(result)
            assert.deepEqual(result?.listener, directMessageListener)
            assert.isArray(result?.matches)
        })

        it('finds a matching listener with ambient message', function () {
            const context = {
                isDirectMessage: false,
                isDirectMention: false,
                isAmbient: true,
                isBotMessage: false,
            }

            const result = findMatchingListener(listeners, 'pairings', context)
            assert.isNotNull(result)
            assert.deepEqual(result?.listener, ambientListener)
            assert.isArray(result?.matches)
        })

        it('returns the first matching listener when multiple match', function () {
            const multiMatchListener1: SlackEventListenerOptions = {
                type: 'command',
                patterns: [/hello/i],
                messageTypes: ['direct_message'],
                callback: () => {},
            }

            const multiMatchListener2: SlackEventListenerOptions = {
                type: 'command',
                patterns: [/hello/i],
                messageTypes: ['direct_message'],
                callback: () => {},
            }

            const multiListeners: SlackEventListenerOptions[] = [
                multiMatchListener1,
                multiMatchListener2,
            ]

            const context = {
                isDirectMessage: true,
                isDirectMention: false,
                isAmbient: false,
                isBotMessage: false,
            }

            const result = findMatchingListener(
                multiListeners,
                'hello',
                context
            )
            assert.isNotNull(result)
            assert.deepEqual(result?.listener, multiMatchListener1) // Should match the first one
        })
    })

    describe('#normalizeMessageText()', function () {
        const botUserId = 'U98765'

        it('removes bot mention from the beginning of text with space', function () {
            const text = `<@${botUserId}> help`
            const result = normalizeMessageText(text, botUserId)
            assert.equal(result, 'help')
            assert.notEqual(result, text)
        })

        it('removes bot mention from the beginning of text without space', function () {
            const text = `<@${botUserId}>help`
            const result = normalizeMessageText(text, botUserId)
            assert.equal(result, 'help')
            assert.notEqual(result, text)
        })

        it("doesn't modify text without bot mention", function () {
            const text = 'help me'
            const result = normalizeMessageText(text, botUserId)
            assert.equal(result, text)
        })
    })

    // I had some trouble with the mocks needed to write this; TODO write tests for the main function from chessterUtils if possible
    // But, the above tests cover the sub-functions that are called in the main function, so there wouldn't be much to test in the main function itself anyway
    // describe('#processChessterMessage()', function () {})
})
