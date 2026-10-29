// Penulis file Excel (.xlsx) sederhana: satu sheet, baris judul tebal & dibekukan, tanpa library tambahan.
// Dipakai agar no. HP tersimpan sebagai teks (CSV membuat Excel menampilkan 6,28575E+12).
import { createDeflateRaw } from 'zlib';

export type XlsxCell = string | number | null | undefined;

export interface XlsxColumn {
  header: string;
  width?: number; // lebar kolom dalam karakter
  money?: boolean; // angka dengan pemisah ribuan
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer, crc = 0): number {
  let c = ~crc >>> 0;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
}

interface ZipEntry {
  name: Buffer;
  crc: number;
  size: number;
  data: Buffer; // hasil deflate
}

/** Kompres potongan-potongan isi file (deflate) sambil menghitung CRC, tanpa menggabungkan isi aslinya di memori. */
async function deflateEntry(name: string, chunks: Iterable<Buffer>): Promise<ZipEntry> {
  const deflate = createDeflateRaw({ level: 6 });
  const out: Buffer[] = [];
  deflate.on('data', (b: Buffer) => out.push(b));
  const done = new Promise<void>((resolve, reject) => {
    deflate.on('end', resolve);
    deflate.on('error', reject);
  });
  let crc = 0;
  let size = 0;
  for (const chunk of chunks) {
    crc = crc32(chunk, crc);
    size += chunk.length;
    if (!deflate.write(chunk)) await new Promise((r) => deflate.once('drain', r));
  }
  deflate.end();
  await done;
  return { name: Buffer.from(name), crc, size, data: Buffer.concat(out) };
}

function zip(entries: ZipEntry[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // versi minimum
    local.writeUInt16LE(0x0800, 6); // nama file UTF-8
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(0, 10); // jam
    local.writeUInt16LE(0x21, 12); // tanggal 1980-01-01
    local.writeUInt32LE(e.crc, 14);
    local.writeUInt32LE(e.data.length, 18);
    local.writeUInt32LE(e.size, 22);
    local.writeUInt16LE(e.name.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, e.name, e.data);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(0x0800, 8);
    dir.writeUInt16LE(8, 10);
    dir.writeUInt16LE(0, 12);
    dir.writeUInt16LE(0x21, 14);
    dir.writeUInt32LE(e.crc, 16);
    dir.writeUInt32LE(e.data.length, 20);
    dir.writeUInt32LE(e.size, 24);
    dir.writeUInt16LE(e.name.length, 28);
    dir.writeUInt32LE(offset, 42);
    central.push(dir, e.name);
    offset += local.length + e.name.length + e.data.length;
  }
  const centralSize = central.reduce((s, b) => s + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, ...central, end]);
}

function escapeXml(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function cellXml(value: XlsxCell, style: number): string {
  if (value === null || value === undefined || value === '') return '<c/>';
  if (typeof value === 'number' && Number.isFinite(value)) return `<c${style ? ` s="${style}"` : ''}><v>${value}</v></c>`;
  // Teks (termasuk no. HP) disimpan sebagai string agar Excel tidak mengubahnya menjadi angka.
  return `<c t="inlineStr"${style ? ` s="${style}"` : ''}><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`;
}

function colName(index: number): string {
  let s = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function* sheetChunks(columns: XlsxColumn[], rows: XlsxCell[][]): Generator<Buffer> {
  const cols = columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width ?? 14}" customWidth="1"/>`).join('');
  yield Buffer.from(
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
      `<cols>${cols}</cols><sheetData>` +
      `<row>${columns.map((c) => cellXml(c.header, 1)).join('')}</row>`,
  );
  const styles = columns.map((c) => (c.money ? 2 : 0));
  for (let i = 0; i < rows.length; i += 1000) {
    let xml = '';
    for (const row of rows.slice(i, i + 1000)) xml += `<row>${row.map((v, j) => cellXml(v, styles[j])).join('')}</row>`;
    yield Buffer.from(xml);
  }
  yield Buffer.from(`</sheetData><autoFilter ref="A1:${colName(columns.length - 1)}${rows.length + 1}"/></worksheet>`);
}

const STATIC_FILES: [string, string][] = [
  [
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
  ],
  [
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  ],
  [
    'xl/_rels/workbook.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
  ],
  [
    'xl/styles.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
      '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
      '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      '<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
  ],
];

/** File .xlsx berisi satu sheet. */
export async function buildXlsx(sheetName: string, columns: XlsxColumn[], rows: XlsxCell[][]): Promise<Buffer> {
  const workbook =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets><sheet name="${escapeXml(sheetName.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets>` +
    '<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">' +
    `'${escapeXml(sheetName.slice(0, 31))}'!$A$1:$${colName(columns.length - 1)}$${rows.length + 1}</definedName></definedNames></workbook>`;
  const entries = [
    ...(await Promise.all(STATIC_FILES.map(([name, xml]) => deflateEntry(name, [Buffer.from(xml)])))),
    await deflateEntry('xl/workbook.xml', [Buffer.from(workbook)]),
    await deflateEntry('xl/worksheets/sheet1.xml', sheetChunks(columns, rows)),
  ];
  return zip(entries);
}
