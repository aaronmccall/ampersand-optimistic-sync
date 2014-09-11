var BackboneModel = require('backbone').Model;
var tester = require('../lib/tester');

exports.lab = tester('Backbone.Model', BackboneModel, {type: 'last-modified'});