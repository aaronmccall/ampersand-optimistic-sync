var kisslog = require('kisslog');

var updateHeaderMap = {
    'etag': 'if-match',
    'last-modified': 'if-unmodified-since'
};

module.exports = function (base, _config) {
    var config = _config || {};
    var log = kisslog(config);
    if (!config.type) config.type = 'etag';
    if (config.type !== 'etag' && config.type !== 'last-modified') {
        throw new Error('Allowed types are "etag" and "last-modified"');
    }
    var base_sync = (base.prototype && base.prototype.sync) ? base.prototype.sync : base.sync;
    if (!base_sync) throw new Error('optimistic-sync requires an existing sync implementation to wrap.');
    log('optimistic-sync config:', config);


    function getDefaultHeaders(model, options) {
        log('getDefaultHeaders');
        if (options.headers) return options.headers;
        var ajaxConfig;
        if (typeof model.ajaxConfig === 'function') {
            ajaxConfig = model.ajaxConfig();
        }
        if (typeof model.ajaxConfig === 'object') {
            ajaxConfig = model.ajaxConfig;
        }
        return (ajaxConfig && ajaxConfig.headers) || {};
    }

    function handleOutOfSync(model, response) {
        log('optimistic-sync handling invalid-version');
        var xhr = response.rawRequest || response;
        var version = xhr.getResponseHeader(config.type);
        var mime = xhr.getResponseHeader('content-type');
        var data;
        if (mime.indexOf('json') !== -1) {
            try {
                data = response.body || JSON.parse(xhr.responseText);    
            } catch (e) {
                data = xhr.responseText;
            }
        }
        model.trigger('sync:invalid-version', model, version, data);
    }

    function setupOptions(method, model, options) {
        if (!options) options = {};
        log('optimistic-sync setting up options');
        var key;
        if (config.options) {
            if (typeof config.options.all === 'object') {
                for (key in config.options.all) {
                    options[key] = config.options.all[key];
                }
            }
            if (typeof config.options[method] === 'object') {
                for (key in config.options[method]) {
                    options[key] = config.options[method][key];
                }
            }
        }
        options.headers = getDefaultHeaders(model, options);
        if (method === 'update' || method === 'patch') {
            var error = options.error;
            options.error = function (response, status, message) {
                var xhr = response.rawRequest ? response.rawRequest : response;
                if (xhr.status === 412) {
                    handleOutOfSync(model, response);
                }
                if (typeof error === 'function') error(response, status, message);
            };
        }
        var success = options.success;
        options.success = function (data, status, response) {
            var xhr = response.rawRequest ? response.rawRequest : response;
            var version = xhr.getResponseHeader(config.type);
            if (version) {
                model._version = version;
                if (data && typeof data === 'object') {
                    model._serverState = data;
                }
                model.trigger('sync:version', model, version);
            }
            if (success) success(data, status, response);
        };
        return options;
    }   

    return {
        _optimisticSync: config,
        sync: function (method, model, options) {
            log('optimistic-sync sync called');
            options = setupOptions(method, model, options);
            if ((method === 'update' || method === 'patch') && model._version) {
                if (typeof config.invalidHandler === 'function' && !this._syncInvalidListening) {
                    log('optimistic-sync listening to sync:invalid-version with configured handler');
                    this.listenTo(this, 'sync:invalid-version', config.invalidHandler);
                    this._syncInvalidListening = true;
                }
                options.headers[updateHeaderMap[config.type]] = model._version;
            }
            return base_sync.call(this, method, model, options);
        }
    };
};

module.exports.headers = updateHeaderMap;