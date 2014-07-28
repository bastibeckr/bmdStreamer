var debug = require('debug')('sat1-node-stream:encoder');
var winston = require('winston');
var config = require('config');
var ffmpeg = require('fluent-ffmpeg');
var Backbone = require('backbone');
var Q = require('q');
var _ = require('lodash');

var PublicDataModel = require('./model').publicData;

var publicData = new PublicDataModel({
    name: 'encoder',
    running: false,
    command: '',
    progress: {}
});

var outputOpts = [
    '-profile:v main',
    '-preset medium',
    '-crf 29',
    '-tune zerolatency',
    '-g 30',
    '-ab 96000',
    '-ar 44100',
    '-ac 2'
];

var currentCommand;

function getBaseCommand(deferred) {
    var baseCommand = ffmpeg()
        .on('start', function(cmd) {
            debug('Spawned Ffmpeg with command: ' + cmd);
            publicData.set({
                running: true,
                command: cmd
            });
        })
        .on('end', function() {
            debug('Encoder was successful.')
            deferred.resolve();
            publicData.set({
                running: false,
                command: ''
            });
        })
        .on('error', function(err) {
            debug('Encoder encountered an error.', arguments);
            publicData.set({
                running: false,
                command: ''
            });
            deferred.reject(err.message);
        })
        .on('progress', function(prog) {
            publicData.set({
                progress: prog
            });
            deferred.notify(prog)
        });

    return baseCommand;
}

function startEncoding(inputObj) {

    debug('start encoding ');

    var deferred = Q.defer();

    if (typeof(inputObj) === 'object' && ('stdout' in inputObj)) {
        input = inputObj.stdout;
    }

    if (publicData.get('running') === true) {
        debug('won’t start encoding because encoder seems busy');
        deferred.reject('we already an active encoder.');
    }

    currentCommand = getBaseCommand(deferred);

    currentCommand.addInput(input)
        .inputOptions('-re')
        .output('out.mp4')
        .outputOptions(outputOpts)
        .videoFilters([{
            filter: 'format',
            options: ['yuv420p']
        }, {
            filter: 'scale',
            options: ['320:-1']
        }])
        .duration(60);
    // .addOutputOption('-vf scale=320:-1')


    currentCommand.run();

    return deferred.promise;
}


function encodePreview(inputObj) {
    debug('get preview');

    var deferred = Q.defer();

    if (typeof(inputObj) === 'object' && ('stdout' in inputObj)) {
        input = inputObj.stdout;

        inputObj.on('exit', function(code, signal) {
            debug('Encoder must know when Capture-Process exits');
        });
    }



    if (publicData.get('running') === true) {
        debug('won’t start encoding because encoder seems busy');
        deferred.reject('we already an active encoder.');
    }

    currentCommand = getBaseCommand(deferred);
    currentCommand.addInput(input)
        .output('screenshot.png')
        .size('640x360')
        .takeFrames(1);

    currentCommand.run();

    return deferred.promise;
}

/**
 * [stopStreaming description]
 * @return {[type]} [description]
 */
function stopEncoding() {
    debug('Stop streaming?');
    if (currentCommand.kill) {
        debug('Found kill method');
        currentCommand.kill('SIGTERM');
    } else {
        debug('Didnt find kill method');
    }
}


function getInfo() {
    Q.nfcall(ffmpeg.getAvailableFormats).then(function(formats) {
        debug(formats);
    });
    Q.nfcall(ffmpeg.getAvailableCodecs).then(function(codecs) {
        debug(codecs);
    });
}


module.exports = {
    startEncoding: startEncoding,
    stopEncoding: stopEncoding,
    encodePreview: encodePreview,
    publicData: publicData,
};