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

var util = require('./util')

var browserConf = config.get('browser');

winston.loggers.add('webserver', {
    console: {
        timestamp: true,
        colorize: true,
        label: 'Web Server'
    }
});

var webServerLogger = winston.loggers.get('webserver');

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
        webServerLogger.info(msg);
        return false;
    }

    app.use(express.static(__dirname + '/../frontend-src'));

    io.on('connection', function(socket) {
        webServerLogger.info('io.on connection');

        // // if a client connects, give him the last recent dataset.
        // socket.emit('data', lastData['data'], function() {
        //     debug('socket.emit callback', arguments);
        // });

        _.forEach(lastData, function(data, socketEventName){
            webServerLogger.info('emit %s - event', socketEventName);
            socket.emit(socketEventName, lastData[socketEventName], function() {
                webServerLogger.info('socket.emit callback', arguments);
            });
        });

        // register event-hook for future data changes
        ee.on('app-to-browser', function(socketEventName, data) {
            socketEventName = socketEventName || 'data';
            socket.emit(socketEventName, data, function() {
                webServerLogger.info('socket.emit callback', arguments);
            });
        });

        // socket.emit('init', { hello: 'world' });
        socket.on('browser-to-app', function(data, fn) {
            webServerLogger.info('socket received browser-to-app event', data);
            ee.emit('browser-to-app', data);
            if (typeof(fn) === 'function') {
                fn('Got it!');
            }
        });

        // socket.emit('init', { hello: 'world' });

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
    socketEventName = socketEventName || 'data';

    webServerLogger.debug('SendData: "%s"', socketEventName, data);

    lastData[socketEventName] = util.defaultsDeep( data, lastData[socketEventName] || {} );

    ee.emit('app-to-browser', socketEventName, data);
}

module.exports = {
    start: startWebServer,
    sendData: sendData,
    events: ee
};
