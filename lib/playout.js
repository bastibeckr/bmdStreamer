/**
 * Playout Module (for BMDPLAY)
 *
 * Handles streaming video into bmdplay command,
 * ensuring the video has the right format.
 */

var debugMod = require('debug');
var debug = debugMod('sat1-node-stream:playout');
var config = require('config');
var winston = require('winston');
var config = require('config');
var ffmpeg = require('fluent-ffmpeg');
var Q = require('q');
var spawn = require('child_process').spawn;
var _ = require('lodash');
var ansi_up = require('ansi_up');

var models = require('./model');
var util = require('./util');

winston.loggers.add('playout', {
    console: {
        timestamp: true,
        colorize: true,
        label: 'Playout / Output'
    }
});
var playoutLogger = winston.loggers.get('playout');

var stdErr;

var devicesCollection = new models.DeviceCollection();

var playoutModel = new models.PublicDataModel({
    'name': 'playout',
    'running': false,
    'processID': null,
});

var currentCommand;

var settings = config.get('playout');

var settingsModel = new models.SettingsModel();
var bmdProcessModel = new models.ProcessModel(config.get('playout.bmdplay'));
var ffmpegProcessModel = new models.ProcessModel(config.get('playout.ffmpeg.toBmdPlay'));

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



updateDevices();



/**
 * Parse settings changed in web frontend and update settings model.
 *
 * @param  {[type]} settings [description]
 * @return {[type]}          [description]
 */
function onSettingsChange( settings ){

    settingsModel.set(settings);
    return generateParams();
}

function generateParams(){
    var device,
        url,
        format;
    var params = {
        ffmpeg: [],
        bmdplay: []
    };

    var settings = settingsModel;

    playoutLogger.debug('Generate Parameters', settings);
    // Get device ID.
    // If user selected a URL, this property is set to 'url'
    if( settingsModel.has('device') ){
        if( settingsModel.get('device') === 'url' ){
            playoutModel.set('isBmdPlay', false);

        } else if( parseInt(settingsModel.get('device'), 10) >= 0 ){

            playoutModel.set('isBmdPlay', true);
            device = devicesCollection.findWhere({
                index: settingsModel.get('device')
            });

            params.bmdplay.push({C: device.get('index')});

        }
    }

    // Get Target URL if any.
    if( settingsModel.has('url') ){
        url = settingsModel.get('url');
    }

    if( settingsModel.has('format') &&  _.contains( _.methods(device), 'getFormats') ){

        var formats = device.getFormats();
        format = formats.findWhere({
            slug: settingsModel.get('format')
        });

        params.bmdplay.push({ m: format.get('index') });
        params.ffmpeg.push({ vf: 'scale=' + format.get('width') + 'x' + format.get('height') });
        params.ffmpeg.push({ r: format.get('fps') });

        playoutLogger.info('playout.onSettingsChange | got a format?', format.toJSON());
    }

    params.ffmpeg = util.paramsArrayToObject(params.ffmpeg);
    ffmpegProcessModel.set(params.ffmpeg);

    params.bmdplay = util.paramsArrayToObject(params.bmdplay);
    bmdProcessModel.set(params.bmdplay);

    playoutLogger.info('params:', JSON.stringify(params));

    // var ffmpegCommand = buildCmd(params.ffmpeg, 'ffmpeg ');
    // var bmdCommand = buildCmd(params.bmdplay, 'bmdCommand ');
    return params;
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
                slug:  m[2].replace(/[^a-z0-9]+/gi, '-').replace(/^-*|-*$/g, '').toLowerCase(),
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
    var parts = text.split(splitRegex);
    parts.shift();

    do {
        m = regex.exec(text);
        if (m) {

            output.push({
                name: m[1],
                slug:  m[1].replace(/[^a-z0-9]+/gi, '-').replace(/^-*|-*$/g, '').toLowerCase(),
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

    proc = spawn(cmd);
    proc.stdout.setEncoding('ascii');
    proc.stdout.on('data', function(data){
        procData += '' + data;
    });

    proc.on('close', function(code){
        playoutLogger.info('BMD Play exited with code ' + code);
        var devices = parseBmdPlayDevices( procData );

        if( !_.isArray(devices) || _.isEmpty(devices) ){
            playoutLogger.warn('BMD Play found 0 devices! \n', devices);
            deferred.reject('BMD Play found 0 devices.');
        } else {
            playoutLogger.info('BMD Play found ' + devices.length + ' devices.');
            deferred.resolve(devices);
        }

    });
    return deferred.promise;
}


function updateDevices(){
    return getBmdPlayFormats().then(
        function(devices){
            devicesCollection.reset(devices);
        },
        function(){
            playoutLogger.warn('No devices were found.');
        })
    .done();
}


function onProcessError(err) {
    playoutModel.set({
        running: false,
        processID: null
    });
    playoutLogger.error('playout process | On Error: ', err);
    // debug('proc after exit: ', captureProcess);
}

function onStdErrorData(err) {
    stdErr += err;
    // winston.info('capture process | STDERR: ');
}

/**
 * capture-stream does not send any more data.
 * @return {[type]} [description]
 */
function onStdOutEnd() {
    playoutLogger.info('onStdOutEnd', arguments);
}

function onProcessExit(code, signal) {
    playoutModel.set({
        running: false,
        processID: null
    });
    if (code > 0) {
        playoutLogger.warn('capture process exited with code > 0: ', {
            'code': code,
            'signal': signal,
            'stdErr': stdErr
        });
    } else {
        playoutLogger.info('capture process exited: ', {
            'code': code,
            'signal': signal
        });
    }
    captureLogger.info('onProcessExit', arguments);
    // debug('proc after exit: ', captureProcess);
}


function getBmdPlayProcess(){
    var bmdOptions = bmdProcessModel.toJSON();
    var spawnArgs = util.paramsObjectToArray(bmdOptions);
    debug('Spawn Arguments:', spawnArgs);


    var playoutProcess = spawn('bmdplay', spawnArgs);

    playoutProcess.

    playoutModel.set({
        'running': true,
        'processID': playoutProcess.pid
    });

    playoutProcess.stdout.on('data', function(data){
        // debug('Captureprocess On Data');
    });
    playoutProcess.stdout.on('end', onStdOutEnd);
    playoutProcess.stdout.on('close', onStdOutClose);

    playoutProcess.stderr.setEncoding('utf8');
    playoutProcess.stderr.on('data', onStdErrorData);

    playoutProcess.on('close', onProcessExit);
    playoutProcess.on('exit', onProcessExit);
    playoutProcess.on('error', onProcessError);


    return playoutProcess;
}



module.exports = {
    updateDevices: updateDevices,
    onSettingsChange: onSettingsChange,
    getParams: generateParams,
    playoutModel: playoutModel,
    settingsModel: settingsModel,
    getBmdPlayProcess: getBmdPlayProcess,
    ffmpegProcessModel: ffmpegProcessModel
};

