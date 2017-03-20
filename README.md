le-challenge-digitalocean
================

An automatic dns-based strategy for node-greenlock(formerly node-letsencrypt) for setting, retrieving,
and clearing ACME DNS-01 challenges issued by the ACME server using the DigitalOcean api.

You'll need your DigitalOcean api key with write access.
https://cloud.digitalocean.com/settings/api/tokens

Install
-------

```bash
npm install --save le-challenge-digitalocean@2.x
```

Usage
-----

```javascript
var leChallengeDigitalOcean = require('le-challenge-digitalocean').create({
  debug: false,
  doApiKey: 'your-api-key'
});

var LE = require('greenlock');

LE.create({
  server: LE.stagingServerUrl,                               // Change to LE.productionServerUrl in production
  challengeType: 'dns-01',
  challenges: {
    'dns-01': leChallengeDigitalOcean
  }
});
```

Exposed Methods
---------------

For ACME Challenge:

* `set(opts, domain, challange, keyAuthorization, done)`
* `get(defaults, domain, challenge, done)`
* `remove(defaults, domain, challenge, done)`

Note: `get()` is a no-op for `dns-01`.

For greenlock internals:

* `getOptions()` returns the internal defaults merged with the user-supplied options
* `loopback(defaults, domain, challange, done)` performs a dns lookup of the txt record
