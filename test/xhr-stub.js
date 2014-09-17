var sinon = require('sinon');


var xhr = {
    status: 200,
    responseText: '{"foo": "baz"}'
};

module.exports = function (props) {
    var payload = { };
    var key;
    props = props || {};
    payload.getResponseHeader = sinon.stub();
    if (props.headers) {
        payload.headers = {};
        for (key in props.headers) {
            payload.getResponseHeader.withArgs(key).returns(props.headers[key]);
            payload.headers[key] = props[key];
        }
    }
    for (key in props) {
        if (!payload[key]) payload[key] = props[key];
    }
    for (key in xhr) {
        if (!payload[key]) payload[key] = xhr[key];
    }
    return payload;
};