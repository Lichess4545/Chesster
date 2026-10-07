const DEFAULT_DATABASE_URL =
    'postgres://chesster:scrappypulpitgourdehinders@localhost:5432/chesster'

var config = {
    development: {
        url: process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
        dialect: 'postgres',
    },
}

module.exports = config
module.exports.DEFAULT_DATABASE_URL = DEFAULT_DATABASE_URL
