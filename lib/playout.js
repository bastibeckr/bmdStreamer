/**
 * Playout Module (for BMDPLAY)
 *
 * Handles streaming video into bmdplay command,
 * ensuring the video has the right format.
 */

var spawn           = require('child_process').spawn;
var EventEmitter    = require('events').EventEmitter;
var util            = require('util');

var debug           = require('debug')('sat1-node-stream:playout');
var config          = require('config');
var winston         = require('winston');
var ffmpeg          = require('fluent-ffmpeg');
var Q               = require('q');
var _               = require('lodash');
var ansi_up         = require('ansi_up');

var models          = require('./model');
var modUtil         = require('./util');
var modSettings     = require('./settings');

var logger          = modUtil.getLogger('playout', { label: 'Playout / Output' });



function Playout(){

    EventEmitter.call( this );

    logger.info('Playout constructor');

    this.currentCommand = null;

    this.playoutProcess = null;

    this.playoutModel = new models.PublicDataModel({
        'name':             'playout',
        'running':          false,
        'processID':        null,
        'isBmdPlay':        false,
        'isUrl':            false,
        'ffmpegCommand':    '',
        'bmdPlayCommand':   ''
    });

    this.presetCollection = new models.PresetCollection();
    this.presetCollection.reset( config.get('streamFormats') );

    this.stdErr             = '';

    this.settingsModel      = modSettings.getSettings('playout');
    this.devicesCollection  = new models.DeviceCollection();
    this.bmdProcessModel    = new models.ProcessModel();
    this.ffmpegProcessModel = new models.ProcessModel();



    this.updateDevices();
    this.generateParams();

}

util.inherits( Playout, EventEmitter );

/**
 * Parse settings changed in web frontend and update settings model.
 *
 * @param  {[type]} settings [description]
 * @return {[type]}          [description]
 */
Playout.prototype.onSettingsChange = function( settings ){
    this.settingsModel.set(settings);
    return this.generateParams();
}


/**
 * Generate FFMPEG / BMDPLAY - options from user-settings
 * @return {[type]} [description]
 */
Playout.prototype.generateParams = function(){
    var self = this,
        device,
        url,
        format,
        params = {
        ffmpeg: [],
        bmdplay: []
    };


    logger.debug('Generate Parameters', self.settingsModel.toJSON());

    // Get device ID.
    // If user selected a URL, this property is set to 'url'
    if( self.settingsModel.has('device') ){
        if( self.settingsModel.get('device') === 'url' ){

            var urlPresetData = {};

            if( self.settingsModel.has('urlPreset')){
                var presetId = self.settingsModel.get('urlPreset');
                var urlPreset = self.presetCollection.get( presetId );
                if( urlPreset ) {
                    urlPresetData = urlPreset.getArgs().toJSON()
                };
            }

            urlParams = _.extend(
                config.get('playout.ffmpeg.toUrl'),
                urlPresetData
            );

            self.ffmpegProcessModel
                .clear()
                .set( urlParams );

            self.playoutModel.set({
                isUrl: true,
                isBmdPlay: false
            });

        } else if( parseInt( self.settingsModel.get('device'), 10 ) >= 0 ){

            self.playoutModel.set({
                isUrl: false,
                isBmdPlay: true
            });

            self.bmdProcessModel
                .clear()
                .set(config.get('playout.bmdplay'));

            self.ffmpegProcessModel
                .clear()
                .set( config.get('playout.ffmpeg.toBmdPlay') );

            device = self.devicesCollection.findWhere({
                index: self.settingsModel.get('device')
            });

            if( device instanceof models.DeviceModel ){
                params.bmdplay.push({C: device.get('index')});
            } else {
                logger.warn('No device found!');
            }


            if( self.settingsModel.has('format') && device instanceof models.DeviceModel  ){
                var formats = device.getFormats();
                format = formats.findWhere({
                    slug: self.settingsModel.get('format')
                });
                if( format ){
                    params.bmdplay.push({ m: format.get('index') });
                    params.ffmpeg.push({ vf: 'scale=' + format.get('width') + 'x' + format.get('height') });
                    params.ffmpeg.push({ r: format.get('fps') });
                    logger.debug('playout.onSettingsChange | got a format', format.toJSON());
                } else {
                    logger.warn('playout.onSettingsChange | no format found for slug "%s"', self.settingsModel.get('format'));
                }

            }

        }
    }

    params.ffmpeg = modUtil.paramsArrayToObject( params.ffmpeg );
    self.ffmpegProcessModel.set( params.ffmpeg );

    params.bmdplay = modUtil.paramsArrayToObject(params.bmdplay);
    self.bmdProcessModel.set( params.bmdplay );

    self.playoutModel.set({
        ffmpegCommand: 'ffmpeg ' + self.ffmpegProcessModel.toParams().join(' '),
        bmdPlayCommand: 'bmdplay ' + self.bmdProcessModel.toParams().join(' ')
    });

    // var ffmpegCommand = buildCmd(params.ffmpeg, 'ffmpeg ');
    // var bmdCommand = buildCmd(params.bmdplay, 'bmdCommand ');
    return params;
}


