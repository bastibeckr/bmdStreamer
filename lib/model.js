var debug = require('debug')('sat1-node-stream:model');
var winston = require('winston');
var config = require('config');
var Backbone = require('backbone');
var Q = require('q');
var _ = require('lodash');

winston.loggers.add('models', {
    console: {
        timestamp: true,
        colorize: true,
        label: 'Models'
    }
});

var modelLogger = winston.loggers.get('models');

var modBrowser = require('./webserver');

    var ProcessModel = Backbone.Model.extend({
        initialize: function(options){
            modelLogger.info('ProcessModel.initialize', arguments);
        }
    });

    var PublicDataModel = Backbone.Model.extend({
        defaults: {
            name: ''
        },
        constructor: function(){
            modelLogger.info('PublicDataModel.constructor\n'+JSON.stringify(arguments));
            Backbone.Model.apply(this, arguments);
        },
        initialize: function() {
            modelLogger.info('publicModel.initialize');
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
            modBrowser.sendData(data);
        }
    }),

    PublicDataCollection = Backbone.Collection.extend({
        _name: null,
        constructor: function(){
            modelLogger.info('PublicDataCollection.constructor\n'+JSON.stringify(arguments));
            Backbone.Collection.apply(this, arguments);
        },
        initialize: function(options) {
            modelLogger.info('publicCollection.initialize \n'+ JSON.stringify(options));
            if( !options._name || !this._name ){
                throw new Error('Collection must have a (unique) name');
            }

            this._name = options._name;
            this.listenTo(this, 'change reset', this.sendData.bind(this));

            this.sendData();
        },
        sendData: function() {
            var name = this._name;
            var data = {};
            data[name] = this.toJSON();
            modelLogger.info('Collection changed.');
            modBrowser.sendData(data);
        }
    }),

    DeviceModel = Backbone.Model.extend({
        _formatsCollection: undefined,
        constructor: function(){
            modelLogger.info('Devicemodel.constructor\n'+JSON.stringify(arguments));
            this._formatsCollection = new Backbone.Collection();
            Backbone.Model.apply(this, arguments);
        },
        initialize: function(data, options){
            modelLogger.info('Devicemodel.initialize');
            this.listenTo(this, 'change', this.handleFormats.bind('this'));
            this.handleFormats();
        },
        setFormats: function(formats){
            modelLogger.info('DeviceModel.setFormats');
            this._formatsCollection.reset(formats);

        },
        getFormats: function(){
            modelLogger.info('DeviceModel.getFormats');
            return this._formatsCollection;
        },
        handleFormats: function(){
            modelLogger.info('Devicemodel.handleFormats');
            if( this.has('formats') ){
                modelLogger.info('Devicemodel.handleFormats -> has formats.');
                this.setFormats(this.get('formats'));
                this.unset('formats', {silent: true});
            }
        },
        toJSON: function(options){
            modelLogger.info('DeviceModel.toJSON');
            var data = _.clone(this.attributes);
            data.formats = this.getFormats().toJSON();
            return data;
        }
    }),

    DeviceCollection = PublicDataCollection.extend({
        model: DeviceModel,
        _name: 'devices',
        initialize: function(data, options) {
            modelLogger.info('deviceCollection.initialize \n'+ JSON.stringify(options));
            this.listenTo(this, 'change reset', this.sendData);
            this.sendData();
        }
    }),

    SettingsModel = Backbone.Model.extend({
        _name: undefined,
        constructor: function(data, options){
            modelLogger.info('settingsModel.constructor\n'+JSON.stringify(arguments));
            if(!_.has(options, 'name')){
                throw new Error('SettingsModel must have a (unique) name');
            }
            this._name = options.name;
            Backbone.Model.apply(this, arguments);
        },
        initialize: function(data, options){
            modelLogger.info('settingsModel.initialize\n'+ JSON.stringify(options));
            this.listenTo(this, 'change', this.onChange);
            this.sendData();
        },
        onChange: function(){
            modelLogger.info('settingsModel.change', JSON.stringify(arguments, null, 2));
            this.sendData.apply(this);
        },
        sendData: function() {
            var name = this._name;
            var data = {};
            data[name] = this.toJSON();
            modelLogger.info('SettingsModel - sendData');
            modBrowser.sendData(data, 'settings-change');
        }
    });

module.exports = {
    PublicDataModel: PublicDataModel,
    PublicDataCollection: PublicDataCollection,
    SettingsModel: SettingsModel,
    DeviceModel: DeviceModel,
    DeviceCollection: DeviceCollection,
    ProcessModel: ProcessModel
};
