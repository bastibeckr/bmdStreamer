var debugMod = require('debug');
var debug = debugMod('sat1-node-stream:playout');

var winston = require('winston');
var config = require('config');
var ffmpeg = require('fluent-ffmpeg');
var Q = require('q');
var spawn = require('child_process').spawn;

var _ = require('lodash');
var ansi_up = require('ansi_up');

var PublicDataCollection = require('./model').PublicDataCollection;

var devicesCollection = new PublicDataCollection({
    _name: 'devices'
});


winston.loggers.add('playout', {
    console: {
        timestamp: true,
        colorize: true,
        label: 'Encoder / Output'
    }
});

var captureLogger = winston.loggers.get('playout');




//  /**
//   * [logOverride description]
//   * @return {[type]} [description]
//   */
//   function logOverride(){
//       var self = this;
//       var args = Array.prototype.slice.call(arguments);
//       modBrowser.sendData(args[0], 'log');
//       return console.log.apply(self, args);
//   }
// debug.log = logOverride.bind(console);



var currentCommand;

/**
 * Parse BMD Play Output to get list of output formats
 * Regex should match:
 *
 *     Supported video output display modes and pixel formats:
 *        0:   NTSC                   720 x 486     29.97 FPS
 *        1:   NTSC 23.98             720 x 486    23.976 FPS
 *        2:   PAL                    720 x 576        25 FPS
 *        3:   NTSC Progressive       720 x 486   59.9401 FPS
 *        4:   PAL Progressive        720 x 576        50 FPS
 *
 *
 * @param  {[type]} lines [description]
 * @return {[type]}       [description]
 */
function parseBmdPlayOutput(text){
    var regex = /(?:\s+)?(?:\d+:)(?:\s{2,})((?:(?:\S+|\s)(?!\s{2,})\S+)+)(?:\s+)(?:(\d+)\sx\s(\d+))(?:\s+)(?:((?:\d+|\.)+)\sFPS)/gm;
    var output = [];
    do {
        m = regex.exec(text);
        if (m) {
            output.push({
                name: m[1],
                width: parseInt(m[2], 10),
                height: parseInt(m[3], 10),
                fps: parseFloat(m[4])
            });
        }
    } while (m);

    return output;
}

/**
 * Parse BMD Play Output to get list of output devices
 * Regex should match:
 *
 *  -> UltraStudio Mini Monitor (-C 0 )
 *
 *
 * @param  {[type]} lines [description]
 * @return {[type]}       [description]
 */
function parseBmdPlayDevices(text){
    var regex = /\s?->\s([^\(]+)\s(?:\(-C\s(\d)\s\))/gm;
    var splitRegex = /\s?->\s(?:[^\(]+)\s(?:\(-C\s(?:\d)\s\))/gm;
    var output = [];
    var devices = [];

    if( !regex.test(text) ){
        return false;
    }

    regex.lastIndex = 0;
    var parts = text.split(splitRegex);
    parts.shift();

    do {
        m = regex.exec(text);
        if (m) {

            output.push({
                name: m[1],
                index: parseInt(m[2], 10)
            });
        }
    } while (m);

    parts.forEach( function(part, index){

        if(typeof(output[index]) !== 'undefined'){
            output[index].formats = parseBmdPlayOutput(part);
        }
    });

    return output;
}

/**
 * [getBmdPlayDevices description]
 * @return {[type]} [description]
 */
function getBmdPlayFormats(){
    var procData = '';
    var cmd = 'bmdplay';
    var deferred = Q.defer();

    proc = spawn(cmd);
    proc.stdout.setEncoding('ascii');
    proc.stdout.on('data', function(data){
        procData += '' + data;
    });

    proc.on('close', function(code){
        captureLogger.info('BMD Play exited with code '+code);
        var devices = parseBmdPlayDevices(procData);

        if( !_.isArray(devices) || _.isEmpty(devices) ){
            captureLogger.warn('BMD Play found 0 devices! \n', devices);
            deferred.reject('BMD Play found 0 devices.');
        } else {
            captureLogger.info('BMD Play found ' + devices.length + ' devices: \n', devices);
            deferred.resolve(devices);
        }

    });
    return deferred.promise;
}


function updateDevices(){
    return getBmdPlayFormats().then(function(devices){
        devicesCollection.reset(devices);
    });
}



function getBmdPlayCommand(){

}


module.exports = {
    updateDevices: updateDevices
};

