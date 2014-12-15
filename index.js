var modIntercept = require('./lib/intercept-stdout');
var throughStream = modIntercept();


var debug = require('debug')('sat1-node-stream:mainapp');
var EventEmitter = require('events').EventEmitter;
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
var modSettings = require('./lib/settings');

modBrowser.start(throughStream);


var logger = util.getLogger('settings', { label: 'Main' });


modSettings.loadSettings('datei').then(function(data){
    onSettingsChange(data);
});

modSettings.listSettingsFiles();

// modSettings.saveSettings('datei');

function onSettingsChange(settings){
    logger.debug('On Settings Change', settings);
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
        logger.debug('stop generation of preview because no capture has no stdout.');
        return false;
    }

    modCapture.ffprobe();

    modEncoder.encodePreview(captureProc).then(
        function(data) {
            logger.debug('preview encoder: on success');
            fs.readFile('screenshot-2.png', function(err, buffer) {
                var socketEventName = 'preview-img';
                var base64Image = new Buffer(buffer, 'binary').toString('base64');
                // modBrowser.events.emit('app-to-browser', 'preview-img', { image: true, buffer: buffer });
                modBrowser.emit('app-to-browser', socketEventName, {
                    base64: 'data:image/png;base64,' + base64Image
                });
            });
            captureProc.kill('SIGKILL');
        },
        function(err) {
            logger.error('preview encoder: on error');
            captureProc.kill('SIGKILL');
        }
    ).done();

}



function startStreaming() {

    var baseCommand, deferred, outputOptions, isUrl, isBmdPlay, bmdOptions, spawnArgs, playoutProcess, captureProc;

    if (modEncoder.publicData.get('running')) {
        logger.info('Will stop encoder now because Encoder is already running.');
        modEncoder.stopEncoding();
        return false;
    }

    isUrl = modCapture.captureModel.get('isUrl');

    // Source is URL.
    // No separate Capture process needed.
    // FFMPEG can grab the URL and pipe it.
    if( isUrl ){
        logger.info('Start streaming: Source is URL.');

        deferred = Q.defer();
        baseCommand = modEncoder.getBaseCommand(deferred);
        outputOptions = modPlayout.ffmpegProcessModel.toJSON();
        debug('Output options:', outputOptions);
        baseCommand
            .addInput(modCapture.captureModel.get('srcUrl'))
            .addInputOptions(['-re'])
            .addOutputOptions( util.paramsObjectToArray(outputOptions) );


    } else {
        captureProc = modCapture.startCapture();
        if (!captureProc.stdout) {
            logger.warn('stop generation of preview because no capture has no stdout.');
            return false;
        }
    }

    isBmdPlay = modPlayout.playoutModel.get('isBmdPlay');

    if(  isBmdPlay ){

        logger.info('Start streaming: Target is BMD.');
        playoutProcess = modPlayout.getBmdPlayProcess();

        var ffstream = baseCommand.pipe();



        ffstream.on('data', function(chunk){
            playoutProcess.stdin.write(chunk);
        });




    } else {

        modEncoder.startEncoding(captureProc).then(
            function(data) {
                logger.info('streaming encoder: on success');
                captureProc.kill('SIGKILL');
            },
            function(err) {
                logger.error('streaming encoder: on error', err);
                if( captureProc && captureProc.kill ){
                    captureProc.kill('SIGKILL');
                }

            }
        ).done();

    }


}

modBrowser.on('browser-to-app', function(data) {
    logger.debug('APP received web-control - event', data);
    switch (data.action) {
        case 'preview':
            makePreview();
            break;
        case 'streaming':
            startStreaming();
            break;
        case 'settings-save':
            modSettings.saveSettings('datei');
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