/**
 * [updateDevices description]
 * @return {[type]} [description]
 */
Playout.prototype.updateDevices = function(){
    var self = this;
    return getBmdPlayFormats().then(
        function( devices ){
            self.devicesCollection.reset( devices );
        },
        function(){
            logger.warn( 'No devices were found.' );
        })
    .done();
}


/**
 * [getBmdPlayProcess description]
 * @return {[type]} [description]
 */
Playout.prototype.getBmdPlayProcess = function(){

    var bmdOptions = this.bmdProcessModel.toJSON();
    var spawnArgs = modUtil.paramsObjectToArray( bmdOptions );

    logger.info( 'will spawn new bmdplay process: "bmdplay %s"', spawnArgs.join(' ') );

    var playoutProcess = this.playoutProcess = spawn( 'bmdplay', spawnArgs );

    this.playoutModel.set({
        'running': true,
        'processID': playoutProcess.pid
    });

    this.stdErr = '';

    playoutProcess.stderr.setEncoding('utf8');

    playoutProcess.stdout.on('end',     onStdOutEnd.bind(this));
    playoutProcess.stdout.on('close',   onStdOutClose.bind(this));
    playoutProcess.stderr.on('data',    onStdErrorData.bind(this));

    playoutProcess.on('close',  onProcessExit.bind(this));
    playoutProcess.on('exit',   onProcessExit.bind(this));
    playoutProcess.on('error',  onProcessError.bind(this));


    return playoutProcess;
}



Playout.prototype.stopProcess = function(){
    var deferred = Q.defer();

    if( this.playoutProcess ){
        logger.debug('stopProcess called.', JSON.stringify(this.playoutProcess.listeners('exit')));
        this.playoutProcess.removeListener('error', onProcessExit);
        this.playoutProcess.once('exit', function(){
            return deferred.resolve();
        });
        this.playoutProcess.kill();
    }

    return deferred.promise;
}



/**
 * Parse BMD Play Output to get list of output formats
 * Regex should match:
 *
 *     Supported video output display modes and pixel formats:
 *        0:   NTSC                   720 x 486     29.97 FPS
 *        1:   NTSC 23.98             720 x 486    23.976 FPS
 *        2:   PAL                    720 x 576        25 FPS
 *        3:   NTSC Progressive       720 x 486   59.9401 FPS
 *        4:   PAL Progressive        720 x 576        50 FPS
 *
 *
 * @param  {[type]} lines [description]
 * @return {[type]}       [description]
 */
