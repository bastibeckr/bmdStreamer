var debug = require('debug')('sat1-node-stream:model');
var winston = require('winston');
var config = require('config');
var Backbone = require('backbone');
var Q = require('q');

var modBrowser = require('./webserver');

var PublicData = Backbone.Model.extend({
    defaults: {
        name: ''
    },
    initialize: function() {
        debug('publicModel.initialize');
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
        delete(data[name]['name']);
        // debug('Model changed.', data);
        modBrowser.sendData(data);
    }
});

var PublicDataCollection = Backbone.Collection.extend({
    _name: null,
    initialize: function(options) {
        debug('publicCollection.initialize \n'+ JSON.stringify(options));
        if( !options._name ){
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
        debug('Collection changed.', data);
        modBrowser.sendData(data);
    }
});


module.exports = {
    PublicData: PublicData,
    PublicDataCollection: PublicDataCollection
};