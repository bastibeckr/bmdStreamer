
var debug = require('debug')('sat1-node-stream:settings');
var winston = require('winston');

var fs = require('fs');
var path = require('path');

var config = require('config');
var _ = require('lodash');
var Q = require('q');

var yaml = require('js-yaml');

var util = require('./util');
var models = require('./model');

var logger = util.getLogger('settings', { label: 'Settings' });

var settingsCollection = new models.SettingsCollection();

var settingsPath = path.join( __dirname, '../settings' );


var Settings = module.exports = (function(){

    /**
     * Get a new or existing settings object.
     *
     * @param  {[type]} name [description]
     * @param  {[type]} data [description]
     * @return {[type]}      [description]
     */
    function getSettings(name, data){
        var model;
        var modelData = _.extend( {_name: name }, data);

        var results = settingsCollection.findWhere( { '_name': name } );

        if( results && results.length > 0){
            model = results[0];
        } else {
            model = new models.SettingsModel( modelData );
            settingsCollection.add( model );
        }

        return model;

    }


    /**
     * [saveSettings description]
     * @param  {[type]} name [description]
     * @return {[type]}      [description]
     */
    function saveSettings(name){
        var deferred = Q.defer();
        var data = settingsCollection.toJSON();
        var fullSettingsPath = path.join( settingsPath, name + '.yml' );

        logger.debug('Save Settings to "%s": ', fullSettingsPath, data);

        var stream = fs.createWriteStream(fullSettingsPath, {encoding: 'utf8'});

        stream.on('error', function(err){
            logger.error('could not write file', err.message );
            return deferred.reject(err.message);
        });

        stream.on('finish', function(){
            logger.info('write settings file: success', JSON.stringify(arguments));
            return deferred.resolve(data);
        });

        stream.on('open', function(fd) {
            stream.write( yaml.safeDump(data) );
            stream.end();
        });

        return deferred.promise;
    }

    /**
     * [saveSettings description]
     * @param  {[type]} name [description]
     * @return {[type]}      [description]
     */
    function loadSettings( name ){
        var deferred = Q.defer();
        var data;
        var fullSettingsPath = path.join( settingsPath, name.split('.')[0] + '.yml' );

        logger.debug('Loading settings from "%s": ', fullSettingsPath);

        try {
          data = yaml.safeLoad( fs.readFileSync(fullSettingsPath, 'utf8') );
          logger.info('read settings file: success', data);
          deferred.resolve(data);
        } catch (e) {
          logger.error('could not read settings file. message: "%s"', e.message );
          deferred.reject(data);
        }

        return deferred.promise;

    }


    /**
     * [listSettingsFiles description]
     * @return {[type]} [description]
     */
    function listSettingsFiles(){
        var deferred = Q.defer();
        var data, fullPath;

        logger.debug('List settings files "%s": ', settingsPath);

        var dirContents = fs.readdir(settingsPath, function(err, fileNames){
            if(err){
                logger.error('could not read settings file. message: "%s"', err.message );
                deferred.reject(err.message);
            }

            var promises = fileNames.map(function(fileName){
                return loadSettings( fileName );
            });

            Q.all(promises).then(function(){
                logger.debug('AFTER ALL.', JSON.stringify(promises, null, 2));
            }, function(){
                logger.error('AFTER ALL.')
            });

        });



        return deferred.promise;
    }

    return {
        getSettings: getSettings,
        saveSettings: saveSettings,
        listSettingsFiles: listSettingsFiles,
        loadSettings: loadSettings
    };

})();

