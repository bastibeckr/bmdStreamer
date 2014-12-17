var spawn               = require('child_process').spawn;
var EventEmitter        = require('events').EventEmitter;
var util                = require('util');

var debug               = require('debug')('sat1-node-stream:encoder');

var winston             = require('winston');
var config              = require('config');
var ffmpeg              = require('fluent-ffmpeg');
var ffprobe             = require('fluent-ffmpeg').ffprobe;
var Q                   = require('q');

var _                   = require('lodash');

var PublicDataModel     = require('./model').PublicDataModel;
var modBrowser          = require('./webserver');
var modUtil             = require('./util');

var logger              = modUtil.getLogger('encode', { label: 'Encoder' });


var encoderModelDefaults = {
    name: 'encoder',
    running: false,
    command: '',
    progress: null,
};

function Encode(){
    EventEmitter.call(this);



    this.encoderModel = new PublicDataModel(encoderModelDefaults);


    this.outputOpts = {
        'profile:v':    'main',
        'preset':       'medium',
        'crf':          '29',
        'tune':         'zerolatency',
        'g':            '30',
        'ab':           '96000',
        'ar':           '44100',
        'ac':           '2'
    };


    this.currentCommand = null;

}

util.inherits(Encode, EventEmitter);

Encode.prototype.setupBaseCommand   = setupBaseCommand;
Encode.prototype.startEncoding      = startEncoding;
Encode.prototype.encodePreview      = encodePreview;
Encode.prototype.stopEncoding       = stopEncoding;
Encode.prototype.getInfo            = getInfo;
Encode.prototype.onSettingsChange   = onSettingsChange;

module.exports = new Encode();


/**
 * [onSettingsChange description]
 * @param  {[type]} settings [description]
 * @return {[type]}          [description]
 */
function onSettingsChange(settings){

}


function onBaseCommandError(err, stdout, stderr, deferred){
    var self = this;
    logger.error('encoder encountered an error.', {
        'msg': err.message,
        'stderr': stderr
    });
    resetEncoderModel.apply(self);
    return deferred.reject( err.message );
}

var onBaseCommandErrorDeferred;


/**
 * [getBaseCommand description]
 * @param  {[type]} deferred [description]
 * @return {[type]}          [description]
 */
function setupBaseCommand() {
    var deferred = Q.defer();
    var self = this;

    if( self.currentCommand ){
        logger.warn('Will not setup base command because there is a currentCommand set.');
        return deferred.reject('Will not setup base command because there is a currentCommand set.');
    }

    onBaseCommandErrorDeferred = _.partialRight(onBaseCommandError, deferred).bind(this);

    var baseCommand = ffmpeg({
            'logger': logger
        })
        .on('start', function(cmd) {
            logger.debug('Spawned ffmpeg with command: "%s"', cmd);
            self.encoderModel.set({
                running: true,
                command: cmd
            });
        })
        .on('codecData', function(data){
            logger.debug('Got Codec Info: ', data);
        })
        .on('end', function() {
            logger.debug('encoder was successful.');
            resetEncoderModel.apply(self);
            return deferred.resolve();
        })
        .on('error', onBaseCommandErrorDeferred)
        .on('progress', function(prog) {
            self.encoderModel.set({
                progress: prog
            });
            return deferred.notify(prog);
        });

        self.currentCommand = baseCommand;

    return deferred.promise;

}


/**
 * [resetEncoderModel description]
 * @return {[type]} [description]
 */
function resetEncoderModel(){
    var self = this;
    self.currentCommand = null;
    self.encoderModel.clear().set( encoderModelDefaults );
}



/**
 * [startEncoding description]
 * @param  {[type]} inputObj [description]
 * @return {[type]}          [description]
 */
function startEncoding( inputObj ) {

    var deferred = Q.defer();
    var self = this;

    logger.debug('start encoding');

    if( _.isEmpty( inputObj ) ){
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

    self.setupBaseCommand().then( deferred.resolve, deferred.reject );

    var outputOptionsArray = modUtil.paramsObjectToArray( self.outputOpts );

    self.currentCommand
        .addInput(input)
        .addInputOptions('-re');

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
    var self = this;

    if (typeof( inputObj ) === 'object' && ('stdout' in inputObj) ) {
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
            logger.debug('Spawned ffmpeg with command: "%s"', cmd);
        })
        .on('end', function() {
            logger.debug('Encoder was successful.');

            deferred.resolve();
        })
        .on('error', function(err, stdout, stderr) {
            logger.debug('Encoder encountered an error.', err.message);
            deferred.reject(err.message);
        })
        .addInput( input )
        .noAudio()
        .output( 'screenshot-2.png' )
        .size( '1280x720' )
        .takeFrames(1);

        command.run();

    return deferred.promise;
}

/**
 * [stopStreaming description]
 * @return {[type]} [description]
 */
function stopEncoding() {
    var self = this;
    var deferred = Q.defer();

    logger.debug('Stop encoding?');

    if( self.currentCommand && self.currentCommand.kill ) {
        logger.debug('Found kill method');

        logger.debug('Error listeners: ', JSON.stringify(self.currentCommand.listeners('error')));

        self.currentCommand.removeListener( 'error', onBaseCommandErrorDeferred );

        self.currentCommand.on('error', function(){
            logger.debug('on error after user pressed stop');
            deferred.resolve();
            resetEncoderModel.apply(self);
            return deferred.resolve();
        }).kill();

    } else {
        logger.debug('Didnt find kill method');
        deferred.reject('Didnt find kill method');
    }

    return deferred.promise;

}


function getInfo() {
    Q.nfcall(ffmpeg.getAvailableFormats).then(function(formats) {
        debug(formats);
    });
    Q.nfcall(ffmpeg.getAvailableCodecs).then(function(codecs) {
        debug(codecs);
    });
}


// module.exports = {
//     startEncoding: startEncoding,
//     stopEncoding: stopEncoding,
//     encodePreview: encodePreview,
//     publicData: encoderModel,
//     getBaseCommand: getBaseCommand
// };
