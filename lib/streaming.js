var EventEmitter        = require('events').EventEmitter;
var util                = require('util');

var debug               = require('debug')('sat1-node-stream:streaming');
var config              = require('config');
var winston             = require('winston');
var spawn               = require('child_process').spawn;
var ffmpeg              = require('fluent-ffmpeg');
var ffprobe             = ffmpeg.ffprobe;
var Q                   = require('q');
var Backbone            = require('backbone');
var _                   = require('lodash');

var modCapture          = require('./capture');
var modEncoder          = require('./encode');
var modBrowser          = require('./webserver');
var modPlayout          = require('./playout');
var modUtil             = require('./util');
var modSettings         = require('./settings');



var logger = modUtil.getLogger('streaming', { label: 'Streamer' });



function Streaming(){
    EventEmitter.call( this );
    logger.info('Streaming constructor');

    modEncoder.setupBaseCommand();



}

util.inherits( Streaming, EventEmitter );


/**
 * [start description]
 * @return {[type]} [description]
 */
Streaming.prototype.start = function(){
    var deferred, outputOptions, isUrl, isBmdPlay,
        bmdOptions, spawnArgs, playoutProcess,
        captureProc, inputStream, outputStream;

    deferred = Q.defer();

    if ( modEncoder.encoderModel.get('running') ) {
        logger.info('Will stop encoder now because Encoder is already running.');
        modEncoder.stopEncoding();
        return false;
    }

    var inputIsUrl = modCapture.captureModel.get('isUrl');
    outputIsUrl = modPlayout.playoutModel.get('isUrl');

    //
    // INPUT
    // ===============
    if( inputIsUrl ){
        logger.debug('Source is URL.');

        modEncoder.setupBaseCommand();

        modEncoder.currentCommand
            .addInput( modCapture.captureModel.get('srcUrl') )
            .addInputOptions(['-re']);


    } else {
        logger.debug('Source is BMD.');
        captureProc = modCapture.startCapture();
        if (!captureProc.stdout) {
            logger.warn('stop generation of preview because no capture has no stdout.');
            return false;
        }
        // inputStream is a readable stream containing the input signal.
        inputStream = captureProc.stdout;
    }


    //
    // OUTPUT
    // ================
    if(  outputIsUrl ){

        outputOptions = modPlayout.ffmpegProcessModel.toJSON();

        if( inputIsUrl ){

            logger.debug('Target is URL and source is URL. Add output to ffmpeg.');

            modEncoder.currentCommand
                .addOutput(
                    modPlayout.settingsModel.get('url')
                )
                .addOutputOptions( modUtil.paramsObjectToArray( outputOptions ) )
                .run();

        } else {

            logger.debug('Target is URL and source is BMD. Pipe BMD to ffmpeg');

            outputOptions = modPlayout.ffmpegProcessModel.toJSON();

            modEncoder.currentCommand
                .addInput( inputStream )
                .addOutput( modPlayout.settingsModel.get('url') )
                .addOutputOptions( modUtil.paramsObjectToArray( outputOptions ) )
                .run();

        }



    } else {


        // Target is BMD. Pipe inputStream to BMD
        logger.debug('Target is BMD. Set bmd stdin as output for encoder.');


        playoutProcess = modPlayout.getBmdPlayProcess();
        // outputStream is a writable stream to pipe the inputStream into.
        outputStream = playoutProcess.stdin;
        outputOptions = modPlayout.ffmpegProcessModel.toJSON();

        logger.debug('Output options:', outputOptions);
        modEncoder.currentCommand
            .addOutput( outputStream )
            .addOutputOptions( modUtil.paramsObjectToArray( outputOptions ) )
            .run();


    }




}

/**
 * [start description]
 * @return {[type]} [description]
 */
Streaming.prototype.stop = function(){

}






module.exports = new Streaming();

