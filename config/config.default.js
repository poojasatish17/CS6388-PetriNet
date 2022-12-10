'use strict';

var config = require('./config.webgme'),
    validateConfig = require('webgme/config/validator');

// Add/overwrite any additional settings here
const mongoHost = process.env.MONGO_HOST || '127.0.0.1';
config.mongo.uri = `mongodb://${mongoHost}:27017/webgme_dcrypps`;

//allowing python plugin execution
config.plugin.allowServerExecution = true;

//js paths for jointjs and lodash packages
config.requirejsPaths['jointjs'] = './node_modules/jointjs/dist/joint.min';
config.requirejsPaths['lodash'] = './node_modules/lodash/lodash.min';
config.requirejsPaths['jointjscss'] = './node_modules/jointjs/dist/joint';

validateConfig(config);
module.exports = config;