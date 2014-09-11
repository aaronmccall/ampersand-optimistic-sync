var config;

var updateHeaderMap = {
    'etag': 'if-match',
    'last-modified': 'if-unmodified-since'
};

function handleOutOfSync(model, xhr) {
    var version = xhr.getResponseHeader(config.type);
    var mime = xhr.getResponseHeader('content-type');
    var data;
    if (mime.indexOf('json') !== -1) {
        try {
            data = JSON.parse(xhr.responseText);    
        } catch (e) {}
    }
    model.trigger('sync:invalid-version', model, version, data || {});
}

function setupOptions(method, model, options) {
    var error = options.error;
    options.error = function (xhr, status, message) {
        if (xhr.status === 412) {
            handleOutOfSync(model, xhr);
        }
        if (typeof error === 'function') error(xhr, status, message);
    };
    var success = options.success;
    options.success = function (data, status, xhr) {
        var version = xhr.getResponseHeader(config.type);
        if (version) {
            model._version = version;
            if (data && typeof data === 'object') {
                model._serverState = data;
            }
            model.trigger('sync:version', model, version);
        }
        if (success) success(data, status, xhr);
    };
}

module.exports = function (base, _config) {
    config = _config || {};
    if (!config.type) config.type = 'etag';
    if (config.type !== 'etag' && config.type !== 'last-modified') {
        throw new Error('Allowed types are "etag" and "last-modified"');
    }
    var base_sync = (base.prototype && base.prototype.sync) ? base.prototype.sync : base.sync;
    if (!base_sync) throw new Error('optimistic-sync requires an existing sync implementation to wrap.');

    return {
        sync: function (method, model, options) {
            if (!options) options = {};
            setupOptions(method, model, options);
            if ((method === 'update' || method === 'patch') && model._version){
                if (!options.headers) options.headers = {};
                options.headers[updateHeaderMap[config.type]] = model._version;
            }
            return base_sync.call(this, method, model, options);
        }
    };
};

module.exports.headers = updateHeaderMap;