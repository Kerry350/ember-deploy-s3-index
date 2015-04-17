'use strict';

var chai = require('chai');
var expect = chai.expect;
var S3Adapter = require('../../lib/s3-adapter');
var adapter;

describe('S3 Adapter tests', function() {
  beforeEach('Reset adapter instance', function(done) {
    adapter = new S3Adapter({
      config: {}
    });
    done();
  });

  describe('Config option tests', function() {
    context('Config supplied', function() {
      it('Does not throw an error', function() {
        expect(function() {
          new S3Adapter({config: {}});
        }).to.not.throw(Error);
      });
    });

    context('Config not supplied', function() {
      it('Throws an error', function() {
        expect(function() {
          new S3Adapter()
        }).to.throw(Error);
      });
    });

    context('prefix option has been set', function() {
      it('Should throw an error when indexMode is not equal to indirect', function() {
        expect(function() {
          new S3Adapter({config: {
            prefix: '/kittens',
            indexMode: 'direct'
          }});
        }).to.throw(Error);
      });
    });
  });
});
