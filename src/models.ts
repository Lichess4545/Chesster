'use strict'

// -----------------------------------------------------------------------------
// Models for our locally stored data
// -----------------------------------------------------------------------------
import fs from 'fs'
import winston from 'winston'
import { Sequelize, Model, DataTypes } from 'sequelize'
import {
    DatabaseSsl,
    databaseSslMode,
    databaseSslOptions,
    databaseSslRootCertPath,
    redactDatabaseUrl,
    stripDatabaseSslParams,
} from './config'
import { formatError } from './utils'

export class LichessRating extends Model {
    public id!: number
    public lichessUserName!: string
    public rating!: number
    public lastCheckedAt!: Date
}

export class Subscription extends Model {
    public id!: number
    public requester!: string
    public source!: string
    public event!: string
    public target!: string
    public league!: string
}

// -------------------------------------------------------------------------
function defineModels(sequelize: Sequelize) {
    LichessRating.init(
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            lichessUserName: DataTypes.STRING, // Comes from lichess
            rating: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            lastCheckedAt: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        {
            sequelize,
            tableName: 'LichessRatings',
        }
    )
    Subscription.init(
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            requester: {
                type: DataTypes.STRING,
                unique: 'eventUnique',
            },
            source: {
                type: DataTypes.STRING,
                unique: 'eventUnique',
            },
            event: {
                type: DataTypes.STRING,
                unique: 'eventUnique',
            },
            target: {
                type: DataTypes.STRING,
                unique: 'eventUnique',
            },
            league: {
                type: DataTypes.STRING,
                unique: 'eventUnique',
            },
        },
        {
            sequelize,
            tableName: 'Subscriptions',
        }
    )
}

function buildSequelize(url: string, ssl: DatabaseSsl | undefined): Sequelize {
    const dialectOptions = ssl
        ? {
              ssl: {
                  rejectUnauthorized: ssl.rejectUnauthorized,
                  ...(ssl.ca ? { ca: fs.readFileSync(ssl.ca, 'utf8') } : {}),
              },
          }
        : undefined
    return new Sequelize(url, {
        dialect: 'postgres',
        logging: false,
        ...(dialectOptions ? { dialectOptions } : {}),
    })
}

function isSslUnsupportedError(e: unknown): boolean {
    return (
        e instanceof Error &&
        e.message.includes('The server does not support SSL connections')
    )
}

export async function connect(databaseUrl: string) {
    const url = stripDatabaseSslParams(databaseUrl)
    const mode = databaseSslMode(databaseUrl)
    const ca = databaseSslRootCertPath(databaseUrl)
    const effectiveSsl = databaseSslOptions(mode, ca)
    const preferSsl = mode === 'prefer'

    let sequelize = buildSequelize(url, effectiveSsl)

    try {
        winston.info(
            `[models.connect()] Attempting to connect to database at ${redactDatabaseUrl(
                databaseUrl
            )}`
        )
        try {
            await sequelize.authenticate()
        } catch (e) {
            if (preferSsl && isSslUnsupportedError(e)) {
                winston.info(
                    '[models.connect()] Database does not support SSL, retrying without it'
                )
                await sequelize.close()
                sequelize = buildSequelize(url, undefined)
                await sequelize.authenticate()
            } else {
                throw e
            }
        }
        winston.info('[models.connect()] Database connection successful')
        defineModels(sequelize)
    } catch (e) {
        winston.error(`[models.connect()] Error connecting to db: ${formatError(e)}`)
        throw e
    }
}
