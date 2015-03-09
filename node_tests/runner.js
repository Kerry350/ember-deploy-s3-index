var glob  = require('glob');
var Mocha = require('mocha');

var mocha = new Mocha({
  timeout: 6000,
  reporter: 'spec'
});

var directory = 'node_tests';

var files = glob(directory + '/**/*-test.js', { sync: true });

files.forEach(function(file) {
  mocha.addFile(file);
});

mocha.run(function(failures) {
  process.on('exit', function() {
    process.exit(failures);
  });
});
