var debug = require('debug')('sat1-node-stream:capture');
var config = require('config');
var winston = require('winston');
var spawn = require('child_process').spawn;
var ffmpeg = require('fluent-ffmpeg');
var ffprobe = ffmpeg.ffprobe;
var Q = require('q');
var Backbone = require('backbone');
var _ = require('lodash');
var models = require('./model');
var PublicDataModel = require('./model').PublicDataModel;
var modBrowser = require('./webserver');
var util = require('./util');

var captureProcess;
var stdErr;

winston.loggers.add('capture', {
    console: {
        timestamp: true,
        colorize: true,
        label: 'Capture / Input'
    }
});
var captureLogger = winston.loggers.get('capture');

var procConfig = _.extend(config.get('capture.proc'), {
    name: 'ffmpeg',
    args: {
        're':   '',
        'i':    'rtmp://stream.sat1bayern.de/vod_special/mp4:news_update.m4v',
        'c:v':  'libx264',
        'vf':   'scale=720x576',
        'c:a':  'pcm_s16le',
        'ar':   '48000',
        'f':    'nut',
        '-':    ''
    }
});


var captureModel = new PublicDataModel({
    name: 'capture',
    running: false,
    command: '',
    isUrl: false,
    config: procConfig,
    ffprobeInfo: {}
});

var captureProcessModel = new models.ProcessModel(procConfig.args);


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


function onSettingsChange(settings){
    // Get Target URL if any.
    if( _.has(settings, 'url') ){
        captureModel.set('isUrl', true);
        captureModel.set('srcUrl', settings.url);
    }
}


function onProcessExit(code, signal) {
    captureModel.set({
        running: false,
        processID: null
    });
    if (code > 0) {
        captureLogger.warn('capture process exited with code > 0: ', {
            'code': code,
            'signal': signal,
            'stdErr': stdErr
        });
    } else {
        captureLogger.info('capture process exited: ', {
            'code': code,
            'signal': signal
        });
    }
    captureLogger.info('onProcessExit', arguments);
    // debug('proc after exit: ', captureProcess);
}

function onProcessError(err) {
    captureModel.set({
        running: false,
        processID: null
    });
    captureLogger.error('capture process | On Error: ', err);
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
    captureLogger.info('onStdOutEnd', arguments);
}

/**
 * capture-stream does not send any more data.
 * @return {[type]} [description]
 */
function onStdOutClose() {
    captureLogger.info('onStdOutClose', arguments);

}

function ffprobeInfo() {
    var deferred = Q.defer();
    ffprobe(captureModel.get('srcUrl'), function(err, data){
        if(err){
            captureLogger.error('ffprobe returned an error.', err);
            return deferred.reject(err);
        }
        captureLogger.info('ffprobe ok');
        captureModel.set({'ffprobeInfo': data});

        return deferred.resolve(data);
    });
    return deferred.promise;
}

/**
 * Spawn capture Process
 * @return child_process Child Process
 */
function startCapture() {

    if (captureModel.get('running') === true) {
        captureLogger.info('There is already a running capture process - pid: ', captureModel.get('processID'));
        return captureProcess;
    }
    // debug('Process before: ', captureProcess);

    var spawnArgs = util.paramsObjectToArray(captureProcessModel.toJSON());

    captureProcess = spawn(procConfig.name, spawnArgs);
    stdErr = '';

    captureModel.set({
        running: true,
        processID: captureProcess.pid
    });

    captureLogger.info('spawned a new capture-process with pid %d - command: %s %s', captureProcess.pid, procConfig.name, spawnArgs.join(' '), JSON.stringify(spawnArgs));

    // debug('Process after: ', captureProcess);
    // captureProcess.stdout.setEncoding('utf8');
    captureProcess.stdout.on('end', onStdOutEnd);
    captureProcess.stdout.on('close', onStdOutClose);

    captureProcess.stderr.setEncoding('utf8');
    captureProcess.stderr.on('data', onStdErrorData);

    captureProcess.on('close', onProcessExit);
    captureProcess.on('exit', onProcessExit);
    captureProcess.on('error', onProcessError);

    return captureProcess;

}


module.exports = {
    startCapture: startCapture,
    ffprobe: ffprobeInfo,
    captureModel: captureModel,
    onSettingsChange: onSettingsChange
};
