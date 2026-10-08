import { readFileSync } from 'fs'
import { join } from 'path'
import { SlackBot, CommandMessage } from '../slack'

export function formatVersionReply(
    runningVersion: string,
    sourceUrl: string
): string {
    return `Chesster v${runningVersion} — <${sourceUrl}/releases/tag/v${runningVersion}|release notes>`
}

export function readPackageVersion(): string {
    const pkgPath = join(__dirname, '..', '..', 'package.json')
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
    return pkg.version
}

export const version = readPackageVersion()

export function versionCommand(bot: SlackBot, message: CommandMessage) {
    bot.reply(message, formatVersionReply(version, bot.config.links.source))
}
