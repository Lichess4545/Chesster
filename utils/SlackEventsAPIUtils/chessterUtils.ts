// -----------------------------------------------------------------------------
// Utility functions for processing messages in Chesster
// These functions handle the common logic between regular messages (ones that don't tag chesster directly) and mentions(contain `@chesster`)

// The main export is `processChessterMessage`, which is called from both the app.message and app.event('app_mention') handlers. It sanitizes the message text, determines the message context, finds the first matching listener, and executes any appropriate chesster response.

// See test_chessterutils for testing
// -----------------------------------------------------------------------------
import { App, StringIndexed, SayFn } from '@slack/bolt'
import {
    SlackChannel,
    SlackEventListenerOptions,
    ChessterMessage,
    CommandMessage,
} from '../../app'
/**
 * Main function to process incoming messages for Chesster
 * This handles the shared logic between regular messages and @mentions
 * Can be called from both app.message and app.event('app_mention') handlers
 *
 * This sanitizes the message text, determines the message context, finds the first matching listener, and executes any appropriate chesster response
 *
 * @param {string} text - The message text
 * @param {string} user - User ID who sent the message
 * @param {SlackChannel} channel - Channel the message was sent in
 * @param {string} ts - Message timestamp
 * @param {App<StringIndexed>} app - The Slack app instance
 * @param {SayFn} say - Function to send Chesster messages
 * @param {string} botUserId - Chesster's user ID
 * @param {boolean} isDirectMention - Whether this is a direct @mention
 * @param {SlackEventListenerOptions[]} listeners - Registered chesster command listeners
 */
export async function processChessterMessage({
    text,
    user,
    channel,
    ts,
    app,
    say,
    botUserId,
    isDirectMention = false,
    listeners,
}: {
    text: string
    user: string
    channel: SlackChannel
    ts: string
    app: App<StringIndexed>
    say: SayFn
    botUserId?: string
    isDirectMention?: boolean
    listeners: SlackEventListenerOptions[]
}): Promise<void> {
    try {
        // If this is a direct mention and we have a botUserId, strip the mention from the text
        // So `@chesster source` here is turned in to just `source`
        let normalizedText =
            isDirectMention && botUserId
                ? normalizeMessageText(text, botUserId)
                : text

        // Create the base message object that our commands will receive
        const chessterMessage: ChessterMessage = {
            type: 'message',
            user,
            channel,
            text: normalizedText.trim(),
            ts,
            isPingModerator: false,
        }

        // Determine message context (DM, mention, ambient)
        const messageContext = determineMessageContext(channel, isDirectMention)

        app.logger.info(
            `Processing ${messageContext.type} message: "${normalizedText}"`
        )

        // Find and execute the first matching listener
        const matchedListener = findMatchingListener(
            listeners,
            normalizedText,
            messageContext
        )

        if (matchedListener) {
            const { listener, matches } = matchedListener

            // Create the specific command message with the regex matches
            const commandMessage: CommandMessage = {
                ...chessterMessage,
                matches,
            }

            // Apply any middleware to transform the message if needed
            const processedMessage = applyMiddleware(
                commandMessage,
                listener.middleware
            )

            // Execute the command's callback, which sends the response or whatever other action
            await listener.callback(processedMessage, say)
        }
    } catch (error) {
        app.logger.error(`Error processing message: ${error}`)
        await say(
            "Error processing message. Its probably MrScribbles' fault. :sexy-glbert:"
        )
    }
}

/**
 * Remove bot mention from text
 * Converts "@chesster help" to just "help"
 */
export function normalizeMessageText(text: string, botUserId: string): string {
    return text.replace(`<@${botUserId}> `, '').replace(`<@${botUserId}>`, '')
}

/**
 * Determine the context of a message (DM, mention, ambient, etc.)
 */
export function determineMessageContext(
    channel: SlackChannel,
    isDirectMention: boolean
) {
    const isDirectMessage =
        (channel?.is_im ?? false) && !(channel?.is_group ?? false)
    const isAmbient = !(isDirectMention || isDirectMessage)

    return {
        type: isDirectMention ? 'mention' : isDirectMessage ? 'DM' : 'ambient',
        isDirectMessage,
        isDirectMention,
        isAmbient,
        isBotMessage: false, // We don't handle bot messages in the Events API currently
    }
}

/**
 * Find the first listener that matches the message
 * Returns the listener and the regex matches if found
 */
export function findMatchingListener(
    listeners: SlackEventListenerOptions[],
    text: string,
    context: {
        isDirectMessage: boolean
        isDirectMention: boolean
        isAmbient: boolean
        isBotMessage: boolean
    }
) {
    for (const listener of listeners) {
        // Skip if this listener doesn't want this type of message
        if (!doesListenerWantMessageType(listener, context)) {
            continue
        }

        // Check if any patterns match the text
        for (const pattern of listener.patterns) {
            const matches = text.match(pattern)
            if (matches) {
                return { listener, matches }
            }
        }
    }
    return null
}

/**
 * Check if a listener wants to handle a specific message type
 */
export function doesListenerWantMessageType(
    listener: SlackEventListenerOptions,
    context: {
        isDirectMessage: boolean
        isDirectMention: boolean
        isAmbient: boolean
        isBotMessage: boolean
    }
): boolean {
    const { isDirectMessage, isDirectMention, isAmbient, isBotMessage } =
        context

    if (isDirectMessage && listener.messageTypes.includes('direct_message')) {
        return true
    }
    if (isDirectMention && listener.messageTypes.includes('direct_mention')) {
        return true
    }
    if (isAmbient && listener.messageTypes.includes('ambient')) {
        return true
    }
    if (isBotMessage && listener.messageTypes.includes('bot_message')) {
        return true
    }
    return false
}

/**
 * Apply middleware functions to transform a message
 * Each middleware function can modify the message before it reaches the handler
 */
export function applyMiddleware(
    message: CommandMessage,
    middleware?: ((message: CommandMessage) => CommandMessage)[]
): CommandMessage {
    if (!middleware || middleware.length === 0) {
        return message
    }

    let processedMessage = message
    for (const middlewareFn of middleware) {
        processedMessage = middlewareFn(processedMessage)
    }
    return processedMessage
}
