const fs = require('fs')
const { databaseDialectOptions, stripDatabaseSslParams } = require('../build/config')

const DEFAULT_DATABASE_URL =
    'postgres://chesster:scrappypulpitgourdehinders@localhost:5432/chesster?sslmode=disable'

function resolveDatabaseUrl() {
    const filePath = process.env.DATABASE_URL_FILE
    if (filePath !== undefined) {
        if (process.env.DATABASE_URL !== undefined) {
            throw new Error(
                'Invalid environment configuration: DATABASE_URL and DATABASE_URL_FILE cannot both be set'
            )
        }
        return fs.readFileSync(filePath, 'utf8').replace(/\r?\n$/, '')
    }
    return process.env.DATABASE_URL || DEFAULT_DATABASE_URL
}

const databaseUrl = resolveDatabaseUrl()
const dialectOptions = databaseDialectOptions(databaseUrl)

var config = {
    chesster: {
        url: stripDatabaseSslParams(databaseUrl),
        dialect: 'postgres',
        ...(dialectOptions ? { dialectOptions } : {}),
    },
}

module.exports = config
module.exports.DEFAULT_DATABASE_URL = DEFAULT_DATABASE_URL
