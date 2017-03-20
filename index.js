const DigitalOcean = require('do-wrapper');
const Promise = require('bluebird');
const dns = Promise.promisifyAll(require('dns'));

const _ = require('lodash');

const acmeRecordPrefix = '_acme-challenge';
const getDomainName = (domain) => domain.split('.').slice(-2).join('.');
const getSubDomainName = (domain) => domain.split('.').slice(0, -2).join('.');
const getAcmeRecordName = (domain) => [acmeRecordPrefix].concat(getSubDomainName(domain)).join('.');

const defaults = {
  debug: false,
  acmeChallengeDns: '_acme-challenge.',
  doApiKey: null
};

const logTag = '[le-challenge-digitalocean]';
function log(debug) {
  if (debug) {
    let args = Array.prototype.slice.call(arguments);
    args.shift();
    args.unshift(logTag);
    console.info.apply(console, args);
  }
};

const Challenge = module.exports;

Challenge.create = function(options) {
  const _options = _.merge({}, defaults, options);

  return {
    getOptions: () => {
      return _options;
    },
    set: Challenge.set,
    get: Challenge.get,
    remove: Challenge.remove,
    loopback: Challenge.loopback,
    test: Challenge.test,
    _doApi: new DigitalOcean(_options.doApiKey)
  };
};

Challenge.set = function(opts, host, challenge, keyAuthorization, cb) {
  const keyAuthDigest = require('crypto').createHash('sha256').update(keyAuthorization || '').digest('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/g, '')
  ;

  const domain = getDomainName(host);
  return this._doApi.domainRecordsGetAll(domain)
    .then((res) => {
      const records = res.body;
      const acmeRecordName = getAcmeRecordName(host);
      const acmeChallengeRecord = {
        type: 'TXT',
        name: acmeRecordName,
        data: keyAuthDigest,
        priority: null,
        port: null,
        weight: null
      };

      const existingRecord = _.find(records.domain_records, {name: acmeRecordName});
      if (existingRecord) {
        log(opts.debug, 'attempting to update record', acmeChallengeRecord);
        return this._doApi.domainRecordsUpdate(domain, existingRecord.id, acmeChallengeRecord)
          .then(() => {
            log(opts.debug, 'updated acme record', acmeChallengeRecord);
            return cb(null);
          })
          .catch((e) => {
            console.error(logTag, 'update error', e);
            cb(e);
          });
      } else {
        log(opts.debug, 'attempting to create record', acmeChallengeRecord);
        return this._doApi.domainRecordsCreate(domain, acmeChallengeRecord)
          .then(() => {
            log(opts.debug, 'created acme record', acmeChallengeRecord);
            return cb(null);
          })
          .catch((e) => {
            console.error(logTag, 'create error', e);
            cb(e);
          });
      }
    }).catch((e) => {
      console.error(logTag, "couldn't find a domain by", domain);
      cb(e);
    });
};

Challenge.get = function(opts, domain, token, cb) { /* Not to be implemented */ };

Challenge.remove = function(opts, host, token, cb) {
  const domain = getDomainName(host);

  return this._doApi.domainRecordsGetAll(domain)
    .then((res) => {
      const records = res.body;
      const acmeRecordName = getAcmeRecordName(host);

      const existingRecord = _.find(records.domain_records, {name: acmeRecordName});
      if (existingRecord) {
        return this._doApi.domainRecordsDelete(domain, existingRecord.id)
          .then(() => log(opts.debug, 'DO: deleted acme record', existingRecord))
          .then(() => cb(null))
          .catch((e) => {
            console.error(logTag, 'update error', e);
            return cb(e);
          });
      } else {
        log(opts.debug, 'DO: could not find existing record', acmeRecordName);
        return cb(new Error('DO: could not find existing record'));
      }
    }).catch((e) => {
      console.error(logTag, "couldn't find a domain by", domain);
      cb(e);
    });
};

// same as get, but external
Challenge.loopback = function(defaults, domain, challenge, done) {
  const challengeDomain = (defaults.test || '') + defaults.acmeChallengeDns + domain;
  return dns.resolveTxtAsync(challengeDomain).then((x) => { return done(null, x); }, done);
};
