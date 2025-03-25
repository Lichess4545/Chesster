var config = {
    development: {
        name: 'chesster',
        username: 'chesster',
        databaseName: 'chesster',
        password: 'scrappypulpitgourdehinders',
        host: 'localhost',
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
