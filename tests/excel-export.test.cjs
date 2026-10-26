"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildWorkbook } = require("../excel-export.js");
const XLSX = require("../vendor/xlsx-0.20.3.mini.min.js");
const TreasuryImport = require("../treasury-import.js");

const record = (extra = {}) => ({
  date: "2026-10-25", concept: "Pago de prueba", type: "Pago", status: "Confirmado",
  amount: 100.49, bank: "Banco A", category: "Gastos", fromBank: "", toBank: "", id: "mov-test", ...extra,
});

// Read the ZIP structure independently from the exporter. CRC is calculated
// bit-by-bit here instead of sharing the writer's lookup table or functions.
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function readZip(bytes) {
  assert.ok(bytes instanceof Uint8Array);
  const data = Buffer.from(bytes);
  const end = data.length - 22;
  assert.equal(data.readUInt32LE(end), 0x06054b50, "ZIP end record");
  const count = data.readUInt16LE(end + 10);
  const size = data.readUInt32LE(end + 12);
  const start = data.readUInt32LE(end + 16);
  assert.equal(start + size, end, "central directory bounds");
  const files = new Map();
  let offset = start;
  for (let index = 0; index < count; index += 1) {
    assert.equal(data.readUInt32LE(offset), 0x02014b50);
    assert.equal(data.readUInt16LE(offset + 10), 0, "stored compression method");
    const length = data.readUInt32LE(offset + 24);
    assert.equal(data.readUInt32LE(offset + 20), length);
    const nameLength = data.readUInt16LE(offset + 28);
    const name = data.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    const local = data.readUInt32LE(offset + 42);
    assert.equal(data.readUInt32LE(local), 0x04034b50);
    assert.equal(data.readUInt32LE(local + 22), length);
    const contentStart = local + 30 + data.readUInt16LE(local + 26) + data.readUInt16LE(local + 28);
    const content = data.subarray(contentStart, contentStart + length);
    assert.equal(crc32(content), data.readUInt32LE(offset + 16), `CRC ${name}`);
    assert.equal(data.readUInt32LE(local + 14), data.readUInt32LE(offset + 16));
    files.set(name, content.toString("utf8"));
    offset += 46 + nameLength + data.readUInt16LE(offset + 30) + data.readUInt16LE(offset + 32);
  }
  assert.equal(offset, end);
  return files;
}

test("Excel: creates an actual OOXML package with consistent ZIP CRCs and relationships", () => {
  const files = readZip(buildWorkbook([record()]));
  assert.equal(files.size, 6);
  assert.match(files.get("[Content_Types].xml"), /spreadsheetml\.sheet\.main\+xml/);
  assert.match(files.get("_rels/.rels"), /Target="xl\/workbook.xml"/);
  assert.match(files.get("xl/_rels/workbook.xml.rels"), /Target="worksheets\/sheet1.xml"/);
  assert.match(files.get("xl/workbook.xml"), /sheet name="Movimientos" sheetId="1" r:id="rId1"/);
});

test("Excel: preserves cents as numeric data and supplies a two-decimal accounting MXN format", () => {
  const files = readZip(buildWorkbook([record({ amount: 0.01 }), record({ amount: 999999.99 }), record({ amount: 100.49 })]));
  const sheet = files.get("xl/worksheets/sheet1.xml");
  assert.match(sheet, /<c r="E2" s="3" t="n"><v>0\.01<\/v><\/c>/);
  assert.match(sheet, /<c r="E3" s="3" t="n"><v>999999\.99<\/v><\/c>/);
  assert.match(sheet, /<c r="E4" s="3" t="n"><v>100\.49<\/v><\/c>/);
  assert.match(files.get("xl/styles.xml"), /formatCode="_\(&quot;MXN&quot;\* #,##0\.00_\);_\(&quot;MXN&quot;\* \(#,##0\.00\);_\(&quot;MXN&quot;\* &quot;-&quot;\?\?_\);_\(@_\)"/);
});

