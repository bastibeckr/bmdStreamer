var modIntercept = require('./streamtest');
var throughStream = modIntercept.intercept();


var debug = require('debug')('sat1-node-stream:mainapp');
var EventEmitter = require("events").EventEmitter;
var winston = require('winston');
var fs = require('fs');
var ffmpeg = require('fluent-ffmpeg');
var _ = require('lodash');
var Q = require('q');
var spawn = require('child_process').spawn;

var config = require('config');



var modCapture = require('./lib/capture');
var modEncoder = require('./lib/encode');
var modBrowser = require('./lib/webserver');
var modPlayout = require('./lib/playout');
var util       = require('./lib/util');

modBrowser.start(throughStream);



function onSettingsChange(settings){
    debug('On Settings Change', settings);
    if( _.has(settings, 'playout')){
        modPlayout.onSettingsChange(settings.playout);
    }
    if( _.has(settings, 'capture')){
        modCapture.onSettingsChange(settings.capture);
    }
}

function makePreview() {

    var captureProc = modCapture.startCapture();

    if (!captureProc.stdout) {
        debug('stop generation of preview because no capture has no stdout.');
        return false;
    }

    modCapture.ffprobe();

    modEncoder.encodePreview(captureProc).then(
        function(data) {
            debug('preview encoder: on success');
            fs.readFile('screenshot-2.png', function(err, buffer) {
                var socketEventName = 'preview-img';
                var base64Image = new Buffer(buffer, 'binary').toString('base64');
                // modBrowser.events.emit('app-to-browser', 'preview-img', { image: true, buffer: buffer });
                modBrowser.events.emit('app-to-browser', socketEventName, {
                    base64: 'data:image/png;base64,' + base64Image
                });
            });
            captureProc.kill('SIGKILL');
        },
        function(err) {
            debug('preview encoder: on error');
            captureProc.kill('SIGKILL');
        }
    ).done();

}


function startStreaming() {

    var baseCommand, deferred, outputOptions, isUrl, isBmdPlay, bmdOptions, spawnArgs, playoutProcess, captureProc;

    if (modEncoder.publicData.get('running')) {
        debug('Will stop encoder now because Encoder is already running.');
        modEncoder.stopEncoding();
        return false;
    }

    var isUrl = modCapture.captureModel.get('isUrl');

    // Source is URL.
    // No separate Capture process needed.
    // FFMPEG can grab the URL and pipe it.
    if( isUrl ){
        debug('Start streaming: Source is URL.');

        deferred = Q.defer();
        baseCommand = modEncoder.getBaseCommand(deferred);
        outputOptions = modPlayout.ffmpegProcessModel.toJSON();
        debug('Output options:', outputOptions);
        baseCommand
            .addInput(modCapture.captureModel.get('srcUrl'))
            .addInputOptions('-re')
            .addOutputOptions( util.paramsObjectToArray(outputOptions) );


    } else {
        captureProc = modCapture.startCapture();
        if (!captureProc.stdout) {
            debug('stop generation of preview because no capture has no stdout.');
            return false;
        }
    }

    isBmdPlay = modPlayout.playoutModel.get('isBmdPlay');

    if(  isBmdPlay ){

        debug('Start streaming: Target is BMD.');
        playoutProcess = modPlayout.getBmdPlayProcess();

        baseCommand.pipe(playoutProcess.stdin);


    } else {

        modEncoder.startEncoding(captureProc).then(
            function(data) {
                debug('streaming encoder: on success');
                captureProc.kill('SIGKILL');
            },
            function(err) {
                debug('streaming encoder: on error', err);
                captureProc.kill('SIGKILL');
            }
        ).done();

    }


}

modBrowser.events.on('browser-to-app', function(data) {
    debug('APP received web-control - event', data);
    switch (data.action) {
        case 'preview':
            makePreview();
            break;
        case 'streaming':
            startStreaming();
            break;
        case 'settings-change':
            onSettingsChange(data.settings);
            break;
    }
});




// encodeCmd.on('progress', function(prog){
//     debug('Progress', prog.timemark);
// })
// .on('end', function(){
//     debug('Finished processing');
//     captureProc.kill('SIGKILL');
// })
// .run();



module.exports = function() {

};
