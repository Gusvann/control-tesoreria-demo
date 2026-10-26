"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");
const crypto = require("node:crypto");
const importer = require("../treasury-import.js");
const { buildWorkbook } = require("../excel-export.js");

const root = path.join(__dirname, "..");
const today = "2026-10-26";
const accounts = [{ id: "bank-a", name: "Banco A" }, { id: "bank-b", name: "Banco B" }];
const categories = [{ id: "costos", label: "Costos" }, { id: "gastos", label: "Gastos" }, { id: "nomina", label: "Nómina" }];
const context = (extra = {}) => ({ accounts, categories, existingMovements: [], todayISO: today, minDate: today, ...extra });
const record = (extra = {}) => ({ date: today, concept: "Pago de prueba", type: "Pago", status: "Confirmado", amount: 1250.75, bank: "Banco A", category: "Gastos", id: "source-1", ...extra });
const cells = (rows, extra = {}) => ({ name: "Prueba", date1904: false, rows: rows.map(row => row.map(value => value && typeof value === "object" ? value : ({ value }))), ...extra });
const simpleSheet = (rows, extra = {}) => cells([["Fecha", "Concepto", "Importe"], ...rows], extra);
const preview = (sheet, options = {}, extraContext = {}) => importer.preview(sheet, options, context(extraContext));
const fixture = name => fs.readFileSync(path.join(__dirname, "fixtures", name));

// A separate ZIP implementation builds adversarial packages and data-descriptor
// variants. It does not reuse the production importer's CRC or ZIP routines.
function crc32(data) {
  let value = 0xffffffff;
  for (const byte of data) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function storedParts(bytes) {
  const buffer = Buffer.from(bytes);
  const parts = [];
  let offset = 0;
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(buffer.readUInt16LE(offset + 8), 0, "The reference exporter uses stored ZIP entries");
    const length = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const start = offset + 30 + nameLength + extraLength;
    parts.push({ name: buffer.toString("utf8", offset + 30, offset + 30 + nameLength), data: buffer.subarray(start, start + length) });
    offset = start + length;
  }
  return parts;
}

function zip(parts, options = {}) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const entry of parts) {
    const data = Buffer.from(entry.data);
    const name = Buffer.from(entry.name);
    const method = entry.method ?? options.method ?? 8;
    const payload = method === 8 ? zlib.deflateRawSync(data) : data;
    const size = entry.declaredSize ?? data.length;
    const crc = entry.crc ?? crc32(data);
    const descriptor = Boolean(options.descriptors);
    const flags = entry.flags ?? (0x800 | (descriptor ? 8 : 0));
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(flags, 6);
    header.writeUInt16LE(method, 8);
    header.writeUInt32LE(descriptor ? 0 : crc, 14);
    header.writeUInt32LE(descriptor ? 0 : payload.length, 18);
    header.writeUInt32LE(descriptor ? 0 : size, 22);
    header.writeUInt16LE(name.length, 26);
    const tail = descriptor ? Buffer.alloc(16) : Buffer.alloc(0);
    if (descriptor) {
      tail.writeUInt32LE(0x08074b50, 0);
      tail.writeUInt32LE(crc, 4);
      tail.writeUInt32LE(payload.length, 8);
      tail.writeUInt32LE(size, 12);
    }
    local.push(header, name, payload, tail);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(flags, 8);
    directory.writeUInt16LE(method, 10);
    directory.writeUInt32LE(crc, 16);
    directory.writeUInt32LE(payload.length, 20);
    directory.writeUInt32LE(size, 24);
    directory.writeUInt16LE(name.length, 28);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, name);
    offset += header.length + name.length + payload.length + tail.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(parts.length, 8);
  end.writeUInt16LE(parts.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}

function modifiedWorkbook(transform, options) {
  const parts = storedParts(buildWorkbook([record()]));
  return zip(transform(parts), options);
}

test("Import XLSX: pinned vendor matches its official version and recorded digest", () => {
  const bytes = fs.readFileSync(path.join(root, "vendor", "xlsx-0.20.3.mini.min.js"));
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), "0cb353f830d7288385492c83d277b058ddeac664ca51cf1393aa1fd3e2b70939");
  assert.equal(require("../vendor/xlsx-0.20.3.mini.min.js").version, "0.20.3");
  assert.match(fs.readFileSync(path.join(root, "vendor", "SHEETJS-LICENSE.txt"), "utf8"), /Apache License/);
});