function parseBmdPlayOutput(text){
    var regex = /(?:\s+)?(?:(\d+):)(?:\s{2,})((?:(?:\S+|\s)(?!\s{2,})\S+)+)(?:\s+)(?:(\d+)\sx\s(\d+))(?:\s+)(?:((?:\d+|\.)+)\sFPS)/gm;
    var output = [];
    do {
        m = regex.exec(text);
        if (m) {
            output.push({
                index: parseInt(m[1], 10),
                name: m[2],
                slug:  m[2].replace(/[^a-z0-9]+/gi, '_').replace(/^-*|-*$/g, '').toLowerCase(),
                width: parseInt(m[3], 10),
                height: parseInt(m[4], 10),
                fps: parseFloat(m[5])
            });
        }
    } while (m);

    return output;
}

/**
 * Parse BMD Play Output to get list of output devices
 * Regex should match:
 *
 *  -> UltraStudio Mini Monitor (-C 0 )
 *
 *
 * @param  {[type]} lines [description]
 * @return {[type]}       [description]
 */
function parseBmdPlayDevices(text){
    var regex = /\s?->\s([^\(]+)\s(?:\(-C\s(\d)\s\))/gm;
    var splitRegex = /\s?->\s(?:[^\(]+)\s(?:\(-C\s(?:\d)\s\))/gm;
    var output = [];
    var devices = [];

    if( !regex.test(text) ){
        return false;
    }

    regex.lastIndex = 0;
    var parts = text.split( splitRegex );
    parts.shift();

    do {
        m = regex.exec(text);
        if (m) {

            output.push({
                name: m[1],
                slug:  m[1].replace(/[^a-z0-9]+/gi, '_').replace(/^-*|-*$/g, '').toLowerCase(),
                index: parseInt(m[2], 10)
            });
        }
    } while (m);

    parts.forEach( function(part, index){
        if(typeof(output[index]) !== 'undefined'){
            output[index].formats = parseBmdPlayOutput(part);
        }
    });

    return output;
}

/**
 * [getBmdPlayDevices description]
 * @return {[type]} [description]
 */
function getBmdPlayFormats(){
    var procData = '';
    var cmd = 'bmdplay';
    var deferred = Q.defer();
    var self = this;

    proc = spawn( cmd );
    proc.stdout.setEncoding('ascii');
    proc.stdout.on('data', function(data){
        procData += '' + data;
    });
    proc.on('close', function(code){
        logger.debug('BMD Play exited with code ' + code);
        var devices = parseBmdPlayDevices( procData );

        if( !_.isArray( devices ) || _.isEmpty( devices ) ){
            logger.warn('BMD Play found 0 devices! \n', devices);
            deferred.reject('BMD Play found 0 devices.');
        } else {
            logger.info('BMD Play found %d devices.', devices.length);
            deferred.resolve(devices);
        }

    });
    return deferred.promise;
}


/**
 * [onProcessError description]
 * @param  {[type]} err [description]
 * @return {[type]}     [description]
 */
function onProcessError(err) {
    this.playoutModel.set({
        running: false,
        processID: null
    });
    this.playoutProcess = null;
    logger.error('playout process | On Error: ', err);
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
 * [onProcessExit description]
 * @param  {[type]} code   [description]
 * @param  {[type]} signal [description]
 * @return {[type]}        [description]
 */
function onProcessExit(code, signal) {
    this.playoutModel.set({
        running: false,
        processID: null
    });
    this.playoutProcess = null;
    if (code > 0) {
        logger.warn('process exited with code > 0: ', {
            'code': code,
            'signal': signal,
            'stdErr': this.stdErr
        });
    } else {
        logger.debug('process exited: ', {
            'code': code,
            'signal': signal
        });
    }
    logger.debug('onProcessExit', arguments);
    // debug('proc after exit: ', captureProcess);
}

module.exports = new Playout();


// module.exports = {
//     updateDevices: updateDevices,
//     onSettingsChange: onSettingsChange,
//     getParams: generateParams,
//     playoutModel: playoutModel,
//     settingsModel: settingsModel,
//     getBmdPlayProcess: getBmdPlayProcess,
//     ffmpegProcessModel: ffmpegProcessModel
// };

