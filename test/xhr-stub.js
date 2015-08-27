var sinon = require('sinon');


var xhr = {
    status: 200,
    responseText: '{"foo": "baz"}'
};

module.exports = function (props, xhr2) {
    var payload = { };
    var key;
    props = props || {};
    payload.getResponseHeader = sinon.stub();
    if (props.headers) {
        payload.headers = {};
        for (key in props.headers) {
            payload.getResponseHeader.withArgs(key).returns(props.headers[key]);
        }
    }
    for (key in props) {
        if (!payload[key]) payload[key] = props[key];
    }
    for (key in xhr) {
        if (!payload[key]) payload[key] = xhr[key];
    }
    if (xhr2) {
        var newPayload =  {
            statusCode: payload.status,
            method: 'GET',
            headers: payload.headers || {},
            url: props.url || '',
            rawRequest: payload
        };
        try {
            newPayload.body = JSON.parse(payload.responseText);
        } catch (e) {
            newPayload.body = payload.responseText;
        }
        return newPayload;
    }
    return payload;
};