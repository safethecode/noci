import test from 'node:test';
import assert from 'node:assert/strict';
import { renderIcon, getIconData } from 'noci-icons/core';
import { createIcon } from 'noci-icons/dom';

const icon = {
  name: 'fixture', directional: true,
  sizes: {
    16: { strokeWidth: 1.5, nodes: [['path', { d: 'M4 8h8' }]] },
    24: { strokeWidth: 1.75, nodes: [['path', { d: 'M6 12h12' }]] }
  }
};

test('decorative by default; undefined and null labels cannot create unnamed images', () => {
  for (const options of [undefined, null, {}, { label: undefined }, { label: null }]) {
    const svg = renderIcon(icon, options);
    assert.match(svg, /aria-hidden="true"/);
    assert.match(svg, /focusable="false"/);
    assert.doesNotMatch(svg, /role=|aria-label=/);
  }
});

test('meaningful name and role appear together, without duplicate hidden semantics', () => {
  const svg = renderIcon(icon, { label: '검색' });
  assert.match(svg, /role="img" aria-label="검색"/);
  assert.doesNotMatch(svg, /aria-hidden=|<title|id=/);
  assert.equal(svg, renderIcon(icon, { label: '검색' }), 'SSR output must be deterministic.');
});

test('empty or non-string meaningful labels fail clearly', () => {
  for (const label of ['', ' \n ', false, 0, {}]) assert.throws(() => renderIcon(icon, { label }), /non-empty label/);
});

test('inherited options do not affect semantics or sizes', () => {
  const options = Object.create({ label: 'Inherited', size: 0, dir: 'rtl', className: 'wrong' });
  const data = getIconData(icon, options);
  assert.equal(data.attributes['aria-hidden'], 'true');
  assert.equal(data.attributes.width, '24');
  assert.equal(data.attributes.class, 'noci-icon');
  assert.equal(data.nodes[0][1].transform, undefined);
});

test('untrusted attribute values are escaped in string rendering', () => {
  const svg = renderIcon(icon, { label: '\"><script>alert(1)</script>&\'', className: '\" onload=\"alert(1)' });
  assert.doesNotMatch(svg, /<script|class="[^"]*" onload=/);
  assert.match(svg, /&quot;&gt;&lt;script&gt;/);
  assert.match(svg, /&amp;&#39;/);
});

test('optical masters track pixel sizes and accept CSS lengths without numeric coercion', () => {
  for (const size of [12, 16, 20]) assert.equal(getIconData(icon, { size }).attributes.viewBox, '0 0 16 16');
  for (const size of [21, 24, 32, 48]) assert.equal(getIconData(icon, { size }).attributes.viewBox, '0 0 24 24');
  for (const size of ['1em', '1.25rem', '100%', '.75em', '16px']) {
    const data = getIconData(icon, { size });
    assert.equal(data.attributes.width, size);
    assert.equal(data.attributes['stroke-width'], '1.5');
    assert.doesNotMatch(renderIcon(icon, { size }), /NaN|Infinity/);
  }
  assert.equal(getIconData(icon, { size: '1em', opticalSize: 24 }).attributes.viewBox, '0 0 24 24');
});

test('invalid runtime inputs are rejected', () => {
  for (const size of [0, -1, NaN, Infinity, '0em', '-1px', 'calc(1px)', 'large', '24']) assert.throws(() => renderIcon(icon, { size }));
  assert.throws(() => renderIcon(icon, { opticalSize: 48 }), /16 or 24/);
  assert.throws(() => renderIcon(icon, { dir: 'invalid' }), /ltr or rtl/);
});

test('RTL mirrors only directional artwork, without mutating definitions', () => {
  const before = JSON.stringify(icon);
  const data = getIconData(icon, { dir: 'rtl', size: 16 });
  assert.equal(data.nodes[0][1].transform, 'translate(16 0) scale(-1 1)');
  assert.equal(getIconData({ ...icon, directional: false }, { dir: 'rtl' }).nodes[0][1].transform, undefined);
  assert.equal(JSON.stringify(icon), before);
});

test('DOM access is deferred until createIcon is called', () => {
  assert.equal(typeof globalThis.document, 'undefined');
  assert.throws(() => createIcon(icon), /Document/);
  assert.ok(renderIcon(icon).startsWith('<svg'));
});
