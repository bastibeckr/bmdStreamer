var EventEmitter        = require('events').EventEmitter;
var util                = require('util');

var debug               = require('debug')('sat1-node-stream:capture');
var config              = require('config');
var winston             = require('winston');
var spawn               = require('child_process').spawn;
var ffmpeg              = require('fluent-ffmpeg');
var ffprobe             = ffmpeg.ffprobe;
var Q                   = require('q');
var Backbone            = require('backbone');
var _                   = require('lodash');

var models              = require('./model');
var PublicDataModel     = models.PublicDataModel;
var modBrowser          = require('./webserver');
var modUtil             = require('./util');
var modSettings         = require('./settings');


var logger = modUtil.getLogger('capture', { label: 'Capture / Input' });


/**
 * [Capture description]
 */
function Capture(){

    EventEmitter.call( this );

    logger.info('Capture constructor');

    this.captureProcess = null;
    this.stdErr             = '';

    this.procConfig = config.get('capture.proc');


    this.captureModel = new PublicDataModel({
        name: 'capture',
        running: false,
        command: '',
        isUrl: false,
        config: this.procConfig,
        ffprobeInfo: {}
    });

    this.settingsModel = modSettings.getSettings('capture', {
        device: 'url',
        url: 'rtmp://stream.sat1bayern.de/live/mp4:Sat1Schedule_01'
    });

    this.captureProcessModel = new models.ProcessModel( this.procConfig.args );


}

util.inherits(Capture, EventEmitter);


Capture.prototype.onSettingsChange    = onSettingsChange;
Capture.prototype.startCapture        = startCapture;
Capture.prototype.ffprobe             = ffprobeInfo;

module.exports = new Capture();


// /**
//  * [logOverride description]
//  * @return {[type]} [description]
//  */
//  function logOverride(){
//      var self = this;
//      var args = Array.prototype.slice.call(arguments);
//      modBrowser.sendData(args[0], 'log');
//      return console.log.apply(self, args);
//  }

// debug.log = logOverride.bind(console);

/**
 * [onSettingsChange description]
 * @param  {[type]} settings [description]
 * @return {[type]}          [description]
 */
function onSettingsChange( settings ){
    // Get Target URL if any.
    logger.debug('onSettingsChange', settings);
    this.settingsModel.set(settings);
    if( _.has(settings, 'url') ){
        this.captureModel.set('isUrl', true);
        this.captureModel.set('srcUrl', settings.url);
    } else {
        this.captureModel.set('isUrl', false);
    }
}

/**
 * [onProcessExit description]
 * @param  {[type]} code   [description]
 * @param  {[type]} signal [description]
 * @return {[type]}        [description]
 */
function onProcessExit(code, signal) {
    this.captureModel.set({
        running: false,
        processID: null
    });
    if (code > 0) {
        logger.warn('capture process exited with code > 0: ', {
            'code': code,
            'signal': signal,
            'stdErr': this.stdErr
        });
    } else {
        logger.debug('capture process exited: ', {
            'code': code,
            'signal': signal
        });
    }
    logger.debug('onProcessExit', arguments);
    // debug('proc after exit: ', captureProcess);
}

/**
 * [onProcessError description]
 * @param  {[type]} err [description]
 * @return {[type]}     [description]
 */
function onProcessError(err) {
    this.captureModel.set({
        running: false,
        processID: null
    });
    logger.error('capture process | On Error: ', err);
    // debug('proc after exit: ', captureProcess);
}

/**
 * [onStdErrorData description]
 * @param  {[type]} err [description]
 * @return {[type]}     [description]
 */
function onStdErrorData(err) {
    this.stdErr += err;
    // winston.info('capture process | STDERR: ');
}

/**
 * capture-stream does not send any more data.
 * @return {[type]} [description]
 */
function onStdOutEnd() {
    logger.debug('onStdOutEnd', arguments);
}

/**
 * capture-stream does not send any more data.
 * @return {[type]} [description]
 */
function onStdOutClose() {
    logger.debug('onStdOutClose', arguments);
}

/**
 * [ffprobeInfo description]
 * @param  {[type]} input [description]
 * @return {[type]}       [description]
 */
function ffprobeInfo( input ) {
    var self = this;
    var deferred = Q.defer();
    ffprobe( self.settingsModel.get('url') , function(err, data){
        if( !_.isEmpty( err ) ){
            logger.error( 'ffprobe returned an error.', JSON.stringify(err) );
            return deferred.reject(err);
        }
        logger.debug( 'ffprobe ok' );
        self.captureModel.set( { 'ffprobeInfo': data } );
        return deferred.resolve(data);
    });
    return deferred.promise;
}

/**
 * Spawn capture Process
 * @return child_process Child Process
 */
function startCapture() {

    var self = this;
    if ( self.captureModel.get('running') === true ) {
        logger.debug('There is already a running capture process - pid: ', self.captureModel.get('processID'));
        return self.captureProcess;
    }
    // debug('Process before: ', captureProcess);

    var spawnArgs = modUtil.paramsObjectToArray( self.captureProcessModel.toJSON() );

    self.captureProcess = spawn( self.procConfig.name, spawnArgs );
    self.stdErr = '';

    self.captureModel.set({
        running: true,
        processID: self.captureProcess.pid
    });

    logger.debug('spawned a new capture-process with pid %d - command: %s %s', self.captureProcess.pid, self.procConfig.name, spawnArgs.join(' '), JSON.stringify(spawnArgs));

    // debug('Process after: ', captureProcess);
    // captureProcess.stdout.setEncoding('utf8');
    self.captureProcess.stdout.on('end', onStdOutEnd.bind(self));
    self.captureProcess.stdout.on('close', onStdOutClose.bind(self));

    self.captureProcess.stderr.setEncoding('utf8');
    self.captureProcess.stderr.on('data', onStdErrorData.bind(self));

    self.captureProcess.on('close', onProcessExit.bind(self));
    self.captureProcess.on('exit',  onProcessExit.bind(self));
    self.captureProcess.on('error', onProcessError.bind(self));

    return self.captureProcess;

}