test("Import XLSX: round trip preserves cents, dates, literal formula-like text and optional fields", async () => {
  const original = [record({ concept: '=SUM(1,2) á & < > "', amount: 0.01, bank: "", category: "" }),
    record({ id: "other", concept: "Cobro", type: "Cobro", amount: 999999.99, bank: "", category: "" })];
  const document = await importer.readXlsx(buildWorkbook(original));
  assert.deepEqual(document.sheets.map(sheet => sheet.name), ["Movimientos"]);
  const report = preview(document.sheets[0]);
  assert.deepEqual(report.summary, { valid: 2, invalid: 0, possibleDuplicates: 0, empty: 0 });
  assert.equal(report.rows[0].movement.date, today);
  assert.equal(report.rows[0].movement.concept, original[0].concept);
  assert.equal(report.rows[0].movement.amount, 0.01);
  assert.equal(report.rows[1].movement.amount, 999999.99);
  assert.equal(report.rows[1].movement.type, "inflow");
  assert.equal(report.rows[0].movement.bankId, undefined);
  assert.equal(report.rows[0].movement.id, undefined);
  assert.equal(report.rows[0].sourceId, "source-1");
  assert.equal(report.rows[0].warnings.length, 0);
});

test("Import XLSX: independent compressed Excel-style workbook supports shared strings, sheets, dates and cached formula values", async () => {
  const document = await importer.readXlsx(fixture("import-normal.xlsx"));
  assert.deepEqual(document.sheets.map(sheet => sheet.name), ["Pagos y nómina", "Traspasos", "Auxiliar"]);
  assert.equal(document.sheets[2].hidden, true);
  assert.ok(document.warnings.some(warning => warning.code === "EXTERNAL_LINKS_IGNORED"));
  const report = preview(document.sheets[0]);
  assert.deepEqual(report.summary, { valid: 4, invalid: 1, possibleDuplicates: 0, empty: 0 });
  assert.deepEqual(report.rows[0].movement, { date: today, concept: "Nómina Águila & asociados <A>", amount: 45000.5,
    type: "outflow", status: "pending", bankId: "bank-a", categoryId: "nomina" });
  assert.match(report.rows[1].movement.concept, /^=HYPERLINK/);
  assert.equal(report.rows[1].warnings.length, 0, "A string beginning with = is not a formula");
  assert.equal(report.rows[2].movement.amount, 1234.5);
  assert.ok(report.rows[2].warnings.some(warning => warning.code === "FORMULA_CACHED_VALUE"));
  assert.equal(report.rows[3].movement, null);
  assert.ok(report.rows[3].errors.some(error => error.code === "CELL_ERROR"));
  assert.equal(report.rows[4].movement.concept, "Proveedor con enlace");
  assert.ok(!JSON.stringify(document.sheets).includes("never-request"), "Hyperlink metadata must not reach the UI");
  const transfer = preview(document.sheets[1]).rows[0].movement;
  assert.deepEqual(transfer, { date: "2026-10-28", concept: "Entre cuentas", type: "transfer", status: "confirmed", amount: 1250.75, fromBankId: "bank-a", toBankId: "bank-b" });
});

test("Import XLSX: 1904 and leap-day dates preserve their civil date", async () => {
  const document = await importer.readXlsx(fixture("import-1904.xlsx"));
  const sheet = document.sheets[0];
  assert.equal(sheet.date1904, true);
  assert.equal(sheet.rows[1][0].dateISO, "2028-02-29");
  assert.equal(sheet.rows[2][0].dateISO, "1904-01-01");
  const report = preview(sheet, {}, { minDate: null });
  assert.deepEqual(report.rows.map(row => row.movement.date), ["2028-02-29", "1904-01-01"]);
  assert.ok(report.rows[1].warnings.some(warning => warning.code === "HISTORICAL_DATE"));
});

test("Import XLSX: compressed ZIP data descriptors are accepted", async () => {
  const bytes = zip(storedParts(buildWorkbook([record()])), { descriptors: true });
  const document = await importer.readXlsx(bytes);
  assert.equal(preview(document.sheets[0]).rows[0].movement.amount, 1250.75);
});

