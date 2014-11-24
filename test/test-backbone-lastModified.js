var BackboneModel = require('backbone').Model.extend({
    ajaxConfig: {
        test: 'foo'
    }
});
var tester = require('./tester');
exports.lab = tester('Backbone.Model', BackboneModel, {
    type: 'last-modified',
    options: {
        read: {
            headers: {
                test: 'foo'
            }
        }
    }
});