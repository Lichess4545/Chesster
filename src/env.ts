import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

export const DEFAULT_DATABASE_URL =
    'postgres://chesster:scrappypulpitgourdehinders@localhost:5432/chesster'

export const EnvSchema = z.object({
    DATABASE_URL: z.string().default(DEFAULT_DATABASE_URL),
    LICHESS_4545_APP_TOKEN: z.string(),
    LICHESS_4545_SIGNING_SECRET: z.string(),
    LICHESS_4545_BOT_TOKEN: z.string(),
    FORWARD_APP_TOKEN: z.string(),
    FORWARD_SIGNING_SECRET: z.string(),
    FORWARD_BOT_TOKEN: z.string(),
    CHESSTER_HELTOUR_TOKEN: z.string(),
    CHESSTER_LICHESS_TOKEN: z.string(),
})

export type Env = z.infer<typeof EnvSchema>

export function parseEnv(source: Record<string, string | undefined>): Env {
    const result = EnvSchema.safeParse(source)
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