test("Import XLSX: unused macro content-type defaults do not reject an ordinary SheetJS workbook", async () => {
  const XLSX = require("../vendor/xlsx-0.20.3.mini.min.js");
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["Fecha", "Concepto", "Importe"], [today, "Libro normal", 10.01]]), "Normal");
  const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx", compression: true });
  const document = await importer.readXlsx(bytes);
  assert.equal(preview(document.sheets[0]).rows[0].movement.amount, 10.01);
  const macro = modifiedWorkbook(parts => parts.map(part => part.name === "[Content_Types].xml" ? {
    ...part, data: part.data.toString().replace("spreadsheetml.sheet.main+xml", "ms-excel.sheet.macroEnabled.main+xml"),
  } : part));
  await assert.rejects(importer.readXlsx(macro), error => error.code === "MACROS");
});

test("Import XLSX: a formula without a cached value cannot silently become an amount", async () => {
  const bytes = modifiedWorkbook(parts => parts.map(part => part.name.endsWith("sheet1.xml") ? {
    ...part, data: part.data.toString().replace(/<c r="E2"[^>]*>.*?<\/c>/, '<c r="E2"><f>1+1</f></c>'),
  } : part));
  const document = await importer.readXlsx(bytes);
  const row = preview(document.sheets[0]).rows[0];
  assert.equal(row.movement, null);
  assert.ok(row.errors.some(error => error.code === "FORMULA_NO_VALUE"));
});

test("Import text: TSV quoting preserves embedded tabs, newlines and literal symbols", () => {
  const document = importer.parseText('\uFEFFFecha\tConcepto\tImporte\r\n26/10/2026\t"Pago\tcon detalle\nsegunda línea"\t1,234.56\r\n27/10/2026\t=1+1\t0.01\r\n');
  assert.equal(document.delimiter, "\t");
  assert.equal(document.sheets[0].rows.length, 3);
  const report = preview(document.sheets[0]);
  assert.equal(report.rows[0].movement.concept, "Pago\tcon detalle\nsegunda línea");
  assert.equal(report.rows[0].movement.amount, 1234.56);
  assert.equal(report.rows[1].movement.concept, "=1+1");
  assert.equal(report.rows[1].movement.amount, 0.01);
});

test("Import text: CSV and semicolon formats preserve quoted commas and decimal-comma amounts", () => {
  const csv = importer.parseText('Fecha,Concepto,Importe\n2026-10-26,"Pago, equipo ""A""","$1,234.56"');
  assert.equal(csv.delimiter, ",");
  assert.equal(preview(csv.sheets[0]).rows[0].movement.concept, 'Pago, equipo "A"');
  const semicolon = importer.parseText('Fecha;Concepto;Importe\n26/10/2026;"Pago; equipo";1.234,56');
  assert.equal(semicolon.delimiter, ";");
  assert.equal(preview(semicolon.sheets[0], { numberFormat: "es-ES" }).rows[0].movement.amount, 1234.56);
  assert.equal(preview(semicolon.sheets[0]).rows[0].movement, null, "Numeric locales must not be guessed silently");
});

test("Import text: malformed quoting and excessive rows/columns are rejected without truncation", () => {
  for (const text of ['a,b\n"missing,b', 'a,b\n"closed"trailing,b', 'a,b\nno"quote,b']) assert.throws(() => importer.parseText(text), error => error.code === "TEXT_QUOTES");
  assert.throws(() => importer.parseText(Array(51).fill("x").join("\t")), error => error.code === "COLUMN_LIMIT");
  assert.throws(() => importer.parseText(Array(5002).fill("x").join("\n")), error => error.code === "ROW_LIMIT");
  assert.equal(importer.parseText("").sheets[0].rows.length, 0);
});

test("Import mapping: aliases, repeated headings and headerless tables have explicit contracts", () => {
  const sheet = cells([["Fecha de pago", "Descripción", "Monto (MXN)", "Banco origen", "Banco destino", "Categoría", "ID"]]);
  assert.deepEqual(importer.suggestMapping(sheet), { date: 0, concept: 1, type: null, status: null, amount: 2, bank: null, category: 5, fromBank: 3, toBank: 4, sourceId: 6 });
  assert.equal(importer.suggestMapping(cells([["Fecha", "Concepto", "Importe", "Importe"]])).amount, null);
  const noHeader = cells([[today, "Sin encabezados", "125.50"]]);
  const result = preview(noHeader, { headerRow: 0, mapping: { date: 0, concept: 1, amount: 2 }, defaults: { type: "inflow", status: "pending" } });
  assert.equal(result.rows[0].rowNumber, 1);
  assert.equal(result.rows[0].movement.type, "inflow");
  assert.equal(result.rows[0].movement.status, "pending");
  assert.throws(() => preview(noHeader, { headerRow: 0 }), error => error.code === "MAPPING");
  assert.throws(() => preview(simpleSheet([[today, "Pago", 1]]), { mapping: { date: 0, concept: 1, amount: 1 } }), error => error.code === "MAPPING");
});

