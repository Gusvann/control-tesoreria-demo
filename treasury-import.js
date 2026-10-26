(function (root) {
  "use strict";

  // Local import boundary. This module reads and validates; it never saves data,
  // creates bank/category IDs, renders HTML, or evaluates spreadsheet formulae.
  const isNode = typeof module === "object" && Boolean(module.exports);
  const scriptURL = typeof document !== "undefined" ? document.currentScript?.src || document.baseURI : null;
  const limits = Object.freeze({
    fileBytes: 10 * 1024 * 1024,
    expandedBytes: 50 * 1024 * 1024,
    entryBytes: 16 * 1024 * 1024,
    zipEntries: 2000,
    sheets: 20,
    dataRows: 5000,
    rows: 5001,
    columns: 50,
    gridCells: 500000,
    cellCharacters: 32767,
    timeoutMs: 15000,
  });
  const FIELDS = ["date", "concept", "type", "status", "amount", "bank", "category", "fromBank", "toBank", "sourceId"];
  const ALIASES = {
    date: ["fecha", "fecha de pago", "fecha pago", "fecha movimiento", "fecha del movimiento", "date"],
    concept: ["concepto", "descripcion", "descripcion del movimiento", "detalle", "concept", "description"],
    type: ["tipo", "tipo de movimiento", "movimiento", "type"],
    status: ["estatus", "estado", "status"],
    amount: ["importe", "importe mxn", "monto", "monto mxn", "cantidad", "amount"],
    bank: ["banco", "cuenta", "banco asignado", "bank"],
    category: ["categoria", "categoria del pago", "category"],
    fromBank: ["banco origen", "cuenta origen", "cuenta de origen", "origen", "from bank", "frombank"],
    toBank: ["banco destino", "cuenta destino", "cuenta de destino", "destino", "to bank", "tobank"],
    sourceId: ["id", "id movimiento", "identificador", "sourceid"],
  };
  const TYPE_NAMES = new Map([
    ["cobro", "inflow"], ["ingreso", "inflow"], ["entrada", "inflow"], ["inflow", "inflow"],
    ["pago", "outflow"], ["egreso", "outflow"], ["gasto", "outflow"], ["salida", "outflow"], ["outflow", "outflow"],
    ["traspaso", "transfer"], ["transferencia", "transfer"], ["transfer", "transfer"],
  ]);
  const STATUS_NAMES = new Map([
    ["confirmado", "confirmed"], ["confirmada", "confirmed"], ["confirmed", "confirmed"],
    ["por confirmar", "pending"], ["pendiente", "pending"], ["pending", "pending"],
  ]);

  function failure(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  function aborted() {
    const error = failure("ABORTED", "La lectura del archivo se canceló.");
    error.name = "AbortError";
    return error;
  }

  function checkSignal(signal) {
    if (signal?.aborted) throw aborted();
  }

  function issue(code, field, message) { return { code, field, message }; }

  function normalize(value) {
    return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLowerCase();
  }

  function cellValue(cell) {
    return cell && typeof cell === "object" && Object.hasOwn(cell, "value") ? cell.value : cell ?? null;
  }

  function blank(value) { return value == null || (typeof value === "string" && !value.trim()); }

  function copyBytes(input) {
    let view;
    if (ArrayBuffer.isView(input)) view = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    else if (Object.prototype.toString.call(input) === "[object ArrayBuffer]") view = new Uint8Array(input);
    else throw failure("INPUT", "Selecciona un archivo Excel válido.");
    if (view.byteLength > limits.fileBytes) throw failure("FILE_LIMIT", "El archivo supera el límite de 10 MiB. Divide la tabla e importa cada parte.");
    if (!view.byteLength) throw failure("EMPTY_FILE", "El archivo está vacío.");
    return new Uint8Array(view);
  }

  async function readXlsx(input, options = {}) {
    checkSignal(options.signal);
    const bytes = copyBytes(input);
    if (!isNode && scriptURL) return readInWorker(bytes, options);
    return parseWorkbook(bytes, options.signal);
  }

  function readInWorker(bytes, options) {
    if (typeof root.Worker !== "function") {
      return Promise.reject(failure("WORKER_UNAVAILABLE", "Este navegador no permite leer Excel en segundo plano. Puedes pegar la tabla o usar un navegador actualizado."));
    }
    return new Promise((resolve, reject) => {
      let worker;
      let timer;
      let finished = false;
      const signal = options.signal;
      function finish(error, result) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        signal?.removeEventListener("abort", cancel);
        worker?.terminate();
        if (error) reject(error);
        else resolve(result);
      }
      function cancel() { finish(aborted()); }
      try {
        checkSignal(signal);
        worker = new root.Worker(new URL("treasury-import-worker.js", scriptURL));
        worker.onmessage = (event) => {
          const response = event.data;
          if (response?.ok && response.document?.kind === "xlsx" && Array.isArray(response.document.sheets)) finish(null, response.document);
          else finish(failure(response?.error?.code || "READ_ERROR", response?.error?.message || "No se pudo leer el archivo Excel."));
        };
        worker.onerror = () => finish(failure("WORKER_ERROR", "No se pudo leer Excel. Vuelve a cargar la página e intenta de nuevo."));
        worker.onmessageerror = () => finish(failure("WORKER_ERROR", "No se pudo recuperar la lectura del archivo Excel."));
        signal?.addEventListener("abort", cancel, { once: true });
        const timeout = Number.isFinite(options.timeoutMs) ? Math.max(1, Math.min(60000, options.timeoutMs)) : limits.timeoutMs;
        timer = setTimeout(() => finish(failure("TIMEOUT", "La lectura tardó demasiado. Divide el archivo en una tabla más pequeña e intenta de nuevo.")), timeout);
        worker.postMessage({ type: "read-xlsx", bytes: bytes.buffer }, [bytes.buffer]);
      } catch (error) { finish(error); }
    });
  }

  const crcTable = Uint32Array.from({ length: 256 }, (_, byte) => {
    let crc = byte;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    return crc >>> 0;
  });

  function updateCRC(crc, bytes) {
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
    return crc;
  }

  function invalidZip() { return failure("INVALID_XLSX", "El archivo no es un XLSX válido o está dañado. Guárdalo nuevamente como .xlsx desde Excel."); }

  function zipEntries(bytes) {
    if (bytes.length < 22) throw invalidZip();
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (view.getUint32(0, true) !== 0x04034b50) {
      throw failure("UNSUPPORTED_FILE", "Usa un archivo .xlsx sin contraseña. Los formatos .xls, .xlsm y otros tipos no se importan.");
    }
    let end = -1;
    for (let position = bytes.length - 22; position >= Math.max(0, bytes.length - 65557); position -= 1) {
      if (view.getUint32(position, true) === 0x06054b50 && position + 22 + view.getUint16(position + 20, true) === bytes.length) { end = position; break; }
    }
    if (end < 0 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) throw invalidZip();
    const count = view.getUint16(end + 10, true);
    const centralSize = view.getUint32(end + 12, true);
    const centralOffset = view.getUint32(end + 16, true);
    if (!count || count > limits.zipEntries || count !== view.getUint16(end + 8, true)) throw failure("ZIP_LIMIT", "El archivo tiene demasiadas partes o usa un tipo de ZIP no admitido.");
    if (centralOffset + centralSize !== end) throw invalidZip();
    const names = new Set();
    const entries = [];
    let position = centralOffset;
    let expanded = 0;
    for (let index = 0; index < count; index += 1) {
      if (position + 46 > end || view.getUint32(position, true) !== 0x02014b50) throw invalidZip();
      const flags = view.getUint16(position + 8, true);
      const method = view.getUint16(position + 10, true);
      const crc = view.getUint32(position + 16, true);
      const compressed = view.getUint32(position + 20, true);
      const uncompressed = view.getUint32(position + 24, true);
      const nameLength = view.getUint16(position + 28, true);
      const extraLength = view.getUint16(position + 30, true);
      const commentLength = view.getUint16(position + 32, true);
      const offset = view.getUint32(position + 42, true);
      const next = position + 46 + nameLength + extraLength + commentLength;
      if (!nameLength || next > end || view.getUint16(position + 34, true) !== 0) throw invalidZip();
      if ((flags & 0x2041) || ![0, 8].includes(method)) throw failure("UNSUPPORTED_ZIP", "El archivo usa cifrado o una compresión no admitida. Guarda una copia .xlsx sin contraseña.");
      if (uncompressed > limits.entryBytes || (expanded += uncompressed) > limits.expandedBytes) {
        throw failure("EXPANDED_LIMIT", "El contenido descomprimido supera el límite de importación. Divide el archivo o elimina imágenes y hojas que no necesites.");
      }
      let name;
      try { name = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(position + 46, position + 46 + nameLength)); }
      catch (error) { throw invalidZip(); }
      if (name.includes("\0") || name.includes("\\") || name.startsWith("/") || name.split("/").some((part) => part === ".." || part === ".") || names.has(name)) throw invalidZip();
      names.add(name);
      if (/vbaProject\.bin$/i.test(name) || /(?:^|\/)macrosheets\//i.test(name)) throw failure("MACROS", "Usa un libro .xlsx sin macros para importar movimientos.");
      if (offset + 30 > centralOffset || view.getUint32(offset, true) !== 0x04034b50) throw invalidZip();
      if (view.getUint16(offset + 6, true) !== flags || view.getUint16(offset + 8, true) !== method) throw invalidZip();
      const localNameLength = view.getUint16(offset + 26, true);
      const localExtraLength = view.getUint16(offset + 28, true);
      const start = offset + 30 + localNameLength + localExtraLength;
      if (localNameLength !== nameLength || start + compressed > centralOffset || start < offset) throw invalidZip();
      for (let character = 0; character < nameLength; character += 1) {
        if (bytes[offset + 30 + character] !== bytes[position + 46 + character]) throw invalidZip();
      }
      if (!(flags & 8) && (view.getUint32(offset + 14, true) !== crc || view.getUint32(offset + 18, true) !== compressed || view.getUint32(offset + 22, true) !== uncompressed)) throw invalidZip();
      let dataEnd = start + compressed;
      if (flags & 8) {
        if (dataEnd + 12 > centralOffset) throw invalidZip();
        const descriptor = view.getUint32(dataEnd, true) === 0x08074b50 ? dataEnd + 4 : dataEnd;
        if (descriptor + 12 > centralOffset || view.getUint32(descriptor, true) !== crc || view.getUint32(descriptor + 4, true) !== compressed || view.getUint32(descriptor + 8, true) !== uncompressed) throw invalidZip();
        dataEnd = descriptor + 12;
      }
      if (method === 0 && compressed !== uncompressed) throw invalidZip();
      entries.push({ name, method, crc, compressed, uncompressed, offset, start, dataEnd });
      position = next;
    }
    if (position !== end || !names.has("[Content_Types].xml") || !names.has("xl/workbook.xml")) throw invalidZip();
    const ordered = [...entries].sort((a, b) => a.offset - b.offset);
    for (let index = 1; index < ordered.length; index += 1) if (ordered[index].offset < ordered[index - 1].dataEnd) throw invalidZip();
    return entries;
  }

  async function expandEntry(bytes, entry, signal) {
    const compressed = bytes.subarray(entry.start, entry.start + entry.compressed);
    const collect = /\.(?:xml|rels)$/i.test(entry.name);
    const chunks = [];
    let size = 0;
    let crc = 0xffffffff;
    function consume(chunk) {
      checkSignal(signal);
      size += chunk.length;
      if (size > entry.uncompressed || size > limits.entryBytes) throw failure("EXPANDED_LIMIT", "El tamaño real del contenido supera lo declarado por el archivo. No se importó.");
      crc = updateCRC(crc, chunk);
      if (collect) chunks.push(chunk);
    }
    if (entry.method === 0) consume(compressed);
    else if (typeof DecompressionStream === "function") {
      let decompressor;
      try { decompressor = new DecompressionStream("deflate-raw"); }
      catch (error) { throw failure("DECOMPRESSION_UNAVAILABLE", "Este navegador no admite la compresión de Excel. Actualízalo o pega la tabla."); }
      const reader = new Blob([compressed]).stream().pipeThrough(decompressor).getReader();
      try {
        for (;;) {
          const part = await reader.read();
          if (part.done) break;
          consume(part.value);
        }
      } catch (error) {
        await reader.cancel().catch(() => {});
        if (error.code) throw error;
        throw invalidZip();
      } finally { reader.releaseLock(); }
    } else if (isNode) {
      let expanded;
      try { expanded = require("node:zlib").inflateRawSync(compressed, { maxOutputLength: Math.max(1, entry.uncompressed + 1) }); }
      catch (error) { throw invalidZip(); }
      consume(expanded);
    } else throw failure("DECOMPRESSION_UNAVAILABLE", "Este navegador no admite la compresión de Excel. Actualízalo o pega la tabla.");
    if (size !== entry.uncompressed || ((crc ^ 0xffffffff) >>> 0) !== entry.crc) throw invalidZip();
    if (!collect) return null;
    const expanded = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { expanded.set(chunk, offset); offset += chunk.length; }
    let encoding = "utf-8";
    if ((expanded[0] === 0xff && expanded[1] === 0xfe) || (expanded[0] === 0x3c && expanded[1] === 0)) encoding = "utf-16le";
    if ((expanded[0] === 0xfe && expanded[1] === 0xff) || (expanded[0] === 0 && expanded[1] === 0x3c)) encoding = "utf-16be";
    try { return new TextDecoder(encoding, { fatal: true }).decode(expanded); }
    catch (error) { throw invalidZip(); }
  }

  function attribute(tag, name) {
    return new RegExp(`(?:^|\\s)${name}\\s*=\\s*(["'])(.*?)\\1`, "i").exec(tag)?.[2] ?? null;
  }

  function columnNumber(letters) {
    let number = 0;
    for (const letter of letters.toUpperCase()) number = number * 26 + letter.charCodeAt(0) - 64;
    return number;
  }

  function inspectSheetXML(xml) {
    let row = 0;
    let column = 0;
    let maxRow = 0;
    let maxColumn = 0;
    for (const match of xml.matchAll(/<(?:[A-Za-z_][\w.-]*:)?(row|c)\b[^>]*>/g)) {
      const tag = match[0];
      if (tag.length > 65536) throw invalidZip();
      const reference = attribute(tag, "r");
      if (match[1] === "row") {
        if (reference && !/^[1-9]\d{0,6}$/.test(reference)) throw invalidZip();
        row = reference ? Number(reference) : row + 1;
        column = 0;
      } else {
        if (reference) {
          const cell = /^([A-Za-z]{1,3})([1-9]\d{0,6})$/.exec(reference);
          if (!cell) throw invalidZip();
          column = columnNumber(cell[1]);
          maxRow = Math.max(maxRow, Number(cell[2]));
        } else { column += 1; maxRow = Math.max(maxRow, row || 1); }
        maxColumn = Math.max(maxColumn, column);
        if (maxRow > limits.rows || maxColumn > limits.columns) {
          throw failure("SHEET_LIMIT", "Cada hoja admite hasta 5000 movimientos más su encabezado y 50 columnas. Divide la tabla; no se recortaron filas.");
        }
      }
    }
    return maxRow * maxColumn;
  }

  async function inspectPackage(bytes, signal) {
    const entries = zipEntries(bytes);
    let gridCells = 0;
    let sheetCount = 0;
    let externalLinks = false;
    for (const entry of entries) {
      checkSignal(signal);
      const xml = await expandEntry(bytes, entry, signal);
      if (xml == null) continue;
      if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) throw failure("XML_DECLARATION", "El archivo contiene declaraciones XML no admitidas. Guarda una copia .xlsx desde Excel.");
      if (entry.name === "[Content_Types].xml") {
        const defaults = new Map();
        const overrides = new Map();
        for (const tag of xml.matchAll(/<(?:[A-Za-z_][\w.-]*:)?(Default|Override)\b[^>]*>/g)) {
          const contentType = attribute(tag[0], "ContentType") || "";
          if (tag[1] === "Default") defaults.set((attribute(tag[0], "Extension") || "").toLowerCase(), contentType);
          else overrides.set((attribute(tag[0], "PartName") || "").replace(/^\//, ""), contentType);
        }
        // Some ordinary XLSX writers declare unused macro-related defaults.
        // Only the content type of an actual part determines its format.
        for (const part of entries) {
          if (part.name === "[Content_Types].xml") continue;
          const type = overrides.get(part.name) || defaults.get(part.name.split(".").at(-1).toLowerCase()) || "";
          if (/macroEnabled|vbaProject/i.test(type)) throw failure("MACROS", "Usa un libro .xlsx sin macros para importar movimientos.");
        }
      }
      if (entry.name === "xl/workbook.xml") {
        sheetCount = [...xml.matchAll(/<(?:[A-Za-z_][\w.-]*:)?sheet\b/g)].length;
        if (!sheetCount || sheetCount > limits.sheets) throw failure("SHEET_COUNT", "El archivo debe contener entre 1 y 20 hojas. Guarda las hojas necesarias en otro libro.");
      }
      if (/<(?:[A-Za-z_][\w.-]*:)?worksheet\b/.test(xml)) {
        gridCells += inspectSheetXML(xml);
        if (gridCells > limits.gridCells) throw failure("CELL_LIMIT", "El archivo contiene demasiadas celdas. Divide sus hojas en archivos más pequeños.");
      }
      if (/\.rels$/i.test(entry.name) && /\bTargetMode\s*=\s*["']External["']/i.test(xml)) externalLinks = true;
    }
    return externalLinks ? [issue("EXTERNAL_LINKS_IGNORED", null, "El libro contiene enlaces externos. Se usan únicamente los valores guardados; no se abren ni actualizan enlaces.")] : [];
  }

  function isoDate(year, month, day) {
    if (!Number.isInteger(year) || year < 1900 || year > 9999 || !Number.isInteger(month) || !Number.isInteger(day)) return null;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function strictISO(value) {
    const parts = typeof value === "string" && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    return parts ? isoDate(Number(parts[1]), Number(parts[2]), Number(parts[3])) : null;
  }

  function serialDate(value, date1904) {
    if (!Number.isFinite(value) || value < (date1904 ? 0 : 1)) return null;
    const days = Math.floor(value);
    if (!date1904 && days === 60) return null;
    const timestamp = date1904 ? Date.UTC(1904, 0, 1) + days * 86400000
      : Date.UTC(1899, 11, 31) + (days > 60 ? days - 1 : days) * 86400000;
    const date = new Date(timestamp);
    return isoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  async function parseWorkbook(bytes, signal) {
    const warnings = await inspectPackage(bytes, signal);
    checkSignal(signal);
    const XLSX = root.XLSX || (isNode ? require("./vendor/xlsx-0.20.3.mini.min.js") : null);
    if (XLSX?.version !== "0.20.3") throw failure("READER_UNAVAILABLE", "El lector de Excel no está disponible. Vuelve a cargar la página.");
    let workbook;
    try {
      workbook = XLSX.read(bytes, { type: "array", dense: true, cellFormula: true, sheetStubs: true, cellHTML: false, cellNF: true,
        cellStyles: false, cellText: false, cellDates: false, sheetRows: limits.rows + 1, nodim: true,
        bookDeps: false, bookVBA: false, WTF: true });
    } catch (error) { throw failure("READ_ERROR", "No se pudo interpretar el libro. Guarda una copia .xlsx desde Excel e intenta de nuevo."); }
    if (!workbook.SheetNames?.length || workbook.SheetNames.length > limits.sheets) throw failure("SHEET_COUNT", "El archivo debe contener entre 1 y 20 hojas.");
    const date1904 = Boolean(workbook.Workbook?.WBProps?.date1904);
    let totalCells = 0;
    const sheets = workbook.SheetNames.map((name, sheetIndex) => {
      checkSignal(signal);
      const data = workbook.Sheets[name]?.["!data"] || [];
      let height = 0;
      let width = 0;
      data.forEach((row, rowIndex) => row?.forEach((cell, columnIndex) => {
        if (cell && (cell.v != null || cell.f || cell.F || cell.t === "e")) { height = Math.max(height, rowIndex + 1); width = Math.max(width, columnIndex + 1); }
      }));
      if (height > limits.rows || width > limits.columns || (totalCells += height * width) > limits.gridCells) throw failure("SHEET_LIMIT", "El archivo supera los límites de filas o columnas. No se recortaron datos.");
      const rows = Array.from({ length: height }, (_, rowIndex) => Array.from({ length: width }, (_, columnIndex) => {
        const cell = data[rowIndex]?.[columnIndex];
        if (!cell) return { value: null };
        let value = cell.t === "z" ? null : cell.v ?? null;
        const result = { value };
        if (cell.f || cell.F) result.formula = true;
        if (cell.t === "e") result.error = "La celda contiene un error de Excel.";
        if (cell.t === "d") {
          const date = value instanceof Date ? isoDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate()) : strictISO(String(value).slice(0, 10));
          if (date) { result.dateISO = date; result.value = date; }
          else result.error = "La celda contiene una fecha inválida.";
        } else if (typeof value === "number" && cell.z && XLSX.SSF.is_date(cell.z)) {
          const date = serialDate(value, date1904);
          if (date) result.dateISO = date;
          else result.error = "La celda contiene una fecha inválida.";
        }
        if (typeof value === "string" && value.length > limits.cellCharacters) throw failure("CELL_TEXT_LIMIT", "Una celda supera el límite de texto admitido. Divide su contenido antes de importar.");
        if (value != null && !["string", "number", "boolean"].includes(typeof value) && !result.dateISO) throw invalidZip();
        return result;
      }));
      return { name, date1904, hidden: Boolean(workbook.Workbook?.Sheets?.[sheetIndex]?.Hidden), rows };
    });
    return { kind: "xlsx", sheets, warnings };
  }

  function detectDelimiter(text) {
    const candidates = ["\t", ",", ";"];
    const counts = candidates.map(() => []);
    let line = candidates.map(() => 0);
    let quoted = false;
    let row = 0;
    for (let index = 0; index < text.length && index < 65536 && row < 20; index += 1) {
      const character = text[index];
      if (character === '"') {
        if (quoted && text[index + 1] === '"') index += 1;
        else quoted = !quoted;
      } else if (!quoted && (character === "\n" || character === "\r")) {
        if (character === "\r" && text[index + 1] === "\n") index += 1;
        candidates.forEach((_, candidate) => counts[candidate].push(line[candidate]));
        line = candidates.map(() => 0);
        row += 1;
      } else if (!quoted) candidates.forEach((delimiter, candidate) => { if (character === delimiter) line[candidate] += 1; });
    }
    if (line.some(Boolean) || row === 0) candidates.forEach((_, candidate) => counts[candidate].push(line[candidate]));
    // Clipboard tables use tabs even when cells contain unquoted commas.
    if (counts[0].some((value) => value > 0)) return "\t";
    let best = 0;
    let score = -1;
    counts.forEach((values, candidate) => {
      const useful = values.filter((value) => value > 0);
      const first = values[0] || 0;
      const consistency = first ? values.filter((value) => value === first).length / values.length : 0;
      const current = (first ? 100 : 0) + consistency * 20 + useful.length + Math.min(first, 50) / 100;
      if (current > score) { best = candidate; score = current; }
    });
    return candidates[best];
  }

  function parseText(input, options = {}) {
    if (typeof input !== "string") throw failure("INPUT", "Pega una tabla o carga un archivo de texto válido.");
    if (input.length > limits.fileBytes || new TextEncoder().encode(input).length > limits.fileBytes) throw failure("FILE_LIMIT", "El texto supera el límite de 10 MiB. Divide la tabla.");
    const text = input.replace(/^\uFEFF/, "");
    const delimiter = !options.delimiter || options.delimiter === "auto" ? detectDelimiter(text) : options.delimiter;
    if (!["\t", ",", ";"].includes(delimiter)) throw failure("DELIMITER", "Elige tabulador, coma o punto y coma como separador.");
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;
    let closed = false;
    let started = false;
    function finishField() {
      if (field.length > limits.cellCharacters) throw failure("CELL_TEXT_LIMIT", `La fila ${rows.length + 1} contiene demasiado texto en una celda.`);
      row.push({ value: field });
      if (row.length > limits.columns) throw failure("COLUMN_LIMIT", "La tabla supera 50 columnas. Revisa el separador o divide la tabla.");
      field = "";
      closed = false;
      started = false;
    }
    function finishRow() {
      finishField();
      rows.push(row);
      if (rows.length > limits.rows) throw failure("ROW_LIMIT", "La tabla supera 5000 movimientos más su encabezado. Divide la tabla; no se recortaron filas.");
      row = [];
    }
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (quoted) {
        if (character === '"') {
          if (text[index + 1] === '"') { field += '"'; index += 1; }
          else { quoted = false; closed = true; }
        } else field += character;
      } else if (character === delimiter) finishField();
      else if (character === "\n" || character === "\r") {
        if (character === "\r" && text[index + 1] === "\n") index += 1;
        finishRow();
      } else if (character === '"') {
        if (started || closed) throw failure("TEXT_QUOTES", `Revisa las comillas de la fila ${rows.length + 1}.`);
        quoted = true;
        started = true;
      } else {
        if (closed) throw failure("TEXT_QUOTES", `Hay texto después de cerrar las comillas en la fila ${rows.length + 1}.`);
        field += character;
        started = true;
      }
    }
    if (quoted) throw failure("TEXT_QUOTES", `Falta cerrar una comilla en la fila ${rows.length + 1}.`);
    if (field || row.length || started || closed) finishRow();
    const width = rows.reduce((maximum, current) => Math.max(maximum, current.length), 0);
    if (rows.length * width > limits.gridCells) throw failure("CELL_LIMIT", "La tabla contiene demasiadas celdas.");
    rows.forEach((current) => { while (current.length < width) current.push({ value: null }); });
    return { kind: "text", delimiter, sheets: [{ name: "Tabla pegada", date1904: false, rows }], warnings: [] };
  }

  function validateSheet(sheet) {
    if (!sheet || !Array.isArray(sheet.rows) || sheet.rows.some((row) => !Array.isArray(row))) throw failure("SHEET", "Selecciona una hoja válida.");
    if (sheet.rows.length > limits.rows || sheet.rows.some((row) => row.length > limits.columns)) throw failure("SHEET_LIMIT", "La hoja supera los límites de filas o columnas. No se recortaron datos.");
  }

  function headerIndex(sheet, value) {
    const headerRow = value ?? 1;
    if (!Number.isInteger(headerRow) || headerRow < 0 || headerRow > Math.max(1, sheet.rows.length)) throw failure("HEADER", "Elige una fila de encabezados válida, o 0 si no hay encabezados.");
    return headerRow;
  }

  function suggestMapping(sheet, options = {}) {
    validateSheet(sheet);
    const headerRow = headerIndex(sheet, options.headerRow);
    const headers = headerRow ? (sheet.rows[headerRow - 1] || []).map((cell) => normalize(cellValue(cell)).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim()) : [];
    return Object.fromEntries(FIELDS.map((field) => {
      const matches = headers.map((header, index) => ALIASES[field].includes(header) ? index : -1).filter((index) => index >= 0);
      return [field, matches.length === 1 ? matches[0] : null];
    }));
  }

  function amountValue(value, numberFormat) {
    if (typeof value === "number") {
      if (!Number.isFinite(value) || value <= 0 || value >= 1e13) return null;
      const cents = Math.round(value * 100);
      const rounded = cents / 100;
      // Reject positive residues that would become zero and diverge at save time.
      if (cents <= 0 || !Number.isSafeInteger(cents)) return null;
      const tolerance = Math.min(1e-8, Number.EPSILON * Math.max(1, Math.abs(value)) * 2);
      return Math.abs(value - rounded) <= tolerance ? rounded : null;
    }
    if (typeof value !== "string") return null;
    let text = value.trim().replace(/\u00a0/g, " ");
    text = text.replace(/^(?:MXN\s*)?\$?\s*/i, "").replace(/\s*MXN$/i, "").replace(/^\+/, "");
    const commaDecimal = numberFormat === "es-ES";
    const valid = commaDecimal ? /^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/ : /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/;
    if (!valid.test(text)) return null;
    const plain = commaDecimal ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
    const [integer, decimal = ""] = plain.split(".");
    const cents = Number(integer) * 100 + Number(decimal.padEnd(2, "0"));
    if (!Number.isSafeInteger(cents) || cents <= 0 || cents >= 1e15) return null;
    return cents / 100;
  }

  function dateValue(cell, date1904, order) {
    const value = cellValue(cell);
    if (cell?.dateISO && strictISO(cell.dateISO)) return cell.dateISO;
    if (typeof value === "number") return serialDate(value, date1904);
    if (typeof value !== "string") return null;
    const text = value.trim();
    const iso = strictISO(text);
    if (iso) return iso;
    const parts = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text);
    if (!parts) return null;
    return isoDate(Number(parts[3]), Number(parts[order === "MDY" ? 1 : 2]), Number(parts[order === "MDY" ? 2 : 1]));
  }

  function referenceValue(value, items, field, errors, warnings, optional) {
    if (blank(value)) {
      if (!optional) errors.push(issue("REQUIRED_BANK", field, "El traspaso necesita una cuenta de origen y una de destino."));
      return "";
    }
    const text = String(value).trim();
    const label = normalize(text);
    const idMatches = items.filter((item) => item.id === text);
    const matches = idMatches.length ? idMatches : items.filter((item) => normalize(item.name ?? item.label) === label);
    if (matches.length === 0 && optional && (field === "category" ? label === "sin categoria" : ["sin banco", "sin banco asignado"].includes(label))) return "";
    if (matches.length === 1) return matches[0].id;
    if (optional && field === "bank" && label === "banco no disponible" && matches.length === 0) {
      warnings.push(issue("BANK_UNAVAILABLE", field, "El banco del archivo ya no está disponible. El pago se importará sin banco asignado."));
      return "";
    }
    const noun = field === "category" ? "categoría" : "cuenta bancaria";
    errors.push(issue(matches.length ? "AMBIGUOUS_REFERENCE" : "UNKNOWN_REFERENCE", field,
      matches.length ? `La ${noun} «${text}» coincide con más de una opción. Usa un nombre único.` : `La ${noun} «${text}» no existe en este escenario.`));
    return "";
  }

  function fingerprint(movement) {
    const amount = amountValue(movement.amount, "es-MX");
    if (!movement.date || !movement.type || !movement.concept || amount == null) return null;
    return JSON.stringify([movement.date, normalize(movement.concept), movement.type, Math.round(amount * 100)]);
  }

  function preview(sheet, options = {}, context = {}) {
    validateSheet(sheet);
    const headerRow = headerIndex(sheet, options.headerRow);
    if (sheet.rows.length - headerRow > limits.dataRows) throw failure("ROW_LIMIT", "La selección supera 5000 movimientos. Divide la tabla.");
    const dateOrder = options.dateOrder || "DMY";
    const numberFormat = options.numberFormat || "es-MX";
    if (!["DMY", "MDY"].includes(dateOrder) || !["es-MX", "es-ES"].includes(numberFormat)) throw failure("FORMAT", "Elige el orden de fecha y el formato numérico de la tabla.");
    const mapping = options.mapping || suggestMapping(sheet, { headerRow });
    const columns = [];
    for (const field of FIELDS) {
      const column = mapping[field];
      if (column != null && (!Number.isInteger(column) || column < 0 || column >= limits.columns)) throw failure("MAPPING", "Las columnas seleccionadas no son válidas.");
      if (column != null) columns.push(column);
    }
    if (["date", "concept", "amount"].some((field) => mapping[field] == null)) throw failure("MAPPING", "Relaciona las columnas Fecha, Concepto e Importe antes de revisar.");
    if (new Set(columns).size !== columns.length) throw failure("MAPPING", "Cada columna solo puede corresponder a un campo. Revisa la selección.");
    const defaults = { type: "outflow", status: "confirmed", ...options.defaults };
    if (!TYPE_NAMES.has(normalize(defaults.type)) || !STATUS_NAMES.has(normalize(defaults.status))) throw failure("DEFAULTS", "Elige un tipo y un estatus predeterminados válidos.");
    if (context.minDate != null && !strictISO(context.minDate)) throw failure("MIN_DATE", "La fecha mínima de importación no es válida.");
    const accounts = Array.isArray(context.accounts) ? context.accounts : [];
    const categories = Array.isArray(context.categories) ? context.categories : [];
    const existing = Array.isArray(context.existingMovements) ? context.existingMovements : [];
    const byId = new Map();
    const byFingerprint = new Map();
    existing.forEach((movement) => {
      if (movement.id != null) {
        const id = String(movement.id);
        if (!byId.has(id)) byId.set(id, []);
        byId.get(id).push({ source: "existing", id, reason: "id" });
      }
      const key = fingerprint(movement);
      if (key) {
        if (!byFingerprint.has(key)) byFingerprint.set(key, []);
        byFingerprint.get(key).push({ source: "existing", id: String(movement.id ?? ""), reason: "fields" });
      }
    });
    const seenIds = new Map();
    const seenFingerprints = new Map();
    const summary = { valid: 0, invalid: 0, possibleDuplicates: 0, empty: 0 };
    const rows = [];
    for (let index = headerRow; index < sheet.rows.length; index += 1) {
      const source = sheet.rows[index];
      if (source.every((cell) => blank(cellValue(cell)) && !cell?.formula && !cell?.error)) { summary.empty += 1; continue; }
      const errors = [];
      const warnings = [];
      function cell(field) { return mapping[field] == null ? null : source[mapping[field]] ?? null; }
      function value(field) { return cellValue(cell(field)); }
      for (const field of FIELDS) {
        const current = cell(field);
        if (current?.error) errors.push(issue("CELL_ERROR", field, String(current.error)));
        if (current?.formula) {
          if (blank(cellValue(current))) errors.push(issue("FORMULA_NO_VALUE", field, "La fórmula no tiene un valor guardado. Abre el archivo en Excel, calcula y guarda antes de importar."));
          else warnings.push(issue("FORMULA_CACHED_VALUE", field, "Se usará el valor guardado de la fórmula, sin recalcularla."));
        }
      }
      const date = dateValue(cell("date"), Boolean(sheet.date1904), dateOrder);
      if (!date) errors.push(issue("INVALID_DATE", "date", "Usa una fecha real con año de cuatro dígitos y el orden seleccionado."));
      else if (context.minDate && date < context.minDate) errors.push(issue("PAST_DATE", "date", "La fecha es anterior a la permitida. Activa la importación de históricos para incluirla."));
      else if (strictISO(context.todayISO) && date < context.todayISO) warnings.push(issue("HISTORICAL_DATE", "date", "Movimiento histórico: no entrará en la proyección que inicia hoy."));
      if (typeof value("date") === "number" && value("date") % 1) warnings.push(issue("TIME_IGNORED", "date", "Se importará la fecha; la hora de la celda no se utiliza."));
      const concept = blank(value("concept")) ? "" : String(value("concept")).trim();
      if (!concept || concept.length > 70) errors.push(issue("INVALID_CONCEPT", "concept", "El concepto debe tener entre 1 y 70 caracteres."));
      const amount = amountValue(value("amount"), numberFormat);
      if (amount == null) errors.push(issue("INVALID_AMOUNT", "amount", "El importe debe ser positivo, menor a 10 billones, con máximo dos decimales y separadores del formato elegido."));
      const type = TYPE_NAMES.get(normalize(blank(value("type")) ? defaults.type : value("type")));
      const status = STATUS_NAMES.get(normalize(blank(value("status")) ? defaults.status : value("status")));
      if (!type) errors.push(issue("INVALID_TYPE", "type", "El tipo debe ser Cobro, Pago o Traspaso."));
      if (!status) errors.push(issue("INVALID_STATUS", "status", "El estatus debe ser Confirmado o Por confirmar."));
      const movement = { date, concept, type, status, amount };
      if (type === "outflow") {
        const bankId = referenceValue(value("bank"), accounts, "bank", errors, warnings, true);
        const categoryId = referenceValue(value("category"), categories, "category", errors, warnings, true);
        if (bankId) movement.bankId = bankId;
        if (categoryId) movement.categoryId = categoryId;
      } else if (type === "transfer") {
        movement.fromBankId = referenceValue(value("fromBank"), accounts, "fromBank", errors, warnings, false);
        movement.toBankId = referenceValue(value("toBank"), accounts, "toBank", errors, warnings, false);
        if (movement.fromBankId && movement.fromBankId === movement.toBankId) errors.push(issue("SAME_BANK", "toBank", "La cuenta de destino debe ser distinta de la de origen."));
      }
      const irrelevant = type === "outflow" ? ["fromBank", "toBank"] : type === "transfer" ? ["bank", "category"] : type === "inflow" ? ["bank", "category", "fromBank", "toBank"] : [];
      irrelevant.forEach((field) => {
        if (!blank(value(field))) warnings.push(issue("FIELD_NOT_APPLICABLE", field, "Este campo no corresponde al tipo de movimiento y no se importará."));
      });
      const sourceId = blank(value("sourceId")) ? "" : String(value("sourceId")).trim();
      const key = errors.length ? null : fingerprint(movement);
      const duplicates = [
        ...(sourceId ? byId.get(sourceId) || [] : []), ...(key ? byFingerprint.get(key) || [] : []),
        ...(sourceId && seenIds.has(sourceId) ? [{ source: "import", rowNumber: seenIds.get(sourceId), reason: "id" }] : []),
        ...(key && seenFingerprints.has(key) ? [{ source: "import", rowNumber: seenFingerprints.get(key), reason: "fields" }] : []),
      ].filter((candidate, position, all) => all.findIndex((other) => other.source === candidate.source && other.id === candidate.id && other.rowNumber === candidate.rowNumber) === position);
      const result = { rowNumber: index + 1, movement: errors.length ? null : movement, errors, warnings, duplicates };
      if (sourceId) result.sourceId = sourceId;
      rows.push(result);
      if (errors.length) summary.invalid += 1;
      else {
        summary.valid += 1;
        if (sourceId && !seenIds.has(sourceId)) seenIds.set(sourceId, index + 1);
        if (key && !seenFingerprints.has(key)) seenFingerprints.set(key, index + 1);
      }
      if (duplicates.length) summary.possibleDuplicates += 1;
    }
    return { rows, summary };
  }

  const api = Object.freeze({ readXlsx, parseText, suggestMapping, preview, limits });
  root.TreasuryImport = api;
  if (isNode) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
