var fs = require('fs');
var util = require('util');
var _ = require('lodash');

var pass = require('stream').PassThrough;
var debug = require('debug')('sat1-node-stream:streamtest');

var through2 = require('through2');


module.exports = function () {
    var old_stdout_write = process.stdout.write;
    var old_stderr_write = process.stderr.write;


    var throughStream = through2(function (chunk, encoding, callback) {
        // oldWrite.apply(this, arguments);
        this.push(chunk);
        return callback();
    });

    process.stdout.write = (function(write) {
        return function(string, encoding, fd) {
            var args = _.toArray(arguments);
            throughStream.write.apply(throughStream, args);
            write.apply(process.stdout, args);
            // only intercept the string
        };
    }(process.stdout.write));

    process.stderr.write = (function(err) {
        return function(string, encoding, fd) {
            var args = _.toArray(arguments);
            throughStream.write.apply(throughStream, args);
            err.apply(process.stderr, args);
            // only intercept the string
        };
    }(process.stderr.write));


    // console.log = (function(log) {
    //     return function() {
    //         var args = _.toArray(arguments);
    //         // args.unshift('[ERROR]');
    //         console.error('ON ERR');
    //         throughStream.write.apply(throughStream, args);
    //         log.apply(console.log, args);
    //     };
    // }(console.log));



    // console.error = (function(log) {
    //     return function() {
    //         var args = _.toArray(arguments);
    //         // args.unshift('[ERROR]');
    //         console.log.apply(console.log, args);
    //       // string here encapsulates all the args
    //         throughStream.write.apply(throughStream, util.format(args).toBuffer());
    //     };
    // }(console.error));

    return throughStream;

    // // puts back to original
    // return function unhook() {
    //     process.stdout.write = old_stdout_write;
    //     console.error = old_console_error;
    // };

};