test("Import validation: date order is explicit, impossible dates fail, and old dates require permission", () => {
  const sheet = simpleSheet([["02/03/2028", "Ambigua", 1], ["29/02/2027", "Imposible", 2], ["2026-10-25", "Histórico", 3]]);
  const dmy = preview(sheet);
  assert.equal(dmy.rows[0].movement.date, "2028-03-02");
  assert.equal(preview(sheet, { dateOrder: "MDY" }).rows[0].movement.date, "2028-02-03");
  assert.ok(dmy.rows[1].errors.some(error => error.code === "INVALID_DATE"));
  assert.ok(dmy.rows[2].errors.some(error => error.code === "PAST_DATE"));
  const historical = preview(sheet, {}, { minDate: null });
  assert.equal(historical.rows[2].movement.date, "2026-10-25");
  assert.ok(historical.rows[2].warnings.some(warning => warning.code === "HISTORICAL_DATE"));
});

test("Import validation: Excel's fictitious leap day is rejected and time removal is visible", () => {
  const sheet = simpleSheet([[60, "Fecha inexistente", 1], [46321.5, "Mediodía", 2]]);
  const report = preview(sheet, {}, { minDate: null });
  assert.equal(report.rows[0].movement, null);
  assert.equal(report.rows[1].movement.date, today);
  assert.ok(report.rows[1].warnings.some(warning => warning.code === "TIME_IGNORED"));
});

test("Import validation: positive two-decimal amounts are exact and invalid formats never round into valid rows", () => {
  const valid = ["0.01", "$1,234.56", "MXN 999,999.99", "9999999999999.99", 0.1 + 0.2, 123456789.12];
  const invalid = ["0", "-1", "(1.00)", "1.001", "1,23.00", "1e3", "NaN", 12.345, 1e13, true, Infinity];
  const report = preview(simpleSheet([...valid, ...invalid].map((amount, index) => [today, `Importe ${index}`, amount])));
  assert.equal(report.summary.valid, valid.length);
  assert.equal(report.summary.invalid, invalid.length);
  assert.deepEqual(report.rows.slice(0, valid.length).map(row => row.movement.amount), [0.01, 1234.56, 999999.99, 9999999999999.99, 0.3, 123456789.12]);
  assert.ok(report.rows.slice(valid.length).every(row => row.errors.some(error => error.code === "INVALID_AMOUNT")));
});

test("Import validation: optional references resolve existing IDs and ambiguous or unknown labels are errors", () => {
  const sheet = cells([["Fecha", "Concepto", "Importe", "Banco", "Categoría"],
    [today, "Opcional", 1, "", "Sin categoría"],
    [today, "Asignado", 2, "banco á", "nomina"],
    [today, "Desconocido", 3, "Banco nuevo", "Nueva categoría"],
    [today, "Retirado", 4, "Banco no disponible", ""]]);
  const report = preview(sheet);
  assert.equal(report.rows[0].movement.bankId, undefined);
  assert.equal(report.rows[0].movement.categoryId, undefined);
  assert.equal(report.rows[1].movement.bankId, "bank-a");
  assert.equal(report.rows[1].movement.categoryId, "nomina");
  assert.equal(report.rows[2].movement, null);
  assert.equal(report.rows[2].errors.filter(error => error.code === "UNKNOWN_REFERENCE").length, 2);
  assert.equal(report.rows[3].movement.bankId, undefined);
  assert.ok(report.rows[3].warnings.some(warning => warning.code === "BANK_UNAVAILABLE"));
  const ambiguous = preview(sheet, {}, { accounts: [...accounts, { id: "bank-extra", name: "Banco Á" }] });
  assert.ok(ambiguous.rows[1].errors.some(error => error.code === "AMBIGUOUS_REFERENCE"));
  const crossed = preview(cells([["Fecha", "Concepto", "Importe", "Banco", "Categoría"], [today, "No confundir campos", 1, "Sin categoría", "Sin banco"]]));
  assert.equal(crossed.rows[0].errors.filter(error => error.code === "UNKNOWN_REFERENCE").length, 2);
});

