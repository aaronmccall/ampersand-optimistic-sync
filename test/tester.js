/*jshint expr:true*/
var sinon = require('sinon');
// Test tooling
var Code = require('code');
var Lab = require('lab');
var expect = Code.expect;
var xhrStub = require('./xhr-stub');

function deepProp(obj, path) {
    if (obj == null) return obj;
    var propArray;
    if (typeof path === 'string') {
        propArray = path.split(/[\.,\/:]/);
    } else {
        propArray = path;
    }
    if (!propArray || !propArray.length) return obj;
    var prop = obj;
    while ((prop = prop[propArray.shift()]) != null) continue;
    return prop;
}

function jsonData(xhr) {
    return xhr.body || safeParse(xhr);
}

function safeParse(xhr) {
    var response;
    try {
        response = JSON.parse(xhr.responseText || '');
    } catch (e) {
        response = xhr.responseText;
    }
    return response;
}

function getResponseText(xhr) {
    return deepProp(xhr, ['rawRequest', 'responseText']) || xhr.responseText;
}
// System under test
var syncMixin = require('../');

module.exports = function (name, BaseModel, config) {
    var type = (config && config.type) || 'etag';
    var originalSync = BaseModel.prototype.sync;
    var lab = Lab.script();
    var describe = lab.experiment;
    var it = lab.test;
    var afterEach = lab.afterEach;
    var beforeEach = lab.beforeEach;
    function wrapDone(fn) {
        return function (done) {
            fn();
            done();
        };
    }

    describe('***** ampersand-optimistic-sync + ' + name + ' + ' + type + ' *****', function () {
        var isAmp = name.indexOf('ampersand') > -1;
        it('throws when the mixin is called on a model with no sync method', wrapDone(function () {
            expect(syncMixin.bind(null, {})).to.throw(Error, /existing sync/);
        }));
        it('throws when the mixin is called with an invalid type', wrapDone(function () {
            expect(syncMixin.bind(null, BaseModel, {type: 'retrograde-inversion'})).to.throw(Error, /Allowed types/);
        }));
        describe('wraps and/or ensures success handlers', function () {
            var instance, sync;
            beforeEach(wrapDone(function () {
                sync = sinon.stub(BaseModel.prototype, 'sync');
                instance = new (BaseModel.extend(syncMixin(BaseModel, config)))();
            }));
            afterEach(wrapDone(function () {
                BaseModel.prototype.sync = originalSync;
            }));
            it('every request has a success handler', function (done) {
                instance.sync('read', instance);
                instance.sync('read', instance);
                expect(sync.calledTwice).to.equal(true);
                for (var i = 0, c = sync.callCount; i < c; i++) {
                    var args = sync.getCall(i).args;
                    expect(args).to.be.an.array();
                    expect(args.length).to.equal(3);
                    expect(args[2]).to.be.an.object();
                    expect(args[2].success).to.be.a.function();
                }
                done();
            });
        });
        describe('handles headers set as default and passed at call time', function () {
            var instance, sync;
            beforeEach(wrapDone(function () {
                sync = sinon.stub(BaseModel.prototype, 'sync');
                instance = new (BaseModel.extend(syncMixin(BaseModel, config)))();
            }));
            afterEach(wrapDone(function () {
                BaseModel.prototype.sync = originalSync;
            }));
            it('uses ajaxConfig.headers when no headers passed at call time or via own config', wrapDone(function () {
                instance.sync('read', instance, {});
                var args = sync.getCall(0).args;
                expect(args[2]).to.be.an.object();
                expect(args[2].headers).to.exist();
                if (typeof instance.ajaxConfig === 'object' && typeof instance.ajaxConfig.headers === 'object') {
                    expect(args[2].headers).to.equal(instance.ajaxConfig.headers);
                }
                if (typeof instance.ajaxConfig === 'function') {
                    console.log('instance.ajaxConfig was a function');
                    expect(args[2].headers).to.include(instance.ajaxConfig().headers);
                }
            }));
            it('uses config.headers', wrapDone(function () {
                instance.sync('read', instance, {});
                var args = sync.getCall(0).args;
                expect(args[2]).to.be.an.object();
                expect(args[2].headers).to.exist();
                var headers;
                if (config && ((headers = deepProp(config, ['options', 'all', 'headers'])) != null)) {
                    expect(args[2].headers).to.include(headers);
                }
                if (config && ((headers = deepProp(config, ['options', 'read', 'headers'])) != null)) {
                    expect(args[2].headers).to.include(headers);
                }
            }));
            it('uses options.headers when passed at call time', wrapDone(function () {
                var options = {
                    headers: { test: 'bar' }
                };
                instance.sync('read', instance, options);
                var args = sync.getCall(0).args;
                expect(args[2]).to.be.an.object();
                expect(args[2].headers).to.exist();
                expect(args[2].headers).to.equal(options.headers);
            }));
        });
        describe('adds version handling', function () {
            describe('when ' + type + ' header is present', function () {
                var sync, instance, xhr;
                var xhrProps = { headers: { } };
                xhrProps.headers[type] = 'foo-bar-baz';
                beforeEach(wrapDone(function () {
                    sync = sinon.stub(BaseModel.prototype, 'sync');
                    xhr = xhrStub(xhrProps, isAmp);
                    sync.yieldsTo('success', jsonData(xhr), 'ok', xhr);
                    instance = new (BaseModel.extend(syncMixin(BaseModel, config)))();
                }));
                afterEach(wrapDone(function () {
                    BaseModel.prototype.sync = originalSync;
                }));
                it('sets a _version property on model', function (done) {
                    instance.sync('read', instance, {
                        success: function (data, status, _xhr) {
                            expect(data).to.deep.equal(jsonData(xhr));
                            expect(status).to.equal('ok');
                            expect(_xhr).to.equal(xhr);
                            expect(instance._version).to.equal(xhrProps.headers[type]);
                            done();
                        }
                    });
                });
                it('triggers a sync:version event on model', function (done) {
                    sync.yieldsTo('success', null, 'ok', xhr);
                    instance.on('sync:version', function (model, lastModified) {
                        expect(lastModified).to.equal(xhrProps.headers[type]);
                        expect(model._version).to.equal(lastModified);
                        done();
                    });
                    instance.sync('read', instance);
                });
                it('sets a _serverState property on model', function (done) {
                    instance.sync('read', instance);
                    expect(instance._serverState).to.deep.equal(jsonData(xhr));
                    done();
                });
            });
            describe('when the _version property is set', function () {
                var sync, instance, xhr;
                beforeEach(wrapDone(function () {
                    sync = sinon.stub(BaseModel.prototype, 'sync');
                    xhr = xhrStub();
                    sync.yieldsTo('success', jsonData(xhr), 'ok', xhr);
                    instance = new (BaseModel.extend(syncMixin(BaseModel.prototype, config)))();
                }));
                afterEach(wrapDone(function () {
                    BaseModel.prototype.sync = originalSync;
                }));
                it('sets an ' + syncMixin.headers[type] + ' header on "update" and "patch" requests', function (done) {
                    var options = { headers: { 'x-powered-by': 'ampersands' } };
                    instance._version = 'foo-bar-baz';
                    instance.sync('patch', instance, options);
                    expect(options.headers[syncMixin.headers[type]]).to.equal(instance._version);
                    done();
                });
                it('adds an error handler to every "update" or "patch" request', function (done) {
                    var options = {};
                    xhr.status = 404;
                    sync.yieldsTo('error', xhr, 'error', xhr.responseText);
                    instance._version = 'foo-bar-baz';
                    instance.sync('update', instance, options);
                    expect(options.error).to.be.a.function();
                    done();
                });
            });
        });

        describe('when the error handler detects 412 errors', function () {
            var sync, instance, xhr, callback;
            var oldLastModified = 'foo-bar-baz';
            var xhrProps = { 
                headers: { 
                    'content-type': 'application/json'
                },
                status: 412,
                responseText: 'foo' };
            xhrProps.headers[type] = 'bar-baz-biz';
            beforeEach(wrapDone(function () {
                sync = sinon.stub(BaseModel.prototype, 'sync');
                xhr = xhrStub(xhrProps, isAmp);
                sync.yieldsTo('error', xhr, 'error', xhr.responseText);
                instance = new (BaseModel.extend(syncMixin(BaseModel.prototype, config)))();
                callback = sinon.spy();
                instance.on('sync:invalid-version', callback);
            }));
            afterEach(wrapDone(function () {
                BaseModel.prototype.sync = originalSync;
            }));
            it('triggers an sync:invalid-version event', function (done) {
                instance.sync('update', instance, { error: function (xhr) {
                    expect(callback.calledOnce).to.be.true;
                    done();   
                }});
            });
            it('with a new ' + type + ' value, if supplied', function (done) {
                (xhr.rawRequest || xhr).getResponseHeader.withArgs('content-type').returns('text/html');
                instance.sync('update', instance, {error: function (xhr) {
                    expect(callback.firstCall.args[1]).to.equal(xhrProps.headers[type]);
                    done();
                }});
            });
            it('and the response data, if supplied', function (done) {
                instance.sync('update', instance, {error: function (xhr) {
                    expect(callback.firstCall.args[2]).to.deep.equal(jsonData(xhr));
                    done();
                }});
            });
        });

        describe('when config.invalidHandler is specified', function () {
            var sync, instance, xhr, callback;
            var oldLastModified = 'foo-bar-baz';
            var xhrProps = { 
                headers: { 
                    'content-type': 'application/json'
                },
                status: 412,
                responseText: '{"foo": "bar"}' };
            xhrProps.headers[type] = 'bar-baz-biz';
            beforeEach(wrapDone(function () {
                sync = sinon.stub(BaseModel.prototype, 'sync');
                xhr = xhrStub(xhrProps);
                callback = sinon.spy();
                instance = new (BaseModel.extend(syncMixin(BaseModel.prototype, {type: type, invalidHandler: callback})))();
            }));
            afterEach(wrapDone(function () {
                BaseModel.prototype.sync = originalSync;
            }));
            it('registers invalidHandler for sync:invalid-version events on first update/patch', function (done) {
                sync.yieldsTo('success', JSON.parse(xhr.responseText), 'ok', xhr);
                instance.sync('read', instance, {
                    success: function () {
                        expect(instance._events ? instance._events['sync:invalid-version'] : instance._events).to.not.exist;
                        sync.yieldsToAsync('error', xhr, 'error', xhr.responseText);
                        instance.sync('update', instance, {error: function () {
                            expect(callback.called).to.equal(true);
                            done();
                        }});
                        expect(instance._events['sync:invalid-version']).to.exist;
                    }
                });
            });
        });
    });
    return lab;
};