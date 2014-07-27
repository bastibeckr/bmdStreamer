

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


function makePreview(){
    var captureProc = modCapture.startCapture();
    if( !captureProc.stdout ){
        debug('stop generation of preview because no capture has no stdout.');
        return false;
    }
    var previewEnc  = modEncoder.encodePreview( captureProc.stdout );
    previewEnc
    .on('start', function(commandLine) {
        debug('Spawned Ffmpeg with command: ' + commandLine);
    })
    .on('end', function(){
        fs.readFile('screenshot.png', function(err, buffer){
            var socketEventName = 'preview-img';
            var base64Image = new Buffer(buffer, 'binary').toString('base64');

            modBrowser.events.emit('app-to-browser', socketEventName, { base64: 'data:image/png;base64,'+base64Image });
        });
        debug('Finished preview');
        captureProc.kill('SIGKILL');
    }).on('error', function(){
        debug('Preview error', arguments);
        captureProc.kill('SIGKILL');
    }).run();
};

modBrowser.events.on('browser-to-app', function(data){
    debug('APP received web-control - event', data);
    makePreview();
});


// encodeCmd.on('progress', function(prog){
//     debug('Progress', prog.timemark);
// })
// .on('end', function(){
//     debug('Finished processing');
//     captureProc.kill('SIGKILL');
// })
// .run();



module.exports = function () {

};
