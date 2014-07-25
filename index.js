
var debug = require('debug')('main app');
var config = require('config');
var ffmpeg = require('fluent-ffmpeg');

var express = require('express');

var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);


var modCapture = require('./lib/capture');
var modEncoder = require('./lib/encode');

io.on('connection', function (socket) {
  socket.emit('init', { hello: 'world' });
  socket.on('my other event', function (data) {
    debug(data);
  });
});

app.use(express.static(__dirname + '/frontend-src'));

// app.get('/', function(req, res) {
//   res.send('index.html');
// });

server.listen(4000);

// childProc.stdout.on('data', function (data) {
//   debug('stdout: ' + data);
// });

// childProc.stderr.on('data', function (data) {
//   debug('stderr: ' + data);
// });

// var srcCmd = 'bmdcapture -m 8 -C 0 -A 2 -V 4 -M 16 -F nut -f pipe:1';


// var captureProc = modCapture.startCapture();
// var encodeCmd   = modEncoder.startEncoding( captureProc.stdout );

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
