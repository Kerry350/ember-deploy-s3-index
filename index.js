var S3Adapter = require('./lib/s3-adapter');

function EmberDeployS3Index() {
  this.name = 'ember-deploy-s3-index';
  this.type = 'ember-deploy-addon';

  this.adapters = {
    index: {
      'S3': S3Adapter
    }
  };
}

module.exports = EmberDeployS3Index;