'use strict'

// -----------------------------------------------------------------------------
// Models for our locally stored data
// -----------------------------------------------------------------------------
import fs from 'fs'
import winston from 'winston'
import { Sequelize, Model, DataTypes } from 'sequelize'
import { ChessterConfig, databaseUrl } from './config'
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

// -------------------------------------------------------------------------
// Connection function that ensures we have a connection and the models
// are defined.
//
// Parameters: config - the config option that contains the database
//                      information.
// -------------------------------------------------------------------------
type EffectiveSsl = { rejectUnauthorized: boolean; ca?: string } | undefined

function buildSequelize(config: ChessterConfig, ssl: EffectiveSsl): Sequelize {
    const { ssl: _unusedSsl, ...databaseOptions } = config.database
    const dialectOptions = ssl
        ? {
              ssl: {
                  rejectUnauthorized: ssl.rejectUnauthorized,
                  ...(ssl.ca ? { ca: fs.readFileSync(ssl.ca, 'utf8') } : {}),
              },
          }
        : undefined
    return new Sequelize(
        config.database.name,
        config.database.username,
        config.database.password,
        {
            ...databaseOptions,
            dialect: 'postgres',
            ...(dialectOptions ? { dialectOptions } : {}),
        }
    )
}

function isSslUnsupportedError(e: unknown): boolean {
    return (
        e instanceof Error &&
        e.message.includes('The server does not support SSL connections')
    )
}

export async function connect(config: ChessterConfig) {
    if (config.database.dialect !== 'postgres') {
        throw new Error(
            "We don't support anything but postgresql because I'm lazy"
        )
    }

    const { ssl } = config.database
    let effectiveSsl: EffectiveSsl
    if (ssl === false) {
        effectiveSsl = undefined
    } else if (ssl === undefined) {
        effectiveSsl = { rejectUnauthorized: false }
    } else {
        effectiveSsl = ssl
    }
    const preferSsl = ssl === undefined

    let sequelize = buildSequelize(config, effectiveSsl)

    try {
        winston.info(
            `[models.connect()] Attempting to connect to database at ${databaseUrl(
                config.database
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
                sequelize = buildSequelize(config, undefined)
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
