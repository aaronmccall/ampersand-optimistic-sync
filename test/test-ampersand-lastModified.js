var AmpersandModel = require('ampersand-model').extend({
    ajaxConfig: {
        headers: {
            test: 'foo'
        }
    }
});
var tester = require('./tester');

exports.lab = tester('ampersand-model', AmpersandModel, {type: 'last-modified'});