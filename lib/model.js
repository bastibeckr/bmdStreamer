var debug = require('debug')('model');
var config = require('config');
var Backbone = require('backbone');
var Q = require('q');

var modBrowser = require('./browser');

var publicData = Backbone.Model.extend({
    defaults: {
        name: ''
    },
    initialize: function(){
        debug('publicModel.initialize');
        if( !this.get('name') ){
            throw new Error('Model must have a (unique) name');
        }
        this.listenTo( this, 'change', this.sendData.bind(this) );
        this.sendData();
    },
    sendData: function(){
        var name = this.get('name');
        var data = {};
        data[name] = this.toJSON();
        modBrowser.sendData(data);
    }
});


module.exports = {
    publicData: publicData
}