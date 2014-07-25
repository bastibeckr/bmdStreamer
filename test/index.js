var expect = require('expect.js'),
    sat1NodeStream = require('..');

describe('sat1-node-stream', function() {
  it('should say hello', function(done) {
    expect(sat1NodeStream()).to.equal('Hello, world');
    done();
  });
});
