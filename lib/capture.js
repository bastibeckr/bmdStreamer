var debug = require('debug')('sat1-node-stream:capture');
var config = require('config');
var winston = require('winston');
var spawn = require('child_process').spawn;
var Backbone = require('backbone');
var _ = require('lodash');

var PublicDataModel = require('./model').publicData;

var captureProcess;

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


function onProcessExit(code, signal) {
    publicData.set({
        running: false,
        processID: null
    });
    debug('onProcessExit', arguments);
    // debug('proc after exit: ', captureProcess);
}

function onProcessError(err) {
    publicData.set({
        running: false,
        processID: null
    });
    debug('onProcessError', err.message);
    // debug('proc after exit: ', captureProcess);
}

function onStdErrorData(err) {
    debug('onStdErrorData', err);
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
        winston.info('won’t start capture because process seems busy - pid: %d', publicData.get('processID'));
        debug('won’t start capture because process seems busy');
        return false;
    }
    // debug('Process before: ', captureProcess);
    captureProcess = spawn(procConfig.name, procConfig.args);
    publicData.set({
        running: true,
        processID: captureProcess.pid
    });
    winston.info('spawned a new capture-process with pid %d', captureProcess.pid);
    debug('Spawned process with ID', captureProcess.pid);
    // debug('Process after: ', captureProcess);
    captureProcess.stdout.on('end', onStdOutEnd);
    captureProcess.stdout.on('close', onStdOutClose);
    // captureProcess.stderr.on('data', function (data) {
    //   // debug('stderr: ' + data);
    // });
    captureProcess.stderr.setEncoding('utf8');
    captureProcess.stderr.on('data', onStdErrorData);

    captureProcess.on('exit', onProcessExit);
    captureProcess.on('error', onProcessError);

    // setTimeout(function(){
    //     captureProcess.stdin.pause();
    //     captureProcess.kill('SIGKILL');
    //     startCapture();
    // }, 1000);

    return captureProcess;

}


module.exports = {
    startCapture: startCapture
}