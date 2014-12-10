var debugMod = require('debug');
var debug = debugMod('sat1-node-stream:encoder');

var winston = require('winston');
var config = require('config');
var ffmpeg = require('fluent-ffmpeg');
var Q = require('q');
var spawn = require('child_process').spawn;

var _ = require('lodash');
var ansi_up = require('ansi_up');

var PublicDataModel = require('./model').PublicData;
var modBrowser = require('./webserver');

var publicData = new PublicDataModel({
    name: 'encoder',
    running: false,
    command: '',
    progress: {},
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


winston.loggers.add('encode', {
    console: {
        timestamp: true,
        colorize: true,
        label: 'Encoder / Output'
    }
});

var encLogger = winston.loggers.get('encode');




//  /**
//   * [logOverride description]
//   * @return {[type]} [description]
//   */
//   function logOverride(){
//       var self = this;
//       var args = Array.prototype.slice.call(arguments);
//       modBrowser.sendData(args[0], 'log');
//       return console.log.apply(self, args);
//   }
// debug.log = logOverride.bind(console);



var currentCommand;



function getBaseCommand(deferred) {
    var baseCommand = ffmpeg({
            'logger': encLogger
        })
        .on('start', function(cmd) {
            encLogger.info('Spawned Ffmpeg with command: ' + cmd);
            publicData.set({
                running: true,
                command: cmd
            });
        })
        .on('end', function() {
            encLogger.info('Encoder was successful.');
            deferred.resolve();
            publicData.set({
                running: false,
                command: ''
            });
        })
        .on('error', function(err, stdout, stderr) {
            encLogger.error('Encoder encountered an error.', {
                'msg': err.message,
                'stderr': stderr
            });
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
            deferred.notify(prog);
        });

    return baseCommand;
}

function startEncoding(inputObj) {

    encLogger.info('start encoding ');

    var deferred = Q.defer();

    if (typeof(inputObj) === 'object' && ('stdout' in inputObj)) {
        input = inputObj.stdout;
    }

    if (publicData.get('running') === true) {
        encLogger.info('won’t start encoding because encoder seems busy');
        deferred.reject('we already an active encoder.');
    }

    currentCommand = getBaseCommand(deferred);

    currentCommand.addInput(input)
        .inputOptions('-re')
        // .addInputOptions('-analyzeduration 5000M')

    .addOutput('udp://192.168.178.43:1234')
        .videoCodec('libx264')
        .audioCodec('libmp3lame')
        .outputOptions(outputOpts)
        .videoFilters([{
            filter: 'format',
            options: ['yuv420p']
        }, {
            filter: 'scale',
            options: ['1280:720']
        }]).format('mpegts');





    currentCommand.run();

    return deferred.promise;
}


function encodePreview(inputObj) {
    debug('get preview');
    var deferred = Q.defer();
    var input, inputPid;
    if (typeof(inputObj) === 'object' && ('stdout' in inputObj)) {
        input = inputObj.stdout;
    }

    if (typeof(inputObj) === 'object' && ('pid' in inputObj)) {
        inputPid = inputObj.pid;
    }

    // if (publicData.get('running') === true) {
    //     debug('won’t start encoding because encoder seems busy');
    //     deferred.reject('we already an active encoder.');
    // }

    var command = ffmpeg()
        .on('start', function(cmd) {
            encLogger.info('Spawned Ffmpeg with command: ' + cmd);

        })
        .on('end', function() {
            encLogger.info('Encoder was successful.');

            deferred.resolve();
        })
        .on('error', function(err, stdout, stderr) {
            encLogger.info('Encoder encountered an error.', err.message);
            deferred.reject(err.message);
        })
        .addInput(input)
        .noAudio()
        .output('screenshot-2.png')
        .size('1280x720')
        .takeFrames(1)
        .run();

    return deferred.promise;
}

/**
 * [stopStreaming description]
 * @return {[type]} [description]
 */
function stopEncoding() {
    encLogger.info('Stop streaming?');
    if (currentCommand.kill) {
        encLogger.info('Found kill method');
        currentCommand.kill('SIGTERM');
    } else {
        encLogger.info('Didnt find kill method');
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