test("Import validation: transfer endpoints are existing and distinct; unrelated metadata is only reported", () => {
  const sheet = cells([["Fecha", "Concepto", "Importe", "Tipo", "Banco origen", "Banco destino", "Categoría"],
    [today, "Válido", 30, "Traspaso", "Banco A", "Banco B", "Gastos"],
    [today, "Misma cuenta", 30, "Traspaso", "Banco A", "bank-a", ""],
    [today, "Sin destino", 30, "Traspaso", "Banco A", "", ""]]);
  const report = preview(sheet);
  assert.equal(report.rows[0].movement.fromBankId, "bank-a");
  assert.equal(report.rows[0].movement.toBankId, "bank-b");
  assert.equal(report.rows[0].movement.categoryId, undefined);
  assert.ok(report.rows[0].warnings.some(warning => warning.code === "FIELD_NOT_APPLICABLE"));
  assert.ok(report.rows[1].errors.some(error => error.code === "SAME_BANK"));
  assert.ok(report.rows[2].errors.some(error => error.code === "REQUIRED_BANK"));
});

test("Import validation: duplicate detection annotates existing and imported rows without dropping or updating them", () => {
  const sheet = cells([["Fecha", "Concepto", "Importe", "ID"], [today, "Nómina", 100, "old-id"], [today, " NÓMINA ", 100, "new-id"], [today, "Otro pago", 200, "old-id"], ["", "", "", ""]]);
  const existing = [{ id: "old-id", date: today, concept: "Nomina", amount: 100, type: "outflow", status: "pending" }];
  const before = JSON.stringify(existing);
  const report = preview(sheet, {}, { existingMovements: existing });
  assert.equal(report.rows.length, 3);
  assert.equal(report.summary.valid, 3);
  assert.equal(report.summary.empty, 1);
  assert.equal(report.summary.possibleDuplicates, 3);
  assert.ok(report.rows[0].duplicates.some(duplicate => duplicate.source === "existing" && duplicate.id === "old-id"));
  assert.ok(report.rows[1].duplicates.some(duplicate => duplicate.source === "import" && duplicate.rowNumber === 2));
  assert.ok(report.rows[2].duplicates.some(duplicate => duplicate.reason === "id"));
  assert.ok(report.rows.every(row => !Object.hasOwn(row.movement, "id")));
  assert.equal(JSON.stringify(existing), before);
});

test("Import validation: invalid rows remain visible, input data is immutable, and no records are persisted", () => {
  const sheet = simpleSheet([[today, "a".repeat(71), 1], [today, "Válido", 2], ["", "", ""]]);
  const before = JSON.stringify(sheet);
  const originalAccounts = JSON.stringify(accounts);
  const report = preview(sheet);
  assert.equal(report.rows.length, 2);
  assert.equal(report.rows[0].rowNumber, 2);
  assert.equal(report.rows[0].movement, null);
  assert.equal(report.rows[1].movement.concept, "Válido");
  assert.deepEqual(report.summary, { valid: 1, invalid: 1, possibleDuplicates: 0, empty: 1 });
  assert.equal(JSON.stringify(sheet), before);
  assert.equal(JSON.stringify(accounts), originalAccounts);
});

test("Import limits: byte limits and non-XLSX inputs fail before workbook parsing", async () => {
  await assert.rejects(importer.readXlsx(new Uint8Array(importer.limits.fileBytes + 1)), error => error.code === "FILE_LIMIT");
  await assert.rejects(importer.readXlsx(new Uint8Array()), error => error.code === "EMPTY_FILE");
  await assert.rejects(importer.readXlsx(Buffer.from("This is not a spreadsheet file.")), error => error.code === "UNSUPPORTED_FILE");
  assert.throws(() => importer.parseText("x".repeat(importer.limits.fileBytes + 1)), error => error.code === "FILE_LIMIT");
});

test("Import ZIP: CRC, duplicate paths, encryption and declared expansion limits are checked", async () => {
  const parts = storedParts(buildWorkbook([record()]));
  for (const entries of [
    parts.map((part, index) => index ? part : { ...part, crc: 0 }),
    [...parts, parts[0]],
    parts.map((part, index) => index ? part : { ...part, flags: 0x801 }),
    parts.map((part, index) => index ? part : { ...part, declaredSize: importer.limits.entryBytes + 1 }),
  ]) await assert.rejects(importer.readXlsx(zip(entries)));
});

