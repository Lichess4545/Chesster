'use strict';

// Here's a JavaScript-based config file.
// If you need conditional logic, you might want to use this type of config.
// Otherwise, JSON or YAML is recommended.

module.exports = {
  bail: true,
  'full-trace': true,
  diff: true,
  extension: ['ts'],
  package: './package.json',
  reporter: 'spec',
  slow: 75,
  timeout: 5000,
  ui: 'bdd',
  'watch-files': ['test/**/*.ts'],
  'watch-ignore': ['lib/vendor'],
  'require': ['ts-node/register', 'source-map-support/register']
};
