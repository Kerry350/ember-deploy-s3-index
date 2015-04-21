'use strict';

var chai = require('chai');
var sinon = require('sinon');
var expect = chai.expect;
var S3Adapter = require('../../lib/s3-adapter');
var MockS3 = require('./../helpers/mockS3');
var MockUI = require('ember-cli/tests/helpers/mock-ui');
var adapter;

var sinonChai = require("sinon-chai");
chai.use(sinonChai);

var chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);

var BUFFER = 'A buffer';
var SHA_KEY = 'Spongebob';
var EXISTING_KEY = '1';
var BUCKET_NAME = 'Rusty';
var HOST_NAME = 'Hosty';

describe('S3 Adapter tests', function() {
  beforeEach('Reset adapter instance', function(done) {
    adapter = new S3Adapter({
      config: {
        bucket: BUCKET_NAME,
        hostName: HOST_NAME
      },
      S3: new MockS3(),
      ui: new MockUI(),
      taggingAdapter: {
        createTag: function() {
          return SHA_KEY
        }
      }
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

  describe('#upload()', function() {
    it('Should call #_upload() with a buffer and the key', function() {
      adapter._upload = sinon.spy();
      adapter.upload(BUFFER)
      expect(adapter._upload).to.have.been.calledWith(BUFFER, SHA_KEY);
    });

    context('Revision has already been uploaded', function() {
      it('Should be rejected', function() {
        return expect(adapter._upload(BUFFER, EXISTING_KEY)).to.be.rejected;
      });
    });

    context('Revision has not been uploaded', function() {
      it('Should upload the revision', function(done) {
        sinon.spy(adapter.S3, 'putObject');
        return adapter.upload(BUFFER)
        .then(function() {
          expect(adapter.S3.putObject).to.have.been.called;
          done();
        });
      });

      it('Should use the correct upload params', function(done) {
        var expectedParams =  {
          Bucket: BUCKET_NAME,
          Key: SHA_KEY + '.html',
          Body: BUFFER,
          ContentType: 'text/html',
          CacheControl: 'max-age=0, no-cache'
        };

        sinon.spy(adapter, '_getUploadParams');

        return adapter.upload(BUFFER)
        .then(function() {
          expect(adapter._getUploadParams).to.have.been.called;
          expect(adapter._getUploadParams.returnValues[0]).to.eql(expectedParams);
          done();
        });
      });
    });

    context('Bucket holds more items than manifest limit', function() {
      it('Should remove excess items', function(done) {
        adapter.manifestSize = 1;
        sinon.spy(adapter.S3, 'deleteObjects');
        return adapter.upload(BUFFER)
        .then(function() {
          expect(adapter.S3.deleteObjects).to.have.been.called;
          expect(adapter.S3.deleteObjects.args[0][0].Delete.Objects.length).to.equal(2);
          done();
        });
      });
    });
  });

  describe('#activate()', function() {
    context('Activating a revision that does not exist', function() {
      it('Should throw an error', function() {
        return expect(adapter.activate('4')).to.be.rejectedWith(Error, "Revision doesn't exist :(");
      });
    });

    context('Activating a revision that does exist', function() {
      context('indexMode === direct', function() {
        it('Should call #_updateBucketWebsite()', function(done) {
          sinon.spy(adapter, '_updateBucketWebsite');
          return adapter.activate('1')
          .then(function() {
            expect(adapter._updateBucketWebsite).to.have.been.called;
            done();
          });
        });

        it('Should call S3s #putBucketWebsite() with the correct parameters', function(done) {
          var expectedParams =  {
            Bucket: BUCKET_NAME, /* required */
            WebsiteConfiguration: { /* required */
              ErrorDocument: {
                Key: 'error.html' /* required */
              },
              IndexDocument: {
                Suffix: '1.html' /* required */
              },

              RoutingRules: [
                {
                Redirect: { /* required */
                  HostName: HOST_NAME,
                  ReplaceKeyPrefixWith: '#/',
                },
                Condition: {
                  HttpErrorCodeReturnedEquals: '404',
                }
              },
              ]
            }
          };

          sinon.spy(adapter.S3, 'putBucketWebsite');
          return adapter.activate('1')
          .then(function() {
            expect(adapter.S3.putBucketWebsite).to.have.been.called;
            expect(adapter.S3.putBucketWebsite.args[0][0]).to.eql(expectedParams);
            done();
          });
        });
      });

      context('indexMode === indirect', function() {
        it('Should call S3s #putObject() with the correct parameters', function(done) {
          var expectedParams = {
            Bucket: BUCKET_NAME,
            Key: 'index.html',
            Body: 'Some content',
            ContentType: 'text/html',
            CacheControl: 'max-age=0, no-cache'
          };

          adapter.indexMode = 'indirect';
          sinon.spy(adapter.S3, 'putObject');

          return adapter.activate('1')
          .then(function() {
            expect(adapter.S3.putObject).to.have.been.called;
            expect(adapter.S3.putObject.args[0][0]).to.eql(expectedParams);
            done();
          });
        });
      });

      context('prefix option has been set', function() {
        it('Should use the prefix in the key', function() {
          adapter.indexMode = 'indirect';
          adapter.indexPrefix = 'kittens/';

          expect(adapter._getUploadParams('index').Key).to.equal('kittens/index.html');
        });
      });
    });
  });

  describe('#list', function() {
    beforeEach(function() {
      return adapter.list();
    });

    afterEach(function() {
      adapter.ui.output = '';
    });

    it('Should output the revisions', function(done) {
      var output = ['1) 2', '2) 3', '3) 1'];
      output.forEach(function(portion) {
        expect(adapter.ui.output).to.contain(portion);
      });
      done();
    });
  });

  describe('#_sortBucketContent', function() {
    it('Should sort the contents by LastModified date', function(done) {
      expect(adapter._sortBucketContent(adapter.S3.bucketContents).Contents[0].Key).to.equal('2.html');
      expect(adapter._sortBucketContent(adapter.S3.bucketContents).Contents[1].Key).to.equal('3.html');
      expect(adapter._sortBucketContent(adapter.S3.bucketContents).Contents[2].Key).to.equal('1.html');
      done();
    });
  });
});