test("Import ZIP: actual inflation beyond forged size is stopped and DTD declarations are rejected", async () => {
  const bomb = modifiedWorkbook(parts => parts.map(part => part.name.endsWith("sheet1.xml") ? { ...part, data: Buffer.from("a".repeat(200000)), declaredSize: 3 } : part));
  await assert.rejects(importer.readXlsx(bomb), error => error.code === "EXPANDED_LIMIT");
  const entity = modifiedWorkbook(parts => parts.map(part => part.name.endsWith("sheet1.xml") ? { ...part, data: '<!DOCTYPE worksheet [<!ENTITY test "a">]>' + part.data.toString() } : part));
  await assert.rejects(importer.readXlsx(entity), error => error.code === "XML_DECLARATION");
});

test("Import XLSX: cells past row or column limits fail instead of being hidden by sheetRows", async () => {
  for (const reference of ["A5002", "AY2"]) {
    const bytes = modifiedWorkbook(parts => parts.map(part => part.name.endsWith("sheet1.xml") ? {
      ...part, data: part.data.toString().replace('r="A2"', `r="${reference}"`),
    } : part));
    await assert.rejects(importer.readXlsx(bytes), error => error.code === "SHEET_LIMIT");
  }
  const file = buildWorkbook([]);
  const document = await importer.readXlsx(file);
  assert.equal(preview(document.sheets[0]).rows.length, 0);
});

function browserHarness(behavior) {
  const workers = [];
  class Worker {
    constructor(url) { this.url = String(url); this.terminated = false; workers.push(this); }
    postMessage(message) { this.message = message; behavior?.(this); }
    terminate() { this.terminated = true; }
  }
  const sandbox = vm.createContext({ Worker, URL, TextEncoder, TextDecoder, setTimeout, clearTimeout,
    document: { currentScript: { src: "https://example.invalid/control-tesoreria-demo/treasury-import.js" } } });
  vm.runInContext(fs.readFileSync(path.join(root, "treasury-import.js"), "utf8"), sandbox);
  return { api: sandbox.TreasuryImport, workers };
}

test("Import Worker: URL stays under the repository, bytes are copied, and success terminates the worker", async () => {
  const document = { kind: "xlsx", sheets: [], warnings: [] };
  const { api, workers } = browserHarness(worker => queueMicrotask(() => worker.onmessage({ data: { ok: true, document } })));
  const bytes = buildWorkbook([]);
  const before = Buffer.from(bytes);
  assert.equal(await api.readXlsx(bytes), document);
  assert.equal(workers[0].url, "https://example.invalid/control-tesoreria-demo/treasury-import-worker.js");
  assert.equal(workers[0].message.type, "read-xlsx");
  assert.equal(workers[0].terminated, true);
  assert.deepEqual(Buffer.from(bytes), before);
});

test("Import Worker: abort, timeout and worker failure terminate work without returning partial documents", async () => {
  const cancelled = browserHarness();
  const controller = new AbortController();
  const pending = cancelled.api.readXlsx(buildWorkbook([]), { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, error => error.name === "AbortError");
  assert.equal(cancelled.workers[0].terminated, true);
  const timed = browserHarness();
  await assert.rejects(timed.api.readXlsx(buildWorkbook([]), { timeoutMs: 1 }), error => error.code === "TIMEOUT");
  assert.equal(timed.workers[0].terminated, true);
  const broken = browserHarness(worker => queueMicrotask(() => worker.onerror({})));
  await assert.rejects(broken.api.readXlsx(buildWorkbook([])), error => error.code === "WORKER_ERROR");
  assert.equal(broken.workers[0].terminated, true);
});

test("Import Worker: the real worker script reads the independent compressed fixture in a browser-like realm", async () => {
  let handler;
  let response;
  let sandbox;
  const self = { addEventListener(type, callback) { assert.equal(type, "message"); handler = callback; }, postMessage(value) { response = value; } };
  sandbox = vm.createContext({ self, TextEncoder, TextDecoder, DecompressionStream, Blob, Uint8Array, ArrayBuffer, Date,
    importScripts(...names) {
      assert.deepEqual(names, ["vendor/xlsx-0.20.3.mini.min.js", "treasury-import.js"]);
      for (const name of names) vm.runInContext(fs.readFileSync(path.join(root, name), "utf8"), sandbox, { filename: name });
    } });
  vm.runInContext(fs.readFileSync(path.join(root, "treasury-import-worker.js"), "utf8"), sandbox);
  const bytes = fixture("import-normal.xlsx");
  await handler({ data: { type: "read-xlsx", bytes } });
  assert.equal(response.ok, true, response.error?.message);
  assert.equal(response.document.sheets[0].rows[1][1].dateISO, today);
  assert.equal(response.document.sheets[0].rows[1][2].value, 45000.5);
});
