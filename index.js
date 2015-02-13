'use strict';
console.log("Module loaded")
var S3Adapter = require('./lib/s3-adapter');

module.exports = {
  name: 'ember-deploy-s3-index',
  type: 'ember-deploy-addon',

  adapters: {
    index: {
      'S3': S3Adapter
    }
  }
};
