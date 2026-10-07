import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { assert } from 'chai'
import { parseEnv, DEFAULT_DATABASE_URL } from '../src/env'

describe('env', function () {
    const validEnv = {
        LICHESS_4545_APP_TOKEN: 'xapp-1',
        LICHESS_4545_SIGNING_SECRET: 'secret-1',
        LICHESS_4545_BOT_TOKEN: 'xoxb-1',
        FORWARD_APP_TOKEN: 'xapp-2',
        FORWARD_SIGNING_SECRET: 'secret-2',
        FORWARD_BOT_TOKEN: 'xoxb-2',
        CHESSTER_HELTOUR_TOKEN: 'heltour-token',
        CHESSTER_LICHESS_TOKEN: 'lichess-token',
    }

    describe('parseEnv', () => {
        it('parses a fully specified environment', () => {
            const env = parseEnv({
                ...validEnv,
                DATABASE_URL: 'postgres://user:pass@host:5432/db',
            })
            assert.equal(env.DATABASE_URL, 'postgres://user:pass@host:5432/db')
            assert.equal(env.CHESSTER_HELTOUR_TOKEN, 'heltour-token')
            assert.equal(env.CHESSTER_LICHESS_TOKEN, 'lichess-token')
        })

        it('defaults DATABASE_URL to the local devenv url', () => {
            const env = parseEnv(validEnv)
            assert.equal(env.DATABASE_URL, DEFAULT_DATABASE_URL)
        })

        it('throws a clear error listing a missing required token', () => {
            const { CHESSTER_HELTOUR_TOKEN, ...incompleteEnv } = validEnv
            assert.throws(
                () => parseEnv(incompleteEnv),
                /CHESSTER_HELTOUR_TOKEN/
            )
        })

        it('rejects a DATABASE_URL that is not a postgres URL', () => {
            assert.throws(
                () => parseEnv({ ...validEnv, DATABASE_URL: '1' }),
                /DATABASE_URL/
            )
        })

        it('reads a value from a file referenced by <NAME>_FILE', () => {
            const dir = mkdtempSync(join(tmpdir(), 'chesster-env-'))
            const filePath = join(dir, 'heltour-token')
            writeFileSync(filePath, 'file-heltour-token\n')
            const { CHESSTER_HELTOUR_TOKEN, ...envWithoutToken } = validEnv
            const env = parseEnv({
                ...envWithoutToken,
                CHESSTER_HELTOUR_TOKEN_FILE: filePath,
            })
            assert.equal(env.CHESSTER_HELTOUR_TOKEN, 'file-heltour-token')
        })

        it('throws when both <NAME> and <NAME>_FILE are set', () => {
            const dir = mkdtempSync(join(tmpdir(), 'chesster-env-'))
            const filePath = join(dir, 'heltour-token')
            writeFileSync(filePath, 'file-heltour-token\n')
            assert.throws(
                () =>
                    parseEnv({
                        ...validEnv,
                        CHESSTER_HELTOUR_TOKEN_FILE: filePath,
                    }),
                /CHESSTER_HELTOUR_TOKEN.*CHESSTER_HELTOUR_TOKEN_FILE/
            )
        })
    })
})