test("Excel: independent reader applies accounting display without changing numeric amounts", () => {
  const amounts = [0, 0.01, 1234.5, 268435456.03, 536870912.05, 10000000000.03];
  const workbook = XLSX.read(buildWorkbook(amounts.map(amount => record({ amount }))), {
    type: "array", cellNF: true, cellText: true,
  });
  const sheet = workbook.Sheets.Movimientos;
  const cells = amounts.map((_, index) => sheet[`E${index + 2}`]);
  assert.deepEqual(cells.map(cell => cell.t), amounts.map(() => "n"));
  assert.deepEqual(cells.map(cell => cell.v), amounts, "formatting must not round or stringify stored values");
  const compact = text => text.replace(/\s/g, "");
  assert.deepEqual(cells.map(cell => compact(cell.w)), [
    "MXN-", "MXN0.01", "MXN1,234.50", "MXN268,435,456.03", "MXN536,870,912.05", "MXN10,000,000,000.03",
  ]);
  const format = cells[0].z;
  assert.equal(format.split(";").length, 4);
  assert.ok(format.includes("* "), "the accounting currency label has fill spacing");
  // Movement magnitudes remain nonnegative; exercise the cell style's negative
  // and text sections independently for later calculations or edits in Excel.
  assert.equal(compact(XLSX.SSF.format(format, -1234.56)), "MXN(1,234.56)");
  assert.equal(compact(XLSX.SSF.format(format, -0.01)), "MXN(0.01)");
  assert.equal(XLSX.SSF.format(format, "Referencia").trim(), "Referencia");
});

test("Excel: accounting-formatted exports import back with the same cents and movement signs", async () => {
  const rows = [
    record({ id: "payment", type: "Pago", amount: 1234.56 }),
    record({ id: "receipt", type: "Cobro", amount: 0.01, bank: "", category: "" }),
    record({ id: "transfer", type: "Traspaso", amount: 268435456.03, bank: "", category: "", fromBank: "Banco A", toBank: "Banco B" }),
  ];
  const imported = await TreasuryImport.readXlsx(buildWorkbook(rows));
  const sheet = imported.sheets[0];
  const report = TreasuryImport.preview(sheet, {
    headerRow: 1, mapping: TreasuryImport.suggestMapping(sheet, { headerRow: 1 }),
    dateOrder: "DMY", numberFormat: "es-MX",
  }, {
    accounts: [{ id: "bank-a", name: "Banco A" }, { id: "bank-b", name: "Banco B" }],
    categories: [{ id: "gastos", label: "Gastos" }],
    existingMovements: [], todayISO: "2026-10-25", minDate: "2026-10-25",
  });
  assert.equal(report.summary.valid, 3);
  assert.equal(report.summary.invalid, 0);
  assert.deepEqual(report.rows.map(row => row.movement.amount), rows.map(row => row.amount));
  assert.deepEqual(report.rows.map(row => row.movement.type), ["outflow", "inflow", "transfer"]);
  assert.equal(report.rows[0].movement.bankId, "bank-a");
  assert.equal(report.rows[2].movement.fromBankId, "bank-a");
  assert.equal(report.rows[2].movement.toBankId, "bank-b");
});

test("Excel: serializes dates as numeric Excel dates without time-zone drift", () => {
  const rows = ["1900-01-01", "1900-02-28", "1900-03-01", "2026-10-25", "2028-02-29"].map(date => record({ date }));
  const sheet = readZip(buildWorkbook(rows)).get("xl/worksheets/sheet1.xml");
  const serials = [...sheet.matchAll(/<c r="A\d+" s="2" t="n"><v>(\d+)<\/v>/g)].map(match => Number(match[1]));
  assert.deepEqual(serials, [1, 59, 61, 46320, 46812]);
});

