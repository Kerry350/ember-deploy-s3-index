'use strict';

var Adapter = require('ember-deploy/utilities/adapter');
var Promise = require('ember-cli/lib/ext/promise');
var SilentError = require('ember-cli/lib/errors/silent');
var AWS = require('aws-sdk');
var chalk = require('chalk');

var green = chalk.green;
var white = chalk.white;

module.exports = Adapter.extend({
  init: function() {
    if (!this.config) {
      return Promise.reject(new SilentError('You must supply a config'));
    }

    if (!this.config.accessKeyId || !this.config.secretAccessKey) {
      return Promise.reject(new SilentError('You must supply your AWS Access Key Id and Secret Access Key'));      
    }
    
    this.client = new AWS.S3(this.config);

    this.taggingAdapter = this._createTaggingAdapter(); 
  },

  upload: function(indexHTML) {
    var key = this.taggingAdapter.createTag();
    return this._upload(indexHTML, key);
  },

  activate: function() {

  },

  // <manifest>:<revision>.html
  list: function() {
    return this._getBucketContents()
    .then(this._getBucketRevisions.bind(this))
    .then(this._printBucketRevisions.bind(this))
    .catch(function(err) {
      var message = this._getFormattedErrorMessage('There was an error calling list()', err);
      return this._printErrorMessage(message);
    }.bind(this))
  },

  _getBucketRevisions: function(bucketContents) {
    // Assumes bucket only contains index revisions, and therefore all files are '.html'
    var revisions = bucketContents.Contents.map(function(item) {
      return item.Key.substring(0, (item.Key.length - 5)); 
    });

    return revisions;
  },

  _printBucketRevisions: function(revisions) {
    var message = green('Found the following revisions: \n\n') + revisions + green('\n\nUse activate() to activate one of these revisions');
    return this._printSuccessMessage(message);
  },

  _getBucketContents: function() {
    return new Promise(function(resolve, reject) {   
      this.client.listObjects({Bucket: this.config.bucket}, function(err, data) {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      }.bind(this));
    }.bind(this));
  },

  /* Private methods */

  _createTaggingAdapter: function() {
    var TaggingAdapter = require('ember-deploy/utilities/tagging/sha');
    return new TaggingAdapter({
      manifest: this.manifest
    });
  },

  /**
   * Uploads our index.html contents to S3
   * @param {buffer} value - index.html contents
   * @param {string} key - key provided by the tagging adapter
   * @returns {RSVP.Promise}
   */
  _upload: function(value, key) {
    return this._uploadIfNotAlreadyInManifest(value, key)
          .then(this._deploySuccessMessage.bind(this, key))
          .then(this._printSuccessMessage.bind(this))
          .catch(function() {
            var message = this._deployErrorMessage();
            return this._printErrorMessage(message);
          }.bind(this));
  },

  /**
   * Uploads our index.html contents to S3 if the revision doesn't exist
   * @param {string} indexHTML - index.html contents
   * @returns {RSVP.Promise}
   */
  _uploadIfNotAlreadyInManifest: function(value, key) {
    return new Promise(function(resolve, reject) {      
      var params = this._getUploadParams(value);
      
      this.client.putObject(params, function(err, data) {
        if (err) {
          this._logUploadError(reject, err);
        } else {
          this._logUploadSuccess(resolve);
        }
      }.bind(this));
    }.bind(this));
  },

  _getUploadParams: function(value) {    
    var params = {
      Bucket: this.config.bucket,
      Key: 'index.html',
      Body: value
    };

    return params;

    // CacheControl: 'max-age='+TWO_YEAR_CACHE_PERIOD_IN_SEC+', public', // TODO: Add caching with revisions
    // Expires: EXPIRE_IN_2030 // TODO: Add caching with revisions
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
  },

  _logUploadError: function(reject, error) {
    var errorMessage = 'Unable to sync: ' + error.stack;
    reject(new SilentError(errorMessage));
  },

  _logUploadSuccess: function(resolve) {
    this.ui.writeLine('Index file was successfully uploaded');
    resolve();
  },

  _getFormattedErrorMessage: function(message, error) {
    var message = message + '\n\n';
    var error = (error) ? (error.stack + '\n') : '';
    return message + error;
  }
});