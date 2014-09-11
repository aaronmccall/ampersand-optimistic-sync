/*jshint expr:true*/
var sinon = require('sinon');
// Test tooling
var Lab = require('lab');
var expect = Lab.expect;
var xhrStub = require('../lib/xhr-stub');

// System under test
var syncMixin = require('../');

module.exports = function (name, BaseModel) {
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

    describe('***** anachronisync + ' + name + ' *****', function () {
        it('throws when the mixin is called on a model with now sync method', wrapDone(function () {
            expect(syncMixin.bind(null, {})).to.throw(Error, /existing sync/);
        }));
        describe('wraps and/or ensures success handlers', function () {
            var instance, sync;
            beforeEach(wrapDone(function () {
                sync = sinon.stub(BaseModel.prototype, 'sync');
                instance = new (BaseModel.extend(syncMixin(BaseModel)))();
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
                    expect(args).to.be.an('array').with.length(3);
                    expect(args[2]).to.be.an('object');
                    expect(args[2]).to.have.property('success').that.is.a('function');
                }
                done();
            });
        });
        describe('adds last-modified/if-unmodified-since handling', function () {
            describe('when last-modified header is present', function () {
                var sync, instance, xhr;
                var xhrProps = { headers: { 'last-modified': 'foo-bar-baz' } };
                beforeEach(wrapDone(function () {
                    sync = sinon.stub(BaseModel.prototype, 'sync');
                    xhr = xhrStub(xhrProps);
                    sync.yieldsTo('success', JSON.parse(xhr.responseText), 'ok', xhr);
                    instance = new (BaseModel.extend(syncMixin(BaseModel)))();
                }));
                afterEach(wrapDone(function () {
                    BaseModel.prototype.sync = originalSync;
                }));
                it('sets a _lastModified property on model', function (done) {
                    instance.sync('read', instance, {
                        success: function (data, status, _xhr) {
                            expect(data).to.eql(JSON.parse(xhr.responseText));
                            expect(status).to.equal('ok');
                            expect(_xhr).to.equal(xhr);
                            expect(instance._lastModified).to.equal(xhrProps.headers['last-modified']);
                            done();
                        }
                    });
                });
                it('triggers a sync:last-modified event on model', function (done) {
                    sync.yieldsTo('success', null, 'ok', xhr);
                    instance.on('sync:last-modified', function (model, lastModified) {
                        expect(lastModified).to.equal(xhrProps.headers['last-modified']);
                        expect(model._lastModified).to.equal(lastModified);
                        done();
                    });
                    instance.sync('read', instance);
                });
                it('sets a _serverState property on model', function (done) {
                    instance.sync('read', instance);
                    expect(instance._serverState).to.eql(JSON.parse(xhr.responseText));
                    done();
                });
            });
            describe('when the _lastModified property is set', function () {
                var sync, instance, xhr;
                beforeEach(wrapDone(function () {
                    sync = sinon.stub(BaseModel.prototype, 'sync');
                    xhr = xhrStub();
                    sync.yieldsTo('success', JSON.parse(xhr.responseText), 'ok', xhr);
                    instance = new (BaseModel.extend(syncMixin(BaseModel.prototype)))();
                }));
                afterEach(wrapDone(function () {
                    BaseModel.prototype.sync = originalSync;
                }));
                it('sets an if-unmodified-since header on "update" and "patch" requests', function (done) {
                    var options = { headers: { 'x-powered-by': 'ampersands' } };
                    instance._lastModified = 'foo-bar-baz';
                    instance.sync('patch', instance, options);
                    expect(options.headers['if-unmodified-since']).to.equal(instance._lastModified);
                    done();
                });
                it('adds an error handler to every "update" or "patch" request', function (done) {
                    var options = {};
                    xhr.status = 404;
                    sync.yieldsTo('error', xhr, 'error', xhr.responseText);
                    instance._lastModified = 'foo-bar-baz';
                    instance.sync('update', instance, options);
                    expect(options.error).to.be.a('function');
                    done();
                });
            });
        });

        describe('when the error handler detects 412 errors', function () {
            var sync, instance, xhr, callback;
            var oldLastModified = 'foo-bar-baz';
            var xhrProps = { 
                headers: { 
                    'last-modified': 'bar-baz-biz',
                    'content-type': 'application/json'
                },
                status: 412,
                responseText: '{"foo": "bar"}' };
            beforeEach(wrapDone(function () {
                sync = sinon.stub(BaseModel.prototype, 'sync');
                xhr = xhrStub(xhrProps);
                sync.yieldsTo('error', xhr, 'error', xhr.responseText);
                instance = new (BaseModel.extend(syncMixin(BaseModel.prototype)))();
                callback = sinon.spy();
                instance.on('sync:invalid-last-modified', callback);
            }));
            afterEach(wrapDone(function () {
                BaseModel.prototype.sync = originalSync;
            }));
            it('triggers an sync:invalid-last-modified event', function (done) {
                instance.sync('update', instance, { error: function (xhr) {
                    expect(callback.calledOnce).to.be.true;
                    done();   
                }});
            });
            it('with a new last-modified value', function (done) {
                xhr.getResponseHeader.withArgs('content-type').returns('text/html');
                instance.sync('update', instance, {error: function (xhr) {
                    expect(callback.firstCall.args[1]).to.equal(xhrProps.headers['last-modified']);
                    done();
                }});
            });
            it('and the current server state', function (done) {
                instance.sync('update', instance, {error: function (xhr) {
                    expect(callback.firstCall.args[2]).to.eql(JSON.parse(xhrProps.responseText));
                    done();
                }});
            });
        });
    });
    return lab;
};