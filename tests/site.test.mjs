import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexSource = await readFile(new URL('../src/pages/index.astro', import.meta.url), 'utf8');

const expectedHomepageCopy = [
  'Departments, apparently',
  'Unfortunately, the official details',
  'Rope access',
  'Software and strange internet objects',
  'Events and DJ things',
  'Boats and maritime schemes',
  'Administrative survival',
  'LEGALLY SPEAKING: YES',
  'CURRENTLY:',
  'Message filed somewhere alarmingly official.',
  'The bureaucracy has rejected this attempt.',
  'NL004438663B04',
];

test('homepage contains the approved company-shaped-object additions', () => {
  for (const copy of expectedHomepageCopy) {
    assert.match(indexSource, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('homepage includes canonical, social-sharing and Organization metadata', () => {
  assert.match(indexSource, /rel="canonical"/);
  assert.match(indexSource, /property="og:image"/);
  assert.match(indexSource, /name="twitter:card"/);
  assert.match(indexSource, /application\/ld\+json/);
  assert.match(indexSource, /https:\/\/hrwillmott\.com\/og\.png/);
});

test('homepage keeps interactive controls accessible', () => {
  assert.match(indexSource, /aria-controls="legal-stamp"/);
  assert.match(indexSource, /aria-live="polite"/);
  assert.match(indexSource, /fieldset/);
  assert.match(indexSource, /legend>Quick subject/);
});

test('contact form submits a body the server parser understands', () => {
  assert.match(indexSource, /body:\s*new URLSearchParams\(new FormData\(form\)\)/);
});

test('contact form initializes invisible BotID protection before fetch submissions', () => {
  assert.match(indexSource, /import\s*\{\s*initBotId\s*\}\s*from\s*'botid\/client\/core'/);
  assert.match(indexSource, /path:\s*'\/api\/contact'/);
  assert.match(indexSource, /method:\s*'POST'/);
  assert.match(indexSource, /checkLevel:\s*'basic'/);
});

test('Vercel proxies BotID challenge assets through the site origin', async () => {
  const vercelConfig = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(vercelConfig.rewrites.length, 2);
  assert.equal(vercelConfig.rewrites[0].destination, 'https://api.vercel.com/bot-protection/v1/challenge');
  assert.equal(vercelConfig.rewrites[1].destination, 'https://api.vercel.com/bot-protection/v1/proxy/:path*');
});

test('contact form explains the no-JavaScript fallback instead of silently losing a message', () => {
  assert.match(indexSource, /<noscript>/);
  assert.match(indexSource, /JavaScript is needed for spam protection/);
  assert.match(indexSource, /#contact-submit\s*\{\s*display:\s*none/);
  assert.match(indexSource, /id="contact-submit"/);
  assert.match(indexSource, /response\.status\s*===\s*403/);
  assert.match(indexSource, /willmott\.henry@gmail\.com instead/);
});

test('homepage constrains the mobile page inside the padded viewport', () => {
  assert.match(indexSource, /\.page\s*\{\s*width:\s*calc\(100vw - 2rem\);/);
});

test('custom 404 page preserves the cupboard voice', async () => {
  const notFoundSource = await readFile(new URL('../src/pages/404.astro', import.meta.url), 'utf8');
  assert.match(notFoundSource, /Nothing in this cupboard/);
  assert.match(notFoundSource, /became a separate business model/);
  assert.match(notFoundSource, /href="\/"/);
});

test('social sharing image exists and is a non-trivial PNG', async () => {
  const ogImage = await readFile(new URL('../public/og.png', import.meta.url));
  assert.equal(ogImage.subarray(1, 4).toString(), 'PNG');
  assert.ok(ogImage.length > 20_000);
});
