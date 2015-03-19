'use strict';

var CoreObject  = require('core-object');
var Promise = require('ember-cli/lib/ext/promise');
var SilentError = require('ember-cli/lib/errors/silent');
var AWS = require('aws-sdk');
var chalk = require('chalk');

var green = chalk.green;
var white = chalk.white;

var DEFAULT_MANIFEST_SIZE = 5;

module.exports = CoreObject.extend({
  init: function() {
    CoreObject.prototype.init.apply(this, arguments);

    if (!this.config) {
      throw new SilentError('You must supply a config');
    }

    this.client = new AWS.S3(this.config);
    this.manifestSize = this.manifestSize || DEFAULT_MANIFEST_SIZE;
  },

  /* Public methods */

  upload: function(buffer) {
    var key = this.taggingAdapter.createTag();
    return this._upload(buffer, key);
  },

  activate: function(revision) {
    return this._getBucketContents()
      .then(this._getBucketRevisions.bind(this))
      .then(this._activateRevision.bind(this, revision))
      .then(this._printSuccessMessage.bind(this, 'Revision activated'))
      .catch(function(err) {
        var message = this._getFormattedErrorMessage('There was an error activating that revision', err);
        return this._printErrorMessage(message);
      }.bind(this));
  },

  list: function() {
    return this._list()
    .then(this._printBucketRevisions.bind(this))
    .catch(function(err) {
      var message = this._getFormattedErrorMessage('There was an error calling list()', err);
      return this._printErrorMessage(message);
    }.bind(this));
  },

  /* Private methods */

  _list: function() {
    return this._getBucketContents()
    .then(this._sortBucketContent.bind(this))
    .then(this._removeCurrentRevisionFromContents.bind(this))
    .then(this._getBucketRevisions.bind(this));
  },

  _sortBucketContent: function(data) {
    data.Contents = data.Contents.sort(function(a, b) {
      return b.LastModified - a.LastModified;
    });

    return data;
  },

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
        .then(this._updateBucketWebsite.bind(this, revision))
        .then(function() {
          resolve();
        })
        .catch(function(err) {
          reject(err);
        });
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
   * Uploads / updates objects in the bucket
   * Resolves with a Buffer.
   * @param {Object} params - params for object
   * @returns {RSVP.Promise}
   */
  _setFileContents: function(params) {
    return new Promise(function(resolve, reject) {
      this.client.putObject(params, function(err, data) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      }.bind(this));
    }.bind(this));
  },

  /**
   * Uploads our index.html contents to S3
   * @param {buffer} value - index.html contents
   * @param {string} key - key provided by the tagging adapter
   * @returns {RSVP.Promise}
   */
  _upload: function(value, key) {
    return this._uploadIfNotAlreadyInManifest(value, key)
          .then(this._cleanupBucket.bind(this))
          .then(this._deploySuccessMessage.bind(this, key))
          .then(this._printSuccessMessage.bind(this))
          .catch(function() {
            var message = this._deployErrorMessage();
            return this._printErrorMessage(message);
          }.bind(this));
  },

  /**
   * Ensures bucket holds no more than the specified number of revisions
   * @returns {RSVP.Promise}
   */
  _cleanupBucket: function() {
    return new Promise(function(resolve, reject) {
      this._getBucketContents()
      .then(this._removeCurrentRevisionFromContents.bind(this))
      .then(function(data) {
        if ((data.Contents.length - this.manifestSize) > 0) {
          var itemsToDelete = this._getItemsForDeletion(data);
          this._deleteItemsFromBucket(itemsToDelete)
          .then(resolve)
          .catch(reject);
        } else {
          resolve();
        }
      }.bind(this))
      .catch(function(err) {
        reject(err);
      });
    }.bind(this));
  },

  /**
   * Returns items that are in excess of the manifestSize
   * @param {Object} data - data returned from bucket
   * @returns {Array}
   */
  _getItemsForDeletion: function(data) {
    var numerOfItemsToDelete = data.Contents.length - this.manifestSize;
    var sortedContents = data.Contents.sort(function(a, b) {
      return new Date(b.LastModified) - new Date(a.LastModified);
    });
    var itemsToDelete = sortedContents.slice((sortedContents.length - numerOfItemsToDelete)).map(function(item) {
      return item.Key;
    });
    return itemsToDelete;
  },

  /**
   * Removes one or more items from the bucket
   * @param {Array} itemKeys - array of bucket object keys
   * @returns {RSVP.Promise}
   */
  _deleteItemsFromBucket: function(itemKeys) {
    return new Promise(function(resolve, reject) {
      this.client.deleteObjects({
        Bucket: this.config.bucket,
        Delete: {
          Objects: itemKeys.map(function(item) {
            return {Key: item};
          })
        }
      }, function(err, data) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    }.bind(this));
  },

  /**
   * Removes our 'current' representation from data set
   * @param {Object} data - data returned from bucket
   * @returns {Object}
   */
  _removeCurrentRevisionFromContents: function(data) {
    for (var i = 0, len = data.Contents.length; i < len; i++) {
      if (data.Contents[i].Key === 'index.html') {
        data.Contents.splice(i, 1);
        break;
      }
    }

    return data;
  },

  /**
   * Uploads our index.html contents to S3 if the revision doesn't exist
   * @param {string} indexHTML - index.html contents
   * @returns {RSVP.Promise}
   */
  _uploadIfNotAlreadyInManifest: function(value, key) {
    return new Promise(function(resolve, reject) {
      this._list()
      .then(function(revisions) {
        if (revisions.indexOf(key) < 0) {
          var params = this._getUploadParams(key, value);
          this.client.putObject(params, function(err, data) {
            if (err) {
              this._logUploadError(reject, err);
            } else {
              this._logUploadSuccess(resolve);
            }
          }.bind(this));
        } else {
          reject();
        }
      }.bind(this));
    }.bind(this));
  },

 /**
  * Updates website index document to point to a new revision.
  * @param {string} revision - revision to update index to
  * @returns {RSVP.Promise}
  */
  _updateBucketWebsite: function(revision){
    return new Promise(function(resolve, reject) {
      var params = this._getWebsiteParams(revision);
      this.client.putBucketWebsite(params, function(err, data) {
        if (err) {
          reject(err);
        } else {
          resolve(data.Body);
        }
      });
    }.bind(this));
  },

 /**
  * Generates parameters for bucket website configuration.
  * @param {string} revision - revision to update index to
  * @returns {Object}
  */
  _getWebsiteParams: function(revision){
    return {
      Bucket: this.config. bucket, /* required */
      WebsiteConfiguration: { /* required */
        ErrorDocument: {
          Key: 'error.html' /* required */
        },
        IndexDocument: {
          Suffix: revision +'.html' /* required */
        },

        RoutingRules: [
          {
          Redirect: { /* required */
            HostName: this.config.hostName,
            ReplaceKeyPrefixWith: '#/',
          },
          Condition: {
            HttpErrorCodeReturnedEquals: '404',
          }
        },
        ]
      }
    };
  },

  _getUploadParams: function(key, value) {
    var params = {
      Bucket: this.config.bucket,
      Key: key + '.html',
      Body: value,
      ContentType: 'text/html',
      CacheControl: 'max-age=0, no-cache'
    };

    return params;
  },

  _deploySuccessMessage: function(revisionKey) {
    var success = green('\nUpload successful!\n\n');
    var uploadMessage = white('Uploaded revision: ') + green(revisionKey);
    return success + uploadMessage;
  },

  _printSuccessMessage: function(message) {
    return this.ui.writeLine(message);
  },

  _printErrorMessage: function(message) {
    return Promise.reject(new SilentError(message));
  },

  _deployErrorMessage: function() {
    var failure    = '\nUpload failed!\n';
    var suggestion = 'Did you try to upload an already uploaded revision?\n\n';
    var solution   = 'Please run `' + green('ember deploy:list') + '` to ' + 'investigate.';
    return failure + suggestion + solution;
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
    message = message + '\n\n';
    error = (error) ? (error.stack + '\n') : '';
    return message + error;
  }
});
