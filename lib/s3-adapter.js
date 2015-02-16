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

  /* Public methods */

  upload: function(indexHTML) {
    var key = this.taggingAdapter.createTag();
    return this._upload(indexHTML, key);
  },

  activate: function(revision) {
    return new Promise(function(resolve, reject) {
      this._getBucketContents()
      .then(this._getBucketRevisions.bind(this))
      .then(this._activateRevision.bind(this, revision))
      .then(this._printSuccessMessage.bind(this, 'Revision activated'))
      .catch(function(err) {
        var message = this._getFormattedErrorMessage('There was an error activating that revision', err);
        return this._printErrorMessage(message);
      }.bind(this));
    }.bind(this));
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

  /* Private methods */

  /**
   * Gets all current revisions based on the bucket's content
   * @param {Array} bucketContents - Bucket objects
   * @returns {Array}
   */
  _getBucketRevisions: function(bucketContents) {
    // Assumes bucket only contains index revisions, and therefore all files are '.html'
    var revisions = bucketContents.Contents.map(function(item) {
      return item.Key.substring(0, (item.Key.length - 5)); 
    });

    return revisions;
  },

  _printBucketRevisions: function(revisions) {
    var header = green('Found the following revisions: \n');

    var revisionsList = revisions.reduce(function(prev, current, index) {
      return prev + '\n\n' + (index + 1) + ') ' + current;
    }, '');

    var footer = green('\n\nUse activate() to activate one of these revisions');
    var message = header + revisionsList + footer;
    return this._printSuccessMessage(message);
  },

  /**
   * Gets the contents of the bucket specified in the config
   * @returns {RSVP.Promise}
   */
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

  /**
   * Takes a revision number, i.e. ember-app:41d59aa, and sets the
   * index.html file contents equal to that of the revision. Will
   * error if trying to activate a revision that doesn't exist.
   * @returns {RSVP.Promise}
   */
  _activateRevision: function(revision, currentRevisions) {
    if (currentRevisions.indexOf(revision) > -1) {
      return new Promise(function(resolve, reject) {
        this._getFileContents(revision + '.html')
        .then(this._setFileContents.bind(this, 'index.html', 'max-age=0, no-cache'))
        .then(function() {
          resolve();
        })
        .catch(function(err) {
          reject(err);
        })
      }.bind(this));
    } else {
      throw new Error("Revision doesn't exist :(");
    }
  },

  /**
   * Gets the contents of a file. Resolves with a Buffer. 
   * @param {string} fileName - name of the file you would like the contents of
   * @returns {RSVP.Promise}
   */
  _getFileContents: function(fileName) {
    return new Promise(function(resolve, reject) {
      this.client.getObject({
        Bucket: this.config.bucket,
        Key: fileName
      }, function(err, data) {
        if (err) {
          reject(err);
        } else {
          resolve(data.Body);
        }
      });
    }.bind(this));
  },

  /**
   * Sets a particular fileName's contents to be equal to the content passed in
   * Resolves with a Buffer.
   * @param {string} fileName - name of the file you would like to update
   * @param {string} cacheControl - settings for the cache-control header
   * @param {Buffer} contents - the new content
   * @returns {RSVP.Promise}
   */
  _setFileContents: function(fileName, cacheControl, contents) {
    return new Promise(function(resolve, reject) {
      this.client.putObject({
        Bucket: this.config.bucket,
        Key: fileName,
        Body: contents,
        CacheControl: cacheControl
      }, function(err, data) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }.bind(this));
    }.bind(this));
  },

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
      var params = this._getUploadParams(value, key);
      
      this.client.putObject(params, function(err, data) {
        if (err) {
          this._logUploadError(reject, err);
        } else {
          this._logUploadSuccess(resolve);
        }
      }.bind(this));
    }.bind(this));
  },

  _getUploadParams: function(value, key) {    
    var params = {
      Bucket: this.config.bucket,
      Key: key + '.html',
      Body: value
    };

    return params;
  },

  _deploySuccessMessage: function(revisionKey) {
    var success = green('\nUpload successful!\n\n');
    var uploadMessage = white('Uploaded revision: ') + green(revisionKey);
    return success;
  },

  _printSuccessMessage: function(message) {
    return this.ui.writeLine(message);
  },

  _deployErrorMessage: function() {
    var failure    = '\nUpload failed!\n';
    var suggestion = 'Did you try to upload an already uploaded revision?\n\n';
    var solution   = 'Please run `' + green('ember deploy:list') + '` to ' + 'investigate.';
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