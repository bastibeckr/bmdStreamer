var debug = require('debug')('sat1-node-stream:capture');
var config = require('config');
var winston = require('winston');
var spawn = require('child_process').spawn;
var Backbone = require('backbone');
var _ = require('lodash');

var PublicDataModel = require('./model').PublicData;
var modBrowser = require('./webserver');

var captureProcess;
var stdErr;

var procConfig = _.extend(config.get('capture.proc'), {
    name: 'ffmpeg',
    args: [
        '-re',
        '-i', 'rtmp://stream.sat1bayern.de/vod_special/mp4:news_update.m4v',
        '-c:v', 'libx264',
        '-vf', 'scale=720x576',
        '-c:a', 'pcm_s16le',
        '-ar', '48000',
        '-f', 'nut',
        '-'
    ]
});

var publicData = new PublicDataModel({
    name: 'capture',
    running: false,
    command: '',
    config: procConfig
});



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



function onProcessExit(code, signal) {
    publicData.set({
        running: false,
        processID: null
    });
    if (code > 0) {
        winston.warn('capture process exited with code > 0: ', {
            'code': code,
            'signal': signal,
            'stdErr': stdErr
        });
    } else {
        winston.info('capture process exited: ', {
            'code': code,
            'signal': signal
        });
    }
    debug('onProcessExit', arguments);
    // debug('proc after exit: ', captureProcess);
}

function onProcessError(err) {
    publicData.set({
        running: false,
        processID: null
    });
    winston.info('capture process | On Error: ', err);
    debug('onProcessError', err.message);
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
    debug('onStdOutEnd', arguments);
}

/**
 * capture-stream does not send any more data.
 * @return {[type]} [description]
 */
function onStdOutClose() {
    debug('onStdOutClose', arguments);
}


/**
 * Spawn capture Process
 * @return child_process Child Process
 */
function startCapture() {
    if (publicData.get('running') === true) {
        winston.info('There is already a running capture process - pid: %d', publicData.get('processID'));
        debug('There is already a running capture process - pid: ', publicData.get('processID'));
        return captureProcess;
    }
    // debug('Process before: ', captureProcess);

    captureProcess = spawn(procConfig.name, procConfig.args);
    stdErr = '';

    publicData.set({
        running: true,
        processID: captureProcess.pid
    });

    winston.info('spawned a new capture-process with pid %d - command: %s %s', captureProcess.pid, procConfig.name, procConfig.args.join(' '));

    debug('spawned a new capture-process with pid', captureProcess.pid);
    // debug('Process after: ', captureProcess);
    captureProcess.stdout.on('end', onStdOutEnd);
    captureProcess.stdout.on('close', onStdOutClose);

    captureProcess.stderr.setEncoding('utf8');
    captureProcess.stderr.on('data', onStdErrorData);

    captureProcess.on('exit', onProcessExit);
    captureProcess.on('error', onProcessError);

    return captureProcess;

}


module.exports = {
    startCapture: startCapture
}