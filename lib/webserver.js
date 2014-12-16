var EventEmitter = require('events').EventEmitter;
var util = require('util');

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

var modUtil = require('./util')

var browserConf = config.get('browser');


var logger = modUtil.getLogger('webserver', { label: 'Web-Server' });

var ee = new EventEmitter();

var lastData = {};


function WebServer() {
    EventEmitter.call(this);
}

util.inherits(WebServer, EventEmitter);


WebServer.prototype.start = startWebServer;
WebServer.prototype.sendData = sendData;

/**
 * Initialize and start the web-frontend (if enabled by config)
 * @return {[type]} [description]
 */
function startWebServer( throughStream ) {

    var deferred = Q.defer();

    var self = this;

    var sockStream = ss.createStream();

    if (!browserConf.enabled) {
        var msg = 'Web-Frontend disabled by configuration. Will not start webserver.';
        logger.debug(msg);
        deferred.reject(msg);
        return deferred.promise;
    }

    app.use( express.static( __dirname + '/../frontend-src' ) );

    io.on('connection', function(socket) {
        logger.debug('io.on connection');

        // // if a client connects, give him the last recent dataset.
        // socket.emit('data', lastData['data'], function() {
        //     debug('socket.emit callback', arguments);
        // });

        _.forEach(lastData, function(data, socketEventName){
            logger.debug('emit %s - event', socketEventName);
            socket.emit(socketEventName, lastData[socketEventName], function() {
                logger.debug('socket.emit callback', arguments);
            });
        });

        // register event-hook for future data changes
        self.on('app-to-browser', function(socketEventName, data) {
            socketEventName = socketEventName || 'data';
            socket.emit(socketEventName, data, function() {
                logger.debug('socket.emit callback', arguments);
            });
        });

        // socket.emit('init', { hello: 'world' });
        socket.on('browser-to-app', function(data, fn) {
            logger.debug('socket received browser-to-app event', data);
            self.emit('browser-to-app', data);
            if (typeof(fn) === 'function') {
                fn('Got it!');
            }
        });

        // socket.emit('init', { hello: 'world' });

        throughStream.on('data', function(chunk, encoding, callback){
            socket.emit('log', {
                chunk: chunk.toString()
            });
        });

    });


    server.listen( browserConf.port );

    return deferred.promise;

}

/**
 * Emit a "data"-Event to update web frontend.
 * @param  {[type]} data [description]
 * @return {[type]}      [description]
 */
function sendData(data, socketEventName) {
    socketEventName = socketEventName || 'data';

    logger.silly('SendData: "%s"', socketEventName, data);

    lastData[socketEventName] = modUtil.defaultsDeep( data, lastData[socketEventName] || {} );

    this.emit('app-to-browser', socketEventName, data);
}

// module.exports = {
//     start: startWebServer,
//     sendData: sendData,
//     events: ee
// };

module.exports = new WebServer();
