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

const Challenge = module.exports;

// TODO: rework for normal constructor pattern, with a factory

Challenge.create = function(options) {
  const obj = Object.assign({}, _.omit(Challenge, 'create'));
  const _options = Object.assign(defaults, options);
  obj._options = _options;
  obj.getOptions = () => obj._options;
  obj._doApi = new DigitalOcean(_options.doApiKey);

  return obj;
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
        return this._doApi.domainRecordsUpdate(domain, existingRecord.id, acmeChallengeRecord)
          .then(() => console.log('updated acme record'))
          .catch((e) => console.error('update error', e));
      } else {
        console.log('attempting to create record', acmeChallengeRecord);
        return this._doApi.domainRecordsCreate(domain, acmeChallengeRecord)
          .then(() => console.log('created acme record', acmeChallengeRecord))
          .catch((e) => console.error('create error', e));
      }
    }).catch((e) => {
      console.error("couldn't find a domain by", domain);
      cb(e);
      throw e;
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
          .then(() => console.log('DO: deleted acme record'))
          .catch((e) => console.error('update error', e));
      } else {
        console.log('DO: could not find existing record', acmeRecordName);
        throw new Error('DO: could not find existing record');
      }
    }).catch((e) => {
      console.error("couldn't find a domain by", domain);
      throw e;
    });
};

// same as get, but external
Challenge.loopback = function(defaults, domain, challenge, done) {
  const challengeDomain = (defaults.test || '') + defaults.acmeChallengeDns + domain;
  return dns.resolveTxtAsync(challengeDomain).then((x) => { return done(null, x); }, done);
};
