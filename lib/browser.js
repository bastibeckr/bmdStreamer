var EventEmitter = require("events").EventEmitter;
var debug = require('debug')('webserver');
var config = require('config');
var _ = require('lodash');
var Q = require('q');

var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

var browserConf = config.get('browser');

var ee = new EventEmitter();

var lastData = {};

/**
 * Initialize and start the web-frontend (if enabled by config)
 * @return {[type]} [description]
 */
function startWebServer(){


    if( !browserConf.enabled ){
        var msg = 'Web-Frontend disabled by configuration. Will not start webserver.';
        debug(msg);
        return false;
    }

    app.use(express.static(__dirname + '/../frontend-src'));

    io.on('connection', function (socket) {
        debug('io.on connection');

        // if a client connects, give him the last recent dataset.
        socket.emit('data', lastData, function(){
            debug('socket.emit callback', arguments);
        });

        // register event-hook for future data changes
        ee.on('app-to-browser', function(socketEventName, data){
            socketEventName = socketEventName || 'data';
            socket.emit(socketEventName, data, function(){
                debug('socket.emit callback', arguments);
            });
        });

        // socket.emit('init', { hello: 'world' });
        socket.on('browser-to-app', function (data) {
            debug('socket received browser-to-app event', data);
            ee.emit('browser-to-app', data);
        });
    });


    return server.listen( browserConf.port );
}

/**
 * Emit a "data"-Event to update web frontend.
 * @param  {[type]} data [description]
 * @return {[type]}      [description]
 */
function sendData(data){
    lastData = _.extend(lastData, data);
    var socketEventName = 'data';
    ee.emit('app-to-browser', socketEventName, data);
}

module.exports = {
    start: startWebServer,
    sendData: sendData,
    events: ee
};