var debugMod = require('debug');
var debug = debugMod('sat1-node-stream:encoder');

var winston = require('winston');
var config = require('config');
var ffmpeg = require('fluent-ffmpeg');
var ffprobe = require('fluent-ffmpeg').ffprobe;
var Q = require('q');
var spawn = require('child_process').spawn;

var _ = require('lodash');
var ansi_up = require('ansi_up');

var PublicDataModel = require('./model').PublicDataModel;
var modBrowser = require('./webserver');
var util = require('./util');


var encoderModel = new PublicDataModel({
    name: 'encoder',
    running: false,
    command: '',
    progress: {},
});



var outputOpts = {
    'profile:v':    'main',
    'preset':       'medium',
    'crf':          '29',
    'tune':         'zerolatency',
    'g':            '30',
    'ab':           '96000',
    'ar':           '44100',
    'ac':           '2'
};


winston.loggers.add('encode', {
    console: {
        timestamp: true,
        colorize: true,
        label: 'Encoder / Output'
    }
});

var encLogger = winston.loggers.get('encode');




function onSettingsChange(settings){

}


var currentCommand;



function getBaseCommand(deferred) {

    var baseCommand = ffmpeg({
            'logger': encLogger
        })
        .on('start', function(cmd) {
            encLogger.info('Spawned Ffmpeg with command: ' + cmd);
            encoderModel.set({
                running: true,
                command: cmd
            });
        })
        .on('codecData', function(data){
            encLogger.info('Got Codec Info: ', data);
        })
        .on('end', function() {
            encLogger.info('encoder was successful.');
            deferred.resolve();
            delete(currentCommand);
            encoderModel.set({
                running: false,
                command: ''
            });
        })
        .on('error', function(err, stdout, stderr) {
            encLogger.error('encoder encountered an error.', {
                'msg': err.message,
                'stderr': stderr
            });
            encoderModel.set({
                running: false,
                command: ''
            });
            delete(currentCommand);
            deferred.reject(err.message);
        })
        .on('progress', function(prog) {
            encoderModel.set({
                progress: prog
            });
            deferred.notify(prog);
        });

        currentCommand = baseCommand;
    return baseCommand;

}







/**
 * [startEncoding description]
 * @param  {[type]} inputObj [description]
 * @return {[type]}          [description]
 */
function startEncoding(inputObj) {

    encLogger.info('start encoding');

    var deferred = Q.defer();

    if( _.isEmpty(inputObj) ){
        encLogger.warn('No input');
        deferred.reject('no input');
        return deferred.promise;
    }

    if (typeof(inputObj) === 'object' && ('stdout' in inputObj)) {
        input = inputObj.stdout;
    }

    if (encoderModel.get('running') === true) {
        encLogger.info('won’t start encoding because encoder seems busy');
        deferred.reject('we already an active encoder.');
        return deferred.promise;
    }

    currentCommand = getBaseCommand(deferred);

    var outputOptionsArray = util.paramsObjectToArray(outputOpts);

    currentCommand.addInput(input)
        .addInputOptions('-re')
        // .addInputOptions('-analyzeduration 5000M')

    .addOutput('udp://192.168.178.43:1234')
        .videoCodec('libx264')
        .audioCodec('libmp3lame')
        .outputOptions(outputOptionsArray)
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
        .takeFrames(1);

        command.run();

    return deferred.promise;
}

/**
 * [stopStreaming description]
 * @return {[type]} [description]
 */
function stopEncoding() {
    encLogger.info('Stop streaming?');
    if (currentCommand && currentCommand.kill) {
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
    publicData: encoderModel,
    getBaseCommand: getBaseCommand
};
