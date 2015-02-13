'use strict';

var Adapter = require('ember-deploy/utilities/adapter');
var Promise     = require('ember-cli/lib/ext/promise');
var S3 = require('s3');
var chalk = require('chalk');

var green = chalk.green;
var white = chalk.white;

module.exports = Adapter.extend({
  init: function() {
    if (!this.config) {
      return Promise.reject(new SilentError('You must supply a config'));
    }

    if (!this.config.store.accessKeyId || !this.config.store.secretAccessKey) {
      return Promise.reject(new SilentError('You must supply your AWS Access Key Id and Secret Access Key'));      
    }

    this.client = S3.createClient({
      s3Options: this.config.store
    });
  },

  upload: function(indexHTML) {
    var key = this.taggingAdapter.createTag();
    return this._upload(indexHTML, key);
  },

  // TODO: Revisions
  activate: function() {

  },

  // TODO: Revisions
  list: function() {

  },

  /* Private methods */

  /**
   * Uploads our index.html contents to S3
   * @param {string} indexHTML - index.html contents
   * @returns {RSVP.Promise}
   */
  _upload: function(value, key) {
    return this._uploadIfNotAlreadyInManifest(value, key)
          .then(this._deploySuccessMessage.bind(this, key))
          .then(this._printSuccessMessage.bind(this))
          .then(function() { return message; })
          .catch(function() {
            var message = this._deployErrorMessage();
            return this._printErrorMessage(message);
          }.bind(this));
  },

  /**
   * Uploads our index.html contents to S3 if the revision doesn't exist
   * NOTE: This is currently a LIE as revision abilities aren't implemented,
   * the index.html file will be uploaded as-is with no caching (for now) 
   * @param {string} indexHTML - index.html contents
   * @returns {RSVP.Promise}
   */
  _uploadIfNotAlreadyInManifest: function(value, key) {
    return new Promise(function(resolve, reject) {

    });
  },

  _deploySuccessMessage: function(key) {
    var success = green('\nUpload successful!\n\n');
    // var uploadMessage = white('Uploaded revision: ') + green(revisionKey); // TODO: Amend with revisions
    return success;
  },

  _printSuccessMessage: function(message) {
    return this.ui.writeLine(message);
  },

  _deployErrorMessage: function() {
    var failure    = '\nUpload failed!\n';
    // var suggestion = 'Did you try to upload an already uploaded revision?\n\n'; // TODO: Amend with revisions
    // var solution   = 'Please run `' + green('ember deploy:list') + '` to ' + 'investigate.'; // TODO: Amend with revisions
    return failure;
  },

  _printErrorMessage: function(message) {
    return Promise.reject(new SilentError(message));
  }
});