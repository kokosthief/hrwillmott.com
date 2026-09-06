import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const contactModule = require('../api/contact.js');

function makeRequest(body, headers = {}) {
  const encoded = new URLSearchParams(body).toString();
  const req = Readable.from([encoded]);
  req.method = 'POST';
  req.headers = {
    accept: 'application/json',
    'content-type': 'application/x-www-form-urlencoded',
    host: 'hrwillmott.com',
    ...headers,
  };
  return req;
}

function makeResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[name] = value; },
    end(value = '') { this.body = value; },
  };
}

const validBody = {
  name: 'Ada',
  email: 'ada@example.com',
  subject: 'Project',
  message: 'Could we discuss a rope-access job next week?',
};

async function invoke({
  verification,
  body = validBody,
  telegram = true,
  email = false,
  checkBotId,
  sendTelegram,
  sendResend,
}) {
  const deliveries = [];
  const handler = contactModule.createHandler({
    checkBotId: checkBotId || (async (options) => {
      assert.equal(options.advancedOptions.checkLevel, 'basic');
      assert.ok(options.advancedOptions.headers);
      return verification;
    }),
    sendTelegram: sendTelegram || (async (payload) => { deliveries.push(['telegram', payload]); return telegram; }),
    sendResend: sendResend || (async (payload) => { deliveries.push(['email', payload]); return email; }),
  });
  const res = makeResponse();
  await handler(makeRequest(body), res);
  return { res, payload: JSON.parse(res.body), deliveries };
}

test('BotID rejects automated submissions before delivery', async () => {
  const result = await invoke({ verification: { isBot: true, isHuman: false } });
  assert.equal(result.res.statusCode, 403);
  assert.equal(result.payload.ok, false);
  assert.equal(result.deliveries.length, 0);
});

test('BotID permits a verified human submission', async () => {
  const result = await invoke({ verification: { isBot: false, isHuman: true } });
  assert.equal(result.res.statusCode, 200);
  assert.equal(result.payload.ok, true);
  assert.equal(result.deliveries.length, 2);
});

test('legitimate software enquiries and messages with links are not keyword-blocked', async () => {
  const result = await invoke({
    verification: { isBot: false, isHuman: true },
    body: {
      ...validBody,
      subject: 'Software project',
      message: 'We need an AI software engineer. Brief: https://a.example Scope: https://b.example Dates: https://c.example Can we schedule a call?',
    },
  });
  assert.equal(result.res.statusCode, 200);
  assert.equal(result.payload.ok, true);
});

test('delivery failure is reported rather than disguised as success', async () => {
  const result = await invoke({
    verification: { isBot: false, isHuman: true },
    telegram: false,
    email: false,
  });
  assert.equal(result.res.statusCode, 503);
  assert.equal(result.payload.ok, false);
});

test('BotID and delivery errors are explicit, never false success', async () => {
  const verificationFailure = await invoke({
    checkBotId: async () => { throw new Error('verification unavailable'); },
  });
  assert.equal(verificationFailure.res.statusCode, 500);
  assert.equal(verificationFailure.payload.ok, false);

  const deliveryFailure = await invoke({
    checkBotId: async () => ({ isHuman: true, isBot: false }),
    sendTelegram: async () => { throw new Error('delivery unavailable'); },
    sendResend: async () => false,
  });
  assert.equal(deliveryFailure.res.statusCode, 500);
  assert.equal(deliveryFailure.payload.ok, false);
});

test('honeypot submissions stop before BotID and delivery', async () => {
  let checked = false;
  const handler = contactModule.createHandler({
    checkBotId: async () => { checked = true; return { isBot: false }; },
    sendTelegram: async () => { throw new Error('must not deliver'); },
    sendResend: async () => { throw new Error('must not deliver'); },
  });
  const res = makeResponse();
  await handler(makeRequest({ ...validBody, website: 'spam.example' }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(res.body).ok, true);
  assert.equal(checked, false);
});
