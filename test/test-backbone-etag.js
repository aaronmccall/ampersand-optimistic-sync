var BackboneModel = require('backbone').Model.extend({
    ajaxConfig: function () {
        return {
            headers: {
                test: 'foo'
            }
        };
    }
});
var tester = require('./tester');

exports.lab = tester('Backbone.Model', BackboneModel);