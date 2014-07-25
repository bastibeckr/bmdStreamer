var debug = require('debug')('capture');
var config = require('config');
var spawn = require('child_process').spawn;
var _ = require('lodash');

var captureProcess;

var procConfig = _.extend(  config.get('capture.proc'), {
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

function onProcessExit(code, signal ){
    debug('onProcessExit', arguments);
    // debug('proc after exit: ', captureProcess);
}

function onStdErrorData(){
    debug('onStdOutEnd', arguments);
}

/**
 * capture-stream does not send any more data.
 * @return {[type]} [description]
 */
function onStdOutEnd(){
    debug('onStdOutEnd', arguments);
}

/**
 * Spawn capture Process
 * @return child_process Child Process
 */
function startCapture(){
    // debug('Process before: ', captureProcess);
    captureProcess = spawn( procConfig.name, procConfig.args );
    debug('Spawned process with ID', captureProcess.pid);
    // debug('Process after: ', captureProcess);
    captureProcess.stdout.on('end', onStdOutEnd);
    captureProcess.stderr.on('data', function (data) {
      debug('stderr: ' + data);
    });
    captureProcess.on('exit', onProcessExit);

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
