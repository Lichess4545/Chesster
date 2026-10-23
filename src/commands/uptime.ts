import humanizeDuration from 'humanize-duration'
import { SlackBot, CommandMessage } from '../slack'

export function formatDuration(totalSeconds: number): string {
    return humanizeDuration(totalSeconds * 1000, {
        units: ['d', 'h', 'm', 's'],
        round: true,
        conjunction: ' and ',
        serialComma: false,
    })
}

export function formatUptimeReply(uptimeSeconds: number): string {
    return `I have been up for ${formatDuration(uptimeSeconds)}.`
}

export function uptimeCommand(bot: SlackBot, message: CommandMessage) {
    bot.reply(message, formatUptimeReply(process.uptime()))
}
