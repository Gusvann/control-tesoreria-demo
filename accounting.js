(function (root) {
  "use strict";

  // Formatting never changes stored values. Parsing is a separate, strict
  // boundary so malformed grouping or unfinished edits cannot become zero.
  const digits = new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  });
  const maximum = 1e13;

  function numericCents(value) {
    if (!Number.isFinite(value) || Math.abs(value) >= maximum) return NaN;
    const cents = Math.round(value * 100);
    const rounded = cents / 100;
    const tolerance = Math.min(1e-8, Number.EPSILON * Math.max(1, Math.abs(value)) * 2);
    if (!Number.isSafeInteger(cents) || (value !== 0 && cents === 0)
      || Math.abs(value - rounded) > tolerance) return NaN;
    return rounded === 0 ? 0 : rounded;
  }

  function parseInput(value) {
    if (typeof value === "number") return numericCents(value);
    if (typeof value !== "string") return NaN;
    let text = value.trim().replace(/[\u00a0\u202f]/g, " ");
    if (!text) return NaN;

    let negative = false;
    let hasSign = false;
    if (text.startsWith("(") || text.endsWith(")")) {
      if (!text.startsWith("(") || !text.endsWith(")")) return NaN;
      negative = true;
      hasSign = true;
      text = text.slice(1, -1).trim();
    }
    if (/[()]/.test(text)) return NaN;

    // One sign may precede the currency or follow it. Accounting parentheses
    // already supply the sign; combinations such as (-100) are ambiguous.
    function takeSign() {
      if (!/^[+\-\u2212]/.test(text)) return true;
      if (hasSign) return false;
      hasSign = true;
      negative = text[0] !== "+";
      text = text.slice(1).trimStart();
      return true;
    }
    if (!takeSign()) return NaN;
    text = text.replace(/^MXN\s*/i, "");
    text = text.replace(/^\$\s*/, "");
    if (!takeSign()) return NaN;
    if (text === "—") return 0;

    const valid = /^(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{0,2})?|\.\d{1,2})$/;
    if (!valid.test(text)) return NaN;
    const [integer, fraction = ""] = text.replace(/,/g, "").split(".");
    const cents = Number(integer || "0") * 100 + Number(fraction.padEnd(2, "0"));
    if (!Number.isSafeInteger(cents) || cents >= maximum * 100) return NaN;
    return cents === 0 ? 0 : (negative ? -cents : cents) / 100;
  }

  function parts(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    const number = digits.format(Math.abs(value));
    return { number, zero: number === "0.00", negative: value < 0 };
  }

  function format(value) {
    const item = parts(value);
    if (!item) return "—";
    if (item.zero) return "$—";
    return item.negative ? `($${item.number})` : `$${item.number}`;
  }

  function formatNumber(value) {
    const item = parts(value);
    if (!item || item.zero) return "—";
    return item.negative ? `(${item.number})` : item.number;
  }

  function inputValue(value) {
    const parsed = typeof value === "number" ? parseInput(value) : NaN;
    // Accounting reports show zero as a dash, but editable fields must contain
    // an actual number: a dash can accidentally become part of the next entry.
    return Number.isFinite(parsed) ? (parsed === 0 ? "0.00" : formatNumber(parsed)) : String(value ?? "");
  }

  function editingValue(value) {
    const parsed = typeof value === "number" ? parseInput(value) : NaN;
    return Number.isFinite(parsed) ? parsed.toFixed(2) : String(value ?? "");
  }

  const api = Object.freeze({ format, formatNumber, inputValue, editingValue, parseInput });
  root.TreasuryAccounting = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
