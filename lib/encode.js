var debugMod = require('debug');
var debug = debugMod('sat1-node-stream:encoder');

var winston = require('winston');
var config = require('config');
var ffmpeg = require('fluent-ffmpeg');
var ffprobe = require('fluent-ffmpeg').ffprobe;
var Q = require('q');
var spawn = require('child_process').spawn;

var _ = require('lodash');

var PublicDataModel = require('./model').PublicDataModel;
var modBrowser = require('./webserver');
var util = require('./util');

var logger = util.getLogger('encode', { label: 'Encoder' });


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







function onSettingsChange(settings){

}


var currentCommand;


/**
 * [getBaseCommand description]
 * @param  {[type]} deferred [description]
 * @return {[type]}          [description]
 */
function getBaseCommand(deferred) {

    var baseCommand = ffmpeg({
            'logger': logger
        })
        .on('start', function(cmd) {
            logger.debug('Spawned Ffmpeg with command: ' + cmd);
            encoderModel.set({
                running: true,
                command: cmd
            });
        })
        .on('codecData', function(data){
            logger.debug('Got Codec Info: ', data);
        })
        .on('end', function() {
            logger.debug('encoder was successful.');
            deferred.resolve();
            delete(currentCommand);
            encoderModel.set({
                running: false,
                command: ''
            });
        })
        .on('error', function(err, stdout, stderr) {
            logger.error('encoder encountered an error.', {
                'msg': err.message,
                'stderr': stderr
            });
            encoderModel.set({
                running: false,
                command: ''
            });
            delete( currentCommand );
            deferred.reject( err.message );
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
function startEncoding( inputObj ) {

    logger.debug('start encoding');

    var deferred = Q.defer();

    if( _.isEmpty(inputObj) ){
        logger.warn('No input');
        deferred.reject('no input');
        return deferred.promise;
    }

    if (typeof(inputObj) === 'object' && ('stdout' in inputObj)) {
        input = inputObj.stdout;
    }

    if (encoderModel.get('running') === true) {
        logger.debug('won’t start encoding because encoder seems busy');
        deferred.reject('we already an active encoder.');
        return deferred.promise;
    }

    currentCommand = getBaseCommand(deferred);

    var outputOptionsArray = util.paramsObjectToArray(outputOpts);

    currentCommand.addInput(input)
        .addInputOptions('-re')
        // .addInputOptions('-analyzeduration 5000M')

    // .addOutput('udp://192.168.178.43:1234')
    //     .videoCodec('libx264')
    //     .audioCodec('libmp3lame')
    //     .outputOptions(outputOptionsArray)
    //     .videoFilters([{
    //         filter: 'format',
    //         options: ['yuv420p']
    //     }, {
    //         filter: 'scale',
    //         options: ['1280:720']
    //     }]).format('mpegts');

    // currentCommand.run();

    return deferred.promise;
}


function encodePreview( inputObj ) {
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
            logger.debug('Spawned Ffmpeg with command: ' + cmd);
        })
        .on('end', function() {
            logger.debug('Encoder was successful.');

            deferred.resolve();
        })
        .on('error', function(err, stdout, stderr) {
            logger.debug('Encoder encountered an error.', err.message);
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
    logger.debug('Stop streaming?');
    if (currentCommand && currentCommand.kill) {
        logger.debug('Found kill method');
        currentCommand.kill();
    } else {
        logger.debug('Didnt find kill method');
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
