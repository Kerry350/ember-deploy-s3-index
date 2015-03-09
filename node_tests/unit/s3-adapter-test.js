'use strict';

var assert    = require('assert');
var S3Adapter = require('../../lib/s3-adapter');

describe('S3Adapter tests', function() {
  var adapter;

  it('requires config to instantiate S3 Adapter', function() {

    assert.throws(function() {
      new S3Adapter();
    }, function(error) {
      return ('You must supply a config' === error.message);
    }, "Should error when not supplying a config on instantiation");

    assert.doesNotThrow(function() {
      new S3Adapter({
        config: {}
      });
    }, "Should not error when supplied a config on instantiation");

  });

});
