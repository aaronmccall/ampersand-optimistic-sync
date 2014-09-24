ampersand-optimistic-sync
=============

A wrapper for Backbone.sync and ampersand-sync that implements optimistic concurrency over HTTP.

Not sure what optimistic concurrency is? [You can read a bit more about it and implementing it in HTTP here.][1]

## How do I use it?

### Default Behavior

For the default behavior, just extend like so:

```javascript
var Model = require('ampersand-model'); // or require('backbone').Model;
var syncMixin = require('ampersand-optimistic-sync');

module.exports = Model.extend(syncMixin(Model));

```

Now your model will check for the ETag header on every request to the server.

If it exists, the ETag will be set on the model as _version and a sync:version (args: model, version) event will fire.

On updates, sync will now automatically include the _version value as an If-Match header.

If the update is successful, the new ETag that the server sends will be set as _version.

If the update request returns a 412 error, a `sync:invalid-version (args: model, version, data)` event is fired.

### Customizing Behavior

The mixin takes an optional second config argument that can be used to modify behavior.


#### config.type

Allowed values; etag (default), last-modified

When config.type is changed to last-modified like so:

```javascript
var Model = require('ampersand-model'); // or require('backbone').Model;
var syncMixin = require('ampersand-optimistic-sync');

module.exports = Model.extend(syncMixin(Model, {type: 'last-modified'}));

```

The model will now store Last-Modified header values as _version and send _version as an If-Unmodified-Since header.

#### config.invalidHandler

If config.invalidHandler is a function, it will be registered as a `sync:invalid-version` handler before your first update request is sent.

[1]: http://looselyconnected.wordpress.com/2010/03/25/the-http-etag-header-and-optimistic-locking-in-rest/ (The HTTP ETag header and optimistic locking in REST)
