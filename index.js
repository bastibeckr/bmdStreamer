
var debug = require('debug')('encoder');
var config = require('config');
var express = require('express');
var ffmpeg = require('fluent-ffmpeg');



var app = express();
var modCapture = require('./lib/capture');
var modEncoder = require('./lib/encode');


app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res) {
  res.send('index.html');
});

app.listen(4000);

// childProc.stdout.on('data', function (data) {
//   debug('stdout: ' + data);
// });

// childProc.stderr.on('data', function (data) {
//   debug('stderr: ' + data);
// });

// var srcCmd = 'bmdcapture -m 8 -C 0 -A 2 -V 4 -M 16 -F nut -f pipe:1';


var captureProc = modCapture.startCapture();

var encodeCmd   = modEncoder.startEncoding( captureProc.stdout );

encodeCmd.on('progress', function(prog){
    debug('Progress', prog.timemark);
})
.on('end', function(){
    debug('Finished processing');
    captureProc.kill('SIGKILL');
})
.run();








module.exports = function () {

};
