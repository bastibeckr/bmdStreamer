var debug = require('debug')('sat1-node-stream:model');
var winston = require('winston');
var config = require('config');
var Backbone = require('backbone');
var Q = require('q');
var _ = require('lodash');
var util       = require('./util');

var logger = util.getLogger('models', { label: 'Models' });



var modBrowser = require('./webserver');

    var ProcessModel = Backbone.Model.extend({
        initialize: function(options){
            logger.debug('ProcessModel.initialize', arguments);
        }
    });

    var PublicDataModel = Backbone.Model.extend({
        defaults: {
            name: ''
        },
        constructor: function(){
            logger.debug('PublicDataModel.constructor\n'+JSON.stringify(arguments));
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
            modBrowser.sendData(data);
        }
    }),

    PublicDataCollection = Backbone.Collection.extend({
        _name: null,
        constructor: function(){
            logger.debug('PublicDataCollection.constructor\n'+JSON.stringify(arguments));
            Backbone.Collection.apply(this, arguments);
        },
        initialize: function(options) {
            logger.debug('publicCollection.initialize \n'+ JSON.stringify(options));
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
            logger.debug('Collection changed.');
            modBrowser.sendData(data);
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
            this._formatsCollection.reset(formats);

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
            logger.debug('deviceCollection.initialize \n'+ JSON.stringify(options));
            this.listenTo(this, 'change reset', this.sendData);
            this.sendData();
        }
    }),

    SettingsModel = Backbone.Model.extend({
        idAttribute: '_name',
        constructor: function(data, options){
            logger.debug('settingsModel.constructor\n'+JSON.stringify(arguments));
            if(!_.has(data, '_name')){
                throw new Error('SettingsModel must have a (unique) name');
            }
            Backbone.Model.apply(this, arguments);
        },
        initialize: function(data, options){
            logger.debug('settingsModel.initialize\n'+ JSON.stringify(options));
            this.listenTo(this, 'change', this.onChange);
            this.sendData();
        },
        onChange: function(){
            logger.debug('settingsModel.change', JSON.stringify(arguments, null, 2));
            this.sendData.apply(this);
        },
        sendData: function() {
            var name = this.get('_name');
            var data = {};
            data[name] = this.toJSON();
            logger.debug('SettingsModel - sendData');
            modBrowser.sendData(data, 'settings-change');
        }
    });

    SettingsCollection = Backbone.Collection.extend({
        model: SettingsModel,
        initialize: function(data, options) {
            logger.debug('SettingsCollection.initialize \n'+ JSON.stringify(arguments));
            this.listenTo(this, 'add', this.onAdd);
        },
        onAdd: function(model, options){
            logger.debug('SettingsCollection.onAdd \n'+ JSON.stringify(arguments));
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

};
