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
