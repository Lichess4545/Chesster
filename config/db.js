var config = {
    development: {
        name: 'chesster',
        username: 'chesster',
        password: 'scrappypulpitgourdehinders',
        database: 'chesster',
        host: 'localhost',
        port: 5432,
        dialect: 'postgres',
        logging: false,
        pool: {
            max: 5,
            min: 0,
            idle: 10000,
        },
    },
}

// Add this line to export the config
module.exports = config
