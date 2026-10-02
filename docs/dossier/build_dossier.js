// Builds docs/TigoAI_SmartGlasses_Project_Documentation.docx from content.js.
// Usage: node build_dossier.js [output path]
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, Header, Footer,
  AlignmentType, HeadingLevel, LevelFormat, BorderStyle, WidthType, ShadingType,
  PageNumber, PageBreak, TableOfContents, VerticalAlign,
} = require('docx');
const { META, SECTIONS, W, STATUS } = require('./content');

const DEFAULT_OUT = path.join(__dirname, '..', 'TigoAI_SmartGlasses_Project_Documentation.docx');

const FONT = 'Arial';
const NAVY = '1F3864';
const BLUE = '2E75B6';
const GREY = '595959';
const STATUS_FILL = { [STATUS.OK]: 'C6E0B4', [STATUS.PART]: 'FFE699', [STATUS.NONE]: 'F4B6B6' };

// Turns "plain **bold** plain" into TextRuns.
function runs(text, base = {}) {
  return String(text).split('**')
    .map((part, i) => (part === '' ? null : new TextRun({ text: part, ...base, bold: !!base.bold || i % 2 === 1 })))
    .filter(Boolean);
}

const para = (text, opts = {}) => new Paragraph({ spacing: { after: 120, line: 288 }, ...opts, children: runs(text, opts.run) });

function cell(text, width, { head = false } = {}) {
  const plain = String(text).replace(/\*\*/g, '');
  const fill = head ? NAVY : STATUS_FILL[plain];
  const border = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.TOP,
    borders: { top: border, bottom: border, left: border, right: border },
    shading: fill ? { fill, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    margins: { top: 70, bottom: 70, left: 110, right: 110 },
    children: [new Paragraph({
      spacing: { after: 0, line: 264 },
      children: runs(text, head ? { bold: true, color: 'FFFFFF', size: 19 } : { size: 19, bold: !!STATUS_FILL[plain] }),
    })],
  });
}

function buildTable({ widths, head, rows }) {
  const total = widths.reduce((s, w) => s + w, 0);
  if (total !== W) throw new Error(`Table "${head.join(' | ')}" widths sum to ${total}, expected ${W}`);
  for (const r of rows) {
    if (r.length !== widths.length) throw new Error(`Row "${r[0]}" has ${r.length} cells, expected ${widths.length}`);
  }
  return new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: head.map((t, i) => cell(t, widths[i], { head: true })) }),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((t, i) => cell(t, widths[i])) })),
    ],
  });
}

function render(node) {
  switch (node.k) {
    case 'h1': return [new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(node.t)] })];
    case 'h2': return [new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(node.t)] })];
    case 'h3': return [new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(node.t)] })];
    case 'p': return [para(node.t)];
    case 'ul': return node.items.map((t) => para(t, { numbering: { reference: 'bullets', level: 0 }, spacing: { after: 70, line: 280 } }));
    case 'ol': {
      // Each ordered list gets its own numbering instance so it restarts at 1.
      render.olCount = (render.olCount || 0) + 1;
      return node.items.map((t) => para(t, { numbering: { reference: 'numbers', level: 0, instance: render.olCount }, spacing: { after: 70, line: 280 } }));
    }
    case 'note': return [
      new Paragraph({
        spacing: { before: 120, after: 160, line: 280 },
        indent: { left: 160, right: 160 },
        shading: { fill: 'EAF1FA', type: ShadingType.CLEAR, color: 'auto' },
        border: { left: { style: BorderStyle.SINGLE, size: 24, color: BLUE, space: 8 } },
        children: [new TextRun({ text: `${node.label}. `, bold: true, color: NAVY }), ...runs(node.t)],
      }),
    ];
    case 'table': return [buildTable(node), new Paragraph({ spacing: { after: 140 }, children: [] })];
    case 'break': return [new Paragraph({ children: [new PageBreak()] })];
    default: throw new Error(`Unknown node kind: ${node.k}`);
  }
}

function cover() {
  const centred = (text, run, spacing = {}) => new Paragraph({ alignment: AlignmentType.CENTER, spacing, children: [new TextRun({ text, ...run })] });
  return [
    centred('', {}, { before: 2600 }),
    centred(META.title, { bold: true, size: 64, color: NAVY }, { after: 160 }),
    centred(META.subtitle, { size: 34, color: BLUE }, { after: 360 }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 360 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: BLUE, space: 12 } },
      children: [new TextRun({ text: META.tagline, italics: true, size: 24, color: GREY })],
    }),
    centred(`Version ${META.version}`, { size: 22 }, { before: 600, after: 80 }),
    centred(META.date, { size: 22 }, { after: 400 }),
    centred(META.source, { size: 18, color: GREY }, { after: 0 }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

function buildDocument() {
  render.olCount = 0;
  const body = SECTIONS.flatMap(render);
  return new Document({
    creator: 'TigoAI project',
    title: `${META.title}: ${META.subtitle}`,
    description: META.tagline,
    features: { updateFields: true },
    styles: {
      default: { document: { run: { font: FONT, size: 21 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { font: FONT, size: 32, bold: true, color: NAVY },
          paragraph: { spacing: { before: 420, after: 180 }, outlineLevel: 0, keepNext: true } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { font: FONT, size: 25, bold: true, color: BLUE },
          paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1, keepNext: true } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { font: FONT, size: 22, bold: true, color: NAVY },
          paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2, keepNext: true } },
      ],
    },
    numbering: {
      config: [
        { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 560, hanging: 280 } } } }] },
        { reference: 'numbers', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 560, hanging: 360 } } } }] },
      ],
    },
    sections: [
      {
        properties: { page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } }, titlePage: true },
        headers: {
          default: new Header({ children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF', space: 4 } },
            children: [new TextRun({ text: `${META.title} | ${META.subtitle}`, size: 16, color: GREY })],
          })] }),
          first: new Header({ children: [new Paragraph({ children: [] })] }),
        },
        footers: {
          default: new Footer({ children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: `Version ${META.version}, ${META.date}    Page `, size: 16, color: GREY }),
              new TextRun({ children: [PageNumber.CURRENT], size: 16, color: GREY }),
            ],
          })] }),
          first: new Footer({ children: [new Paragraph({ children: [] })] }),
        },
        children: [
          ...cover(),
          new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: 'Contents', bold: true, size: 32, color: NAVY })] }),
          new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-2' }),
          new Paragraph({ children: [new PageBreak()] }),
          ...body,
        ],
      },
    ],
  });
}

async function build(outPath = DEFAULT_OUT) {
  const buffer = await Packer.toBuffer(buildDocument());
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buffer);
  return outPath;
}

if (require.main === module) {
  build(process.argv[2]).then((out) => console.log(`Wrote ${out}`)).catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { build, buildDocument };
