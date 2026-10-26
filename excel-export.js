(function (root) {
  "use strict";

  // A small, offline SpreadsheetML exporter. Text is always an inline string,
  // never a formula. ZIP entries use the standard stored (uncompressed) method.
  // Format references:
  // https://learn.microsoft.com/office/open-xml/spreadsheet/structure-of-a-spreadsheetml-document
  // https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT
  const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const PACKAGE_REL = "http://schemas.openxmlformats.org/package/2006/relationships";
  const HEADERS = ["Fecha", "Concepto", "Tipo", "Estatus", "Importe (MXN)", "Banco", "Categoría", "Banco origen", "Banco destino", "ID", "ID banco", "ID banco origen", "ID banco destino"];
  const WIDTHS = [14, 44, 16, 20, 28, 28, 22, 28, 28, 44, 42, 42, 42];
  const TEXT_FIELDS = ["concept", "type", "status", "bank", "category", "fromBank", "toBank", "id", "bankId", "fromBankId", "toBankId"];
  // Positive; negative; zero; text. Fill spaces align the MXN label separately
  // from the amount, while padding aligns parentheses and decimal positions.
  // https://support.microsoft.com/en-us/excel/review-guidelines-for-customizing-a-number-format
  const ACCOUNTING_MXN_FORMAT = '_("MXN"* #,##0.00_);_("MXN"* (#,##0.00);_("MXN"* "-"??_);_(@_)';

  function escapeXML(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
    })[character]);
  }

  function cellText(value, rowNumber, field) {
    if (value != null && !["string", "number", "boolean"].includes(typeof value)) {
      throw new Error(`El campo ${field} del movimiento ${rowNumber} no es texto válido.`);
    }
    const text = String(value ?? "");
    if (text.length > 32767) {
      throw new Error(`El campo ${field} del movimiento ${rowNumber} excede el límite de Excel.`);
    }
    // XML 1.0 excludes these code points. Reject instead of silently losing data.
    for (const character of text) {
      const code = character.codePointAt(0);
      if ((code < 32 && ![9, 10, 13].includes(code)) || (code >= 0xd800 && code <= 0xdfff) || code === 0xfffe || code === 0xffff) {
        throw new Error(`El campo ${field} del movimiento ${rowNumber} contiene caracteres no válidos para Excel.`);
      }
    }
    // Escape literal OOXML escape sequences before XML escaping. Excel otherwise
    // interprets a literal _x0041_ as A when opening an ST_Xstring value.
    return escapeXML(text.replace(/_x[0-9a-f]{4}_/gi, (sequence) => `_x005F_${sequence.slice(1)}`));
  }

  function dateSerial(value, rowNumber) {
    const match = typeof value === "string" && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) throw new Error(`La fecha del movimiento ${rowNumber} no es válida.`);
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const timestamp = Date.UTC(year, month - 1, day);
    const date = new Date(timestamp);
    if (year < 1900 || year > 9999 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      throw new Error(`La fecha del movimiento ${rowNumber} no es válida para Excel.`);
    }
    // Excel's 1900 date system reserves serial 60 for its historical leap-day
    // compatibility bug. Actual Gregorian dates never emit that serial.
    return (timestamp - Date.UTC(1899, 11, 31)) / 86400000 + (timestamp >= Date.UTC(1900, 2, 1) ? 1 : 0);
  }

  function stringCell(reference, value, style = 0) {
    return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${value}</t></is></c>`;
  }

  function worksheetXML(rows) {
    const header = HEADERS.map((title, index) => stringCell(`${String.fromCharCode(65 + index)}1`, escapeXML(title), 1)).join("");
    const dataRows = rows.map((row, index) => {
      const number = index + 1;
      if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error(`El movimiento ${number} no es válido.`);
      if (typeof row.amount !== "number" || !Number.isFinite(row.amount) || row.amount < 0 || row.amount >= 1e13) {
        throw new Error(`El importe del movimiento ${number} no es válido o excede la precisión de Excel.`);
      }
      const text = Object.fromEntries(TEXT_FIELDS.map((field) => [field, cellText(row[field], number, field)]));
      const line = index + 2;
      const values = [
        `<c r="A${line}" s="2" t="n"><v>${dateSerial(row.date, number)}</v></c>`,
        stringCell(`B${line}`, text.concept),
        stringCell(`C${line}`, text.type),
        stringCell(`D${line}`, text.status),
        `<c r="E${line}" s="3" t="n"><v>${row.amount}</v></c>`,
        stringCell(`F${line}`, text.bank),
        stringCell(`G${line}`, text.category),
        stringCell(`H${line}`, text.fromBank),
        stringCell(`I${line}`, text.toBank),
        stringCell(`J${line}`, text.id),
        stringCell(`K${line}`, text.bankId),
        stringCell(`L${line}`, text.fromBankId),
        stringCell(`M${line}`, text.toBankId),
      ];
      return `<row r="${line}">${values.join("")}</row>`;
    }).join("");
    const lastRow = rows.length + 1;
    const columns = WIDTHS.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
    return `${XML}<worksheet xmlns="${NS}"><dimension ref="A1:M${lastRow}"/>`
      + '<sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>'
      + `<sheetFormatPr defaultRowHeight="20"/><cols>${columns}</cols><sheetData><row r="1" ht="32" customHeight="1">${header}</row>${dataRows}</sheetData>`
      + `<autoFilter ref="A1:M${lastRow}"/><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>`;
  }

  function stylesXML() {
    return `${XML}<styleSheet xmlns="${NS}">`
      + `<numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="${escapeXML(ACCOUNTING_MXN_FORMAT)}"/></numFmts>`
      + '<fonts count="2"><font><sz val="11"/><color rgb="FF14233B"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font></fonts>'
      + '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2463DB"/><bgColor indexed="64"/></patternFill></fill></fills>'
      + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
      + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
      + '<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'
      + '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>'
      + '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>'
      + '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="top"/></xf></cellXfs>'
      + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  }

  const crcTable = Uint32Array.from({ length: 256 }, (_, byte) => {
    let crc = byte;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    return crc >>> 0;
  });

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function zip(parts) {
    const encoder = new TextEncoder();
    const entries = Object.entries(parts).map(([name, text]) => {
      const bytes = encoder.encode(text);
      return { name: encoder.encode(name), bytes, crc: crc32(bytes) };
    });
    const localSize = entries.reduce((sum, entry) => sum + 30 + entry.name.length + entry.bytes.length, 0);
    const directorySize = entries.reduce((sum, entry) => sum + 46 + entry.name.length, 0);
    if (localSize + directorySize + 22 >= 0xffffffff) throw new Error("La exportación excede el tamaño admitido.");
    const result = new Uint8Array(localSize + directorySize + 22);
    const view = new DataView(result.buffer);
    const u16 = (offset, value) => view.setUint16(offset, value, true);
    const u32 = (offset, value) => view.setUint32(offset, value, true);
    let offset = 0;
    for (const entry of entries) {
      entry.offset = offset;
      u32(offset, 0x04034b50);
      u16(offset + 4, 20);
      u16(offset + 6, 0x0800);
      u16(offset + 12, 33); // Valid deterministic ZIP date: 1980-01-01.
      u32(offset + 14, entry.crc);
      u32(offset + 18, entry.bytes.length);
      u32(offset + 22, entry.bytes.length);
      u16(offset + 26, entry.name.length);
      result.set(entry.name, offset + 30);
      result.set(entry.bytes, offset + 30 + entry.name.length);
      offset += 30 + entry.name.length + entry.bytes.length;
    }
    for (const entry of entries) {
      u32(offset, 0x02014b50);
      u16(offset + 4, 20);
      u16(offset + 6, 20);
      u16(offset + 8, 0x0800);
      u16(offset + 14, 33);
      u32(offset + 16, entry.crc);
      u32(offset + 20, entry.bytes.length);
      u32(offset + 24, entry.bytes.length);
      u16(offset + 28, entry.name.length);
      u32(offset + 42, entry.offset);
      result.set(entry.name, offset + 46);
      offset += 46 + entry.name.length;
    }
    u32(offset, 0x06054b50);
    u16(offset + 8, entries.length);
    u16(offset + 10, entries.length);
    u32(offset + 12, directorySize);
    u32(offset + 16, localSize);
    return result;
  }

  function buildWorkbook(rows) {
    if (!Array.isArray(rows)) throw new Error("Los movimientos a exportar no son una lista válida.");
    if (rows.length > 1048575) throw new Error("La lista excede el número de filas admitido por Excel.");
    return zip({
      "[Content_Types].xml": `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
      "_rels/.rels": `${XML}<Relationships xmlns="${PACKAGE_REL}"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      "xl/workbook.xml": `${XML}<workbook xmlns="${NS}" xmlns:r="${REL}"><workbookPr date1904="0"/><bookViews><workbookView activeTab="0"/></bookViews><sheets><sheet name="Movimientos" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      "xl/_rels/workbook.xml.rels": `${XML}<Relationships xmlns="${PACKAGE_REL}"><Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${REL}/styles" Target="styles.xml"/></Relationships>`,
      "xl/styles.xml": stylesXML(),
      "xl/worksheets/sheet1.xml": worksheetXML(rows),
    });
  }

  const api = Object.freeze({ buildWorkbook });
  root.TreasuryExcel = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
