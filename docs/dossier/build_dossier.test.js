// Gate tests for the dossier generator. Run with: npm test
const { test, before } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const JSZip = require('jszip');
const { build } = require('./build_dossier');
const { SECTIONS, BOM, PILOT_UNITS, bomLow, bomHigh, W } = require('./content');

let text = '';
let xml = '';

before(async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dossier-')), 'out.docx');
  await build(out);
  const zip = await JSZip.loadAsync(fs.readFileSync(out));
  xml = await zip.file('word/document.xml').async('string');
  text = xml.replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
});

test('covers each of the nine items in the UNDP enquiry', () => {
  const required = [
    'Inventors, contributors and faculty supervisor',
    'Technical dossier',
    'Controlled functional demonstration and performance results',
    'User co-design, safety and usability evidence',
    'Invention disclosure, prior-art search and ownership',
    'Disability-sector demand owner and pilot partner',
    'Accessibility, product-safety, ethics, privacy and liability requirements',
    'Manufacturing or deployment partner',
    'Costed next technical milestone',
    'How UNDP can offer value',
  ];
  const headings = SECTIONS.filter((n) => n.k === 'h1').map((n) => n.t);
  for (const r of required) {
    assert.ok(headings.some((h) => h.includes(r)), `missing top-level section: ${r}`);
    assert.ok(text.includes(r), `section text not rendered: ${r}`);
  }
});

test('flags the robot versus wearable mismatch', () => {
  assert.match(text, /assistive navigation robot/);
  assert.match(text, /There is no robot/);
});

test('leaks no credentials or network details from the firmware', () => {
  for (const secret of ['hotguy112345', 'CLICKNETWORKS', 'CES@24700', '10.78.166.48', '192.168.18.3', 'gsk_']) {
    assert.ok(!text.includes(secret), `document contains ${secret}`);
  }
});

test('follows the house writing rules', () => {
  assert.ok(!text.includes('—'), 'contains an em dash');
  const banned = ['delve', 'crucial', 'robust', 'comprehensive', 'nuanced', 'multifaceted', 'furthermore', 'moreover',
    'pivotal', 'landscape', 'tapestry', 'underscore', 'foster', 'showcase', 'intricate', 'vibrant', 'fundamental',
    'significant', 'interplay'];
  for (const word of banned) {
    assert.ok(!new RegExp(`\\b${word}`, 'i').test(text), `contains banned word: ${word}`);
  }
});

test('every table fits the page and has consistent rows', () => {
  for (const t of SECTIONS.filter((n) => n.k === 'table')) {
    assert.strictEqual(t.widths.reduce((s, w) => s + w, 0), W, `widths of table "${t.head[0]}"`);
    for (const row of t.rows) assert.strictEqual(row.length, t.head.length, `row "${row[0]}"`);
  }
});

test('bill of materials totals are the sum of the line items', () => {
  assert.strictEqual(bomLow, BOM.reduce((s, r) => s + r.low, 0));
  assert.strictEqual(bomHigh, BOM.reduce((s, r) => s + r.high, 0));
  assert.ok(text.includes(String(bomLow * PILOT_UNITS)) && text.includes(String(bomHigh * PILOT_UNITS)));
});

test('daily image counts add up to the stated total of 99', () => {
  const m = text.match(/99 \((\d+) on 12 June, (\d+) on 13 June, (\d+) on 5 July, (\d+) on 6 July\)/);
  assert.ok(m, 'image record breakdown not found');
  assert.strictEqual(m.slice(1).map(Number).reduce((s, n) => s + n, 0), 99);
});

test('no markdown markers or placeholders survive into the document', () => {
  assert.ok(!text.includes('**'), 'unrendered bold marker');
  assert.ok(!/TODO|TBD|lorem/i.test(text));
  assert.ok(!text.includes('undefined'));
});
