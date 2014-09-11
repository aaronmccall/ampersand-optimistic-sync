function handleOutOfSync(model, xhr) {
    var lastModified = xhr.getResponseHeader('last-modified');
    var mime = xhr.getResponseHeader('content-type');
    var data;
    if (mime.indexOf('json') !== -1) {
        try {
            data = JSON.parse(xhr.responseText);    
        } catch (e) {}
    }
    model.trigger('sync:invalid-last-modified', model, lastModified, data || {});
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
        var lastModified = xhr.getResponseHeader('last-modified');
        if (lastModified) {
            model._lastModified = lastModified;
            if (data && typeof data === 'object') {
                model._serverState = data;
            }
            model.trigger('sync:last-modified', model, lastModified);
        }
        if (success) success(data, status, xhr);
    };
}

module.exports = function (base) {
    var base_sync = (base.prototype && base.prototype.sync) ? base.prototype.sync : base.sync;
    if (!base_sync) throw new Error('Anachronisync requires an existing sync implementation to wrap.');

    return {
        sync: function (method, model, options) {
            if (!options) options = {};
            setupOptions(method, model, options);
            if ((method === 'update' || method === 'patch') && model._lastModified){
                if (!options.headers) options.headers = {};
                options.headers['if-unmodified-since'] = model._lastModified;
            }
            return base_sync.call(this, method, model, options);
        }
    };
};