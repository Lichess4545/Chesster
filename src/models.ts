'use strict'

// -----------------------------------------------------------------------------
// Models for our locally stored data
// -----------------------------------------------------------------------------
import winston from 'winston'
import { Sequelize, Model, DataTypes } from 'sequelize'
import { databaseDialectOptions, redactDatabaseUrl, stripDatabaseSslParams } from './config'
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

function buildSequelize(databaseUrl: string): Sequelize {
    const url = stripDatabaseSslParams(databaseUrl)
    const dialectOptions = databaseDialectOptions(databaseUrl)
    return new Sequelize(url, {
        dialect: 'postgres',
        logging: false,
        ...(dialectOptions ? { dialectOptions } : {}),
    })
}

export async function connect(databaseUrl: string) {
    const sequelize = buildSequelize(databaseUrl)

    try {
        winston.info(
            `[models.connect()] Attempting to connect to database at ${redactDatabaseUrl(
                databaseUrl
            )}`
        )
        await sequelize.authenticate()
        winston.info('[models.connect()] Database connection successful')
        defineModels(sequelize)
    } catch (e) {
        winston.error(`[models.connect()] Error connecting to db: ${formatError(e)}`)
        throw e
    }
}
