import { readFileSync } from 'fs'
import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

export const DEFAULT_DATABASE_URL =
    'postgres://chesster:scrappypulpitgourdehinders@localhost:5432/chesster?sslmode=disable'

function isPostgresUrl(value: string): boolean {
    try {
        const url = new URL(value)
        return url.protocol === 'postgres:' || url.protocol === 'postgresql:'
    } catch {
        return false
    }
}

export const EnvSchema = z.object({
    DATABASE_URL: z
        .string()
        .default(DEFAULT_DATABASE_URL)
        .refine(isPostgresUrl, {
            message: 'must be a valid postgres:// or postgresql:// URL',
        }),
    LICHESS_4545_APP_TOKEN: z.string(),
    LICHESS_4545_SIGNING_SECRET: z.string(),
    LICHESS_4545_BOT_TOKEN: z.string(),
    FORWARD_APP_TOKEN: z.string(),
    FORWARD_SIGNING_SECRET: z.string(),
    FORWARD_BOT_TOKEN: z.string(),
    CHESSTER_HELTOUR_TOKEN: z.string(),
    CHESSTER_LICHESS_TOKEN: z.string(),
    CHESSTER_CONFIG: z.enum(['production', 'development']).default('production'),
})

export type Env = z.infer<typeof EnvSchema>

function resolveFileBackedEnv(
    source: Record<string, string | undefined>
): Record<string, string | undefined> {
    const resolved = { ...source }
    for (const key of Object.keys(EnvSchema.shape)) {
        const fileKey = `${key}_FILE`
        const filePath = source[fileKey]
        if (filePath === undefined) {
            continue
        }
        if (source[key] !== undefined) {
            throw new Error(
                `Invalid environment configuration: ${key} and ${fileKey} cannot both be set`
            )
        }
        resolved[key] = readFileSync(filePath, 'utf8').replace(/\r?\n$/, '')
    }
    return resolved
}

export function parseEnv(source: Record<string, string | undefined>): Env {
    const resolved = resolveFileBackedEnv(source)
    const result = EnvSchema.safeParse(resolved)
    if (!result.success) {
        const issues = result.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; ')
        throw new Error(`Invalid environment configuration: ${issues}`)
    }
    return result.data
}

export function loadEnv(): Env {
    return parseEnv(process.env)
}
