
var debug = require('debug')('encoder');
var config = require('config');
ffmpeg = require('fluent-ffmpeg');

var outputOpts = [
    '-profile:v main',
    '-preset medium',
    '-crf 29',
    '-tune zerolatency',
    '-g 30',
    '-ab 96000',
    '-ar 44100',
    '-ac 2',
    '-t 10',
    '-y'
];

function startEncoding( input ){

    debug('start encoding');

    var command = ffmpeg( input )
    .inputOptions('-re')
    .output('test-1.mp4')
    .outputOptions(outputOpts)
    .addOutputOption('-vf format=yuv420p,scale=1280:-1')
    .output('test-2.mp4')
    .outputOptions(outputOpts)
    .addOutputOption('-vf format=yuv420p,scale=320:-1');

    return command;
}

module.exports = {
    startEncoding: startEncoding
};
