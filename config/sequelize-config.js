// -----------------------------------------------------------------------------
// Sequelize expects migration files to be structured this way; the current testconfig.js file is structured differently. Hence this file which uses the correct structure.
// It would be nice to just change the actual config file to be the right format, but that's out of scope for the PR I'm working on (migrating chesster to new Slack API), so I'm just adding this file to make the migration work.
// -----------------------------------------------------------------------------

const config = require('./testconfig.js')

module.exports = {
    development: {
        username: config.database.username,
        password: config.database.password,
        database: config.database.name,
        host: config.database.host,
        dialect: config.database.dialect,
        logging: config.database.logging,
    },
}
