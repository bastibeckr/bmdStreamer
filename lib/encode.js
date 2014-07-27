
var debug = require('debug')('encoder');
var config = require('config');
var ffmpeg = require('fluent-ffmpeg');
var Backbone = require('backbone');
var Q = require('q');

var PublicDataModel = require('./model').publicData;

var publicData = new PublicDataModel({
    name: 'encoder',
    running: false,
    command: ''
});

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

    if( publicData.get('running') === true ){
        debug('won’t start encoding because encoder seems busy');
        return;
    }

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


function encodePreview( input ){
    debug('get preview');

    if( publicData.get('running') === true ){
        debug('won’t start encoding because encoder seems busy');
        return;
    }

    var command = ffmpeg( input )

    .on('start', function(cmd) {
        publicData.set({running: true, command: cmd});
    })
    .on('end', function(){
        publicData.set({running: false, command: ''});
    })
    .output('screenshot.png')
    .seek(2)
    .size('640x360')
    .takeFrames(1);

    return command;
}


function getInfo( ){
    Q.nfcall(ffmpeg.getAvailableFormats).then(function(formats){
        debug(formats);
    });
    Q.nfcall(ffmpeg.getAvailableCodecs).then(function(codecs){
        debug(codecs);
    });
}


module.exports = {
    startEncoding: startEncoding,
    encodePreview: encodePreview
};
