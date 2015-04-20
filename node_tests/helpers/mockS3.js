function MockS3() {
  // 2, 3, 1 order
  this.bucketContents = {
    Contents: [
      {
        Key: '1.html',
        LastModified: 'Mon Apr 20 2015 11:23:56 GMT+0100 (BST)',
      },

      {
        Key: '2.html',
        LastModified: 'Mon Apr 20 2015 11:25:56 GMT+0100 (BST)',
      },

      {
        Key: '3.html',
        LastModified: 'Mon Apr 20 2015 11:24:56 GMT+0100 (BST)',
      }
    ]
  }
}

MockS3.prototype = {
  listObjects: function(opts, cb) {
    return cb(null, this.bucketContents);
  },

  putObject: function(opts, cb) {
    return cb(null, null);
  },

  deleteObjects: function(opts, cb) {
    return cb(null, null);
  },

  getObject: function(opts, cb) {
    return cb(null, {Body: 'Some content'});
  },

  putBucketWebsite: function(opts, cb) {
    return cb(null, {Body: 'Some content'});
  }
};

module.exports = MockS3;
