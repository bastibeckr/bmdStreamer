var debug = require('debug')('mainapp');
var EventEmitter = require("events").EventEmitter;
var fs = require('fs');
var ffmpeg = require('fluent-ffmpeg');
var _ = require('lodash');


var config = require('config');

var modCapture = require('./lib/capture');
var modEncoder = require('./lib/encode');
var modBrowser = require('./lib/browser');

modBrowser.start();

function makePreview() {
    var captureProc = modCapture.startCapture();
    if (!captureProc.stdout) {
        debug('stop generation of preview because no capture has no stdout.');
        return false;
    }
    modEncoder.encodePreview(captureProc).then(
        function(data) {
            debug('preview encoder: on success');
            fs.readFile('screenshot.png', function(err, buffer) {
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
            console.log('There was an error while encoding the preview!', err);
            captureProc.kill('SIGKILL');
        }
    ).done();

};


function startStreaming() {
    if (modEncoder.publicData.get('running')) {
        debug('IS RUNNING!', modEncoder);
        modEncoder.stopEncoding();
        return false;
    }
    var captureProc = modCapture.startCapture();
    if (!captureProc.stdout) {
        debug('stop generation of preview because no capture has no stdout.');
        return false;
    }
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

modBrowser.events.on('browser-to-app', function(data) {
    debug('APP received web-control - event', data);
    switch (data.action) {
        case 'preview':
            makePreview();
            break;
        case 'streaming':
            startStreaming();
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