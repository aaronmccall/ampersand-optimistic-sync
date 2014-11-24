var AmpersandModel = require('ampersand-model');
var tester = require('./tester');

exports.lab = tester('ampersand-model', AmpersandModel, {
    options: {
        all: {
            headers: {
                test: 'foo'
            }
        }
    }
});