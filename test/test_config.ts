import { assert } from 'chai'
import { production } from '../src/config/production'
import { development } from '../src/config/development'
import {
    ChessterConfig,
    withHeltourToken,
    databaseSslOptions,
    databaseSslMode,
    databaseSslRootCertPath,
    redactDatabaseUrl,
    resolveDatabaseSslMode,
    stripDatabaseSslParams,
} from '../src/config'

function assertLeaguesAreComplete(config: ChessterConfig) {
    Object.values(config.leagues).forEach((league) => {
        assert.isString(league.name)
        assert.isArray(league.alsoKnownAs)
        assert.isString(league.heltour.baseEndpoint)
        assert.isString(league.heltour.leagueTag)
        assert.isString(league.results.channel)
        assert.isString(league.results.channelId)
        assert.isString(league.gamelinks.channel)
        assert.isString(league.gamelinks.channelId)
        assert.isNumber(league.scheduling.extrema.isoWeekday)
        assert.isString(league.links.league)
    })
}

describe('config', function () {
    it('loads the production config with complete leagues', () => {
        assertLeaguesAreComplete(production)
    })

    it('loads the development config with complete leagues', () => {
        assertLeaguesAreComplete(development)
    })

    it('attaches the heltour token to the config and every league', () => {
        const withToken = withHeltourToken(production, 'test-heltour-token')
        assert.equal(withToken.heltour.token, 'test-heltour-token')
        Object.values(withToken.leagues).forEach((league) => {
            assert.equal(league.heltour.token, 'test-heltour-token')
        })
    })

    describe('database ssl mode', () => {
        it('prefers ssl when no sslmode is given', () => {
            assert.equal(resolveDatabaseSslMode(null), 'prefer')
        })

        it('disables ssl for sslmode=disable', () => {
            assert.equal(resolveDatabaseSslMode('disable'), 'disable')
        })

        it('requires ssl without verification for sslmode=require', () => {
            assert.equal(resolveDatabaseSslMode('require'), 'require')
        })

        it('requires ssl without verification for sslmode=no-verify', () => {
            assert.equal(resolveDatabaseSslMode('no-verify'), 'require')
        })

        it('requires verified ssl for sslmode=verify-ca', () => {
            assert.equal(resolveDatabaseSslMode('verify-ca'), 'verify')
        })

        it('requires verified ssl for sslmode=verify-full', () => {
            assert.equal(resolveDatabaseSslMode('verify-full'), 'verify')
        })

        it('reads the sslmode from the database url', () => {
            assert.equal(
                databaseSslMode(
                    'postgres://chesster@localhost:5432/chesster?sslmode=require'
                ),
                'require'
            )
        })

        it('reads the sslrootcert from the database url', () => {
            assert.equal(
                databaseSslRootCertPath(
                    'postgres://chesster@localhost:5432/chesster?sslmode=verify-full&sslrootcert=/path/to/ca.pem'
                ),
                '/path/to/ca.pem'
            )
        })

        it('maps disable to no ssl options', () => {
            assert.isUndefined(databaseSslOptions('disable'))
        })

        it('maps require to ssl without verification', () => {
            assert.deepEqual(databaseSslOptions('require'), {
                rejectUnauthorized: false,
            })
        })

        it('maps prefer to ssl without verification', () => {
            assert.deepEqual(databaseSslOptions('prefer'), {
                rejectUnauthorized: false,
            })
        })

        it('maps verify to ssl with verification and a ca', () => {
            assert.deepEqual(databaseSslOptions('verify', '/path/to/ca.pem'), {
                rejectUnauthorized: true,
                ca: '/path/to/ca.pem',
            })
        })

        it('strips sslmode and sslrootcert from the database url', () => {
            assert.equal(
                stripDatabaseSslParams(
                    'postgres://chesster:asdfasdf@localhost:5432/chesster?sslmode=verify-full&sslrootcert=/path/to/ca.pem'
                ),
                'postgres://chesster:asdfasdf@localhost:5432/chesster'
            )
        })

        it('leaves other query params in place when stripping ssl params', () => {
            assert.equal(
                stripDatabaseSslParams(
                    'postgres://chesster@localhost:5432/chesster?sslmode=disable&foo=bar'
                ),
                'postgres://chesster@localhost:5432/chesster?foo=bar'
            )
        })
    })

    describe('database url redaction', () => {
        it('removes the password but keeps user, host, port, db and query', () => {
            assert.equal(
                redactDatabaseUrl(
                    'postgres://chesster:asdfasdf@localhost:5432/chesster?sslmode=require'
                ),
                'postgres://chesster@localhost:5432/chesster?sslmode=require'
            )
        })

        it('leaves a url without a password unchanged', () => {
            assert.equal(
                redactDatabaseUrl('postgres://chesster@localhost:5432/chesster'),
                'postgres://chesster@localhost:5432/chesster'
            )
        })
    })
})
