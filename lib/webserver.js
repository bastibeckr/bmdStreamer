var EventEmitter = require("events").EventEmitter;
var debug = require('debug')('sat1-node-stream:webserver');
var config = require('config');
var winston = require('winston');
var _ = require('lodash');
var Q = require('q');

var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var ss = require('socket.io-stream');

var browserConf = config.get('browser');



var ee = new EventEmitter();

var lastData = {};

/**
 * Initialize and start the web-frontend (if enabled by config)
 * @return {[type]} [description]
 */
function startWebServer(throughStream) {

    var sockStream = ss.createStream();



    if (!browserConf.enabled) {
        var msg = 'Web-Frontend disabled by configuration. Will not start webserver.';
        debug(msg);
        return false;
    }

    app.use(express.static(__dirname + '/../frontend-src'));

    io.on('connection', function(socket) {
        debug('io.on connection');

        // if a client connects, give him the last recent dataset.
        socket.emit('data', lastData, function() {
            debug('socket.emit callback', arguments);
        });

        // register event-hook for future data changes
        ee.on('app-to-browser', function(socketEventName, data) {
            socketEventName = socketEventName || 'data';
            socket.emit(socketEventName, data, function() {
                debug('socket.emit callback', arguments);
            });
        });

        // socket.emit('init', { hello: 'world' });
        socket.on('browser-to-app', function(data, fn) {
            debug('socket received browser-to-app event', data);
            ee.emit('browser-to-app', data);
            if (typeof(fn) === 'function') {
                fn('Got it!');
            }
        });

        throughStream.on('data', function(chunk, encoding, callback){
            socket.emit('gotData', {
                chunk: chunk.toString()
            });
        });

    });


    return server.listen(browserConf.port);
}

/**
 * Emit a "data"-Event to update web frontend.
 * @param  {[type]} data [description]
 * @return {[type]}      [description]
 */
function sendData(data, socketEventName) {
    debug('Send Data.');
    lastData = _.extend(lastData, data);
    socketEventName = socketEventName || 'data';
    ee.emit('app-to-browser', socketEventName, data);
}

module.exports = {
    start: startWebServer,
    sendData: sendData,
    events: ee
};