test("Excel: escapes text and preserves Spanish, emoji, whitespace and formula-looking text as strings", () => {
  const values = ["Nómina & crédito <A> \"B\" 'C' 🏦", "=HYPERLINK(\"https://example.invalid\",\"texto\")", "+SUM(A1:A2)", "@SUM(A1)", "-2+3", " texto \n multilínea "];
  const sheet = readZip(buildWorkbook(values.map(concept => record({ concept })))).get("xl/worksheets/sheet1.xml");
  assert.match(sheet, /Nómina &amp; crédito &lt;A&gt; &quot;B&quot; &apos;C&apos; 🏦/);
  assert.match(sheet, /<c r="B3" s="0" t="inlineStr"><is><t xml:space="preserve">=HYPERLINK/);
  assert.match(sheet, /\+SUM\(A1:A2\)/);
  assert.match(sheet, /@SUM\(A1\)/);
  assert.match(sheet, / texto \n multilínea /);
  assert.doesNotMatch(sheet, /<f[ >]/);
  assert.doesNotMatch(sheet, /<hyperlink[ >]/);
});

test("Excel: includes optional bank/category and both transfer endpoints without duplicating the movement", () => {
  const sheet = readZip(buildWorkbook([record({ type: "Traspaso", bank: "Banco A → Banco B", category: "", fromBank: "Banco A", toBank: "Banco B", id: "transfer-123" })])).get("xl/worksheets/sheet1.xml");
  assert.equal((sheet.match(/<row /g) || []).length, 2);
  assert.match(sheet, /<c r="H2"[^>]*><is><t[^>]*>Banco A<\/t>/);
  assert.match(sheet, /<c r="I2"[^>]*><is><t[^>]*>Banco B<\/t>/);
  assert.match(sheet, /<c r="J2"[^>]*><is><t[^>]*>transfer-123<\/t>/);
});

test("Excel: empty exports remain valid header-only workbooks with freeze panes and filters", () => {
  const sheet = readZip(buildWorkbook([])).get("xl/worksheets/sheet1.xml");
  assert.match(sheet, /dimension ref="A1:J1"/);
  assert.match(sheet, /autoFilter ref="A1:J1"/);
  assert.match(sheet, /ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/);
  assert.match(sheet, />Importe \(MXN\)<\/t>/);
  assert.match(sheet, />Categoría<\/t>/);
  assert.equal((sheet.match(/<row /g) || []).length, 1);
});

test("Excel: rejects invalid inputs rather than truncating or emitting broken cells", () => {
  for (const date of ["", "2027-02-29", "2026-13-01", "1899-12-31", "2026-1-01"]) {
    assert.throws(() => buildWorkbook([record({ date })]), /fecha/);
  }
  for (const amount of [NaN, Infinity, -1, "100.25", 1e13]) {
    assert.throws(() => buildWorkbook([record({ amount })]), /importe/);
  }
  assert.throws(() => buildWorkbook(null), /lista/);
  assert.throws(() => buildWorkbook([null]), /movimiento/);
  assert.throws(() => buildWorkbook([record({ concept: "a".repeat(32768) })]), /límite/);
  assert.throws(() => buildWorkbook([record({ concept: "nulo\u0000" })]), /caracteres/);
  assert.throws(() => buildWorkbook([record({ concept: "\ud800" })]), /caracteres/);
});

test("Excel: never mutates source rows and exports deterministically", () => {
  const rows = [Object.freeze(record({ concept: "=literal" }))];
  Object.freeze(rows);
  const before = JSON.stringify(rows);
  assert.deepEqual(buildWorkbook(rows), buildWorkbook(rows));
  assert.equal(JSON.stringify(rows), before);
});

test("Excel: literal OOXML escape sequences are protected against Excel decoding", () => {
  const sheet = readZip(buildWorkbook([record({ concept: "Código _x0041_ y _x005F_" })])).get("xl/worksheets/sheet1.xml");
  assert.match(sheet, /Código _x005F_x0041_ y _x005F_x005F_/);
});
