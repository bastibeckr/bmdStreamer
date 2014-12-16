var debug       = require('debug')('sat1-node-stream:model');
var winston     = require('winston');
var config      = require('config');
var Backbone    = require('backbone');
var Q           = require('q');
var _           = require('lodash');
var modUtil     = require('./util');

var logger      = modUtil.getLogger('models', { label: 'Models' } );



var modBrowser = require('./webserver');

    var ProcessModel = Backbone.Model.extend({
        initialize: function(options){
            logger.debug('ProcessModel.initialize', arguments);
        },
        toParams: function(){
            return modUtil.paramsObjectToArray( this.toJSON() );
        }
    });

    var PresetModel = Backbone.Model.extend({
        defaults: {
            name: '',
            description: ''
        },
        _ffmpegArgs: undefined,
        initialize: function(options){
            logger.debug('PresetModel.initialize');
            this._ffmpegArgs = new ProcessModel();
            this.listenTo(this, 'change', this.handleArgs);
            this.handleArgs();
        },
        onChange: function(model, options){

        },
        setArgs: function(args){
            return this._ffmpegArgs.clear().set(args);
        },
        getArgs: function( ){
            return this._ffmpegArgs
        },
        handleArgs: function(){
            logger.debug('PresetModel.handleArgs');
            if( this.has('args') ){
                logger.debug('PresetModel.handleArgs -> has formats.');
                this.setArgs( this.get('args') );
                this.unset('args', {silent: true});
            }
        },
        toJSON: function(options){
            logger.debug('PresetModel.toJSON');
            var data = _.clone(this.attributes);
            data.args = this.getArgs().toJSON();
            return data;
        }
    });

    var PresetCollection = Backbone.Collection.extend({
        model: PresetModel,
        initialize: function( options ){
            logger.debug('PresetCollection.initialize', arguments);
            this.listenTo(this, 'change reset', this.sendData.bind(this));
            this.sendData.apply(this);
        },
        sendData: function(){
             var data = this.toJSON();
             logger.debug('PresetCollection.sendData', data);
             return modBrowser.sendData( data, 'presets-change' );
        }
    });

    var PublicDataModel = Backbone.Model.extend({
        defaults: {
            name: ''
        },
        constructor: function(){
            logger.debug('PublicDataModel.constructor - '+JSON.stringify(arguments));
            Backbone.Model.apply(this, arguments);
        },
        initialize: function() {
            logger.debug('publicModel.initialize');
            if (!this.get('name')) {
                throw new Error('Model must have a (unique) name');
            }
            this.listenTo(this, 'change', this.sendData.bind(this));
            this.sendData();
        },
        sendData: function() {
            var name = this.get('name');
            var data = {};
            data[name] = this.toJSON();
            // debug('Model changed.', data);
            return modBrowser.sendData(data);
        }
    }),

    PublicDataCollection = Backbone.Collection.extend({
        _name: null,
        constructor: function(){
            logger.debug('PublicDataCollection.constructor - '+JSON.stringify(arguments));
            Backbone.Collection.apply(this, arguments);
        },
        initialize: function(options) {
            logger.debug('PublicDataCollection.initialize - '+ JSON.stringify(options));
            if( !options._name || !this._name ){
                throw new Error('PublicDataCollection must have a (unique) name');
            }

            this._name = options._name;
            this.listenTo(this, 'change reset', this.sendData.bind(this));

            this.sendData();
        },
        sendData: function() {
            var name = this._name;
            var data = {};
            data[name] = this.toJSON();
            logger.debug('PublicDataCollection changed');
            return modBrowser.sendData( data );
        }
    }),

    DeviceModel = Backbone.Model.extend({
        _formatsCollection: undefined,
        constructor: function(){
            logger.debug('Devicemodel.constructor');
            this._formatsCollection = new Backbone.Collection();
            Backbone.Model.apply(this, arguments);
        },
        initialize: function(data, options){
            logger.debug('Devicemodel.initialize');
            this.listenTo(this, 'change', this.handleFormats.bind('this'));
            this.handleFormats();
        },
        setFormats: function(formats){
            logger.debug('DeviceModel.setFormats');
            return this._formatsCollection.reset(formats);
        },
        getFormats: function(){
            logger.debug('DeviceModel.getFormats');
            return this._formatsCollection;
        },
        handleFormats: function(){
            logger.debug('Devicemodel.handleFormats');
            if( this.has('formats') ){
                logger.debug('Devicemodel.handleFormats -> has formats.');
                this.setFormats(this.get('formats'));
                this.unset('formats', {silent: true});
            }
        },
        toJSON: function(options){
            logger.debug('DeviceModel.toJSON');
            var data = _.clone(this.attributes);
            data.formats = this.getFormats().toJSON();
            return data;
        }
    }),

    DeviceCollection = PublicDataCollection.extend({
        model: DeviceModel,
        _name: 'devices',
        initialize: function(data, options) {
            logger.debug('deviceCollection.initialize : '+ JSON.stringify(options));
            this.listenTo(this, 'change reset', this.sendData);
            return this.sendData();
        }
    }),

    SettingsModel = Backbone.Model.extend({
        idAttribute: '_name',
        constructor: function(data, options){
            logger.debug('settingsModel.constructor : '+JSON.stringify(arguments));
            if(!_.has(data, '_name')){
                throw new Error('SettingsModel must have a (unique) name');
            }
            Backbone.Model.apply(this, arguments);
        },
        initialize: function(data, options){
            logger.debug('settingsModel.initialize : '+ JSON.stringify(options));
            this.listenTo(this, 'change', this.onChange);
            return this.sendData();
        },
        onChange: function(){
            logger.debug('settingsModel.onChange');
            this.sendData.apply(this);
        },
        sendData: function() {
            var name = this.get('_name');
            var data = {};
            data[name] = this.toJSON();
            logger.debug('SettingsModel.sendData');
            modBrowser.sendData(data, 'settings-change');
        }
    });

    SettingsCollection = Backbone.Collection.extend({
        model: SettingsModel,
        initialize: function(data, options) {
            logger.debug('SettingsCollection.initialize : '+ JSON.stringify(arguments) );
            this.listenTo(this, 'add', this.onAdd);
        },
        onAdd: function(model, options){
            logger.debug('SettingsCollection.onAdd : '+ JSON.stringify(arguments) );
        },
        toJSON: function(options){
            var arr = this.map(function(model){ return model.toJSON(options); });
            return _.indexBy(arr, '_name');
        }
    });

module.exports = {
    PublicDataModel: PublicDataModel,
    PublicDataCollection: PublicDataCollection,
    SettingsModel: SettingsModel,
    SettingsCollection: SettingsCollection,
    DeviceModel: DeviceModel,
    DeviceCollection: DeviceCollection,
    ProcessModel: ProcessModel,
    PresetModel: PresetModel,
    PresetCollection: PresetCollection
};
