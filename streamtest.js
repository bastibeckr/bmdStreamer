var fs = require('fs');
var util = require('util');

var pass = require('stream').PassThrough;
var debug = require('debug')('sat1-node-stream:streamtest');

var through2 = require('through2');

var oldWrite = process.stdout.write;


var throughStream = through2(function (chunk, encoding, callback) {
    // oldWrite.apply(this, arguments);

    this.push(chunk);
    return callback();
});

function intercept(){
    var readStream = fs.createReadStream('test.txt');


    process.stdout.write = function(chunk, encoding, callback) {
       throughStream.write(chunk, encoding, callback);
       oldWrite.apply(this, arguments);
       // return callback();
    };

    return throughStream;
}


module.exports = {
    intercept: intercept
};
