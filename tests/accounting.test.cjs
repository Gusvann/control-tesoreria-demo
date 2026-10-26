"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const accounting = require("../accounting.js");

test("Accounting: formats MXN with grouped thousands and two decimal places", () => {
  assert.equal(accounting.format(1234.5), "$1,234.50");
  assert.equal(accounting.format(0.01), "$0.01");
  assert.equal(accounting.format(123456789.25), "$123,456,789.25");
  assert.equal(accounting.formatNumber(1234.5), "1,234.50");
  // Aggregate displays may exceed the editable per-movement limit.
  assert.equal(accounting.format(1e13), "$10,000,000,000,000.00");
});

test("Accounting: computed negatives use parentheses and zero never acquires a minus sign", () => {
  assert.equal(accounting.format(-1234.56), "($1,234.56)");
  assert.equal(accounting.formatNumber(-1234.56), "(1,234.56)");
  for (const value of [0, -0, 0.00001, -0.00001]) {
    assert.equal(accounting.format(value), "$—");
    assert.equal(accounting.formatNumber(value), "—");
  }
  for (const value of [NaN, Infinity, -Infinity, "1234.50", null]) {
    assert.equal(accounting.format(value), "—");
  }
});

test("Accounting: plain numbers, accounting text and pasted MXN preserve their cents", () => {
  for (const text of ["1234.5", "1,234.50", "$1,234.50", "MXN 1,234.50", "MXN $ 1,234.50", "  $\u00a01,234.50  ", "+$1,234.50"]) {
    assert.equal(accounting.parseInput(text), 1234.5, text);
  }
  assert.equal(accounting.parseInput(".50"), 0.5);
  assert.equal(accounting.parseInput("1234."), 1234);
  assert.equal(accounting.parseInput("0001234.50"), 1234.5);
  assert.equal(accounting.parseInput(1234.5), 1234.5);
  assert.equal(accounting.parseInput(0.1 + 0.2), 0.3);
});

test("Accounting: signed values parse without weakening the caller's business rules", () => {
  for (const text of ["-1234.50", "-$1,234.50", "$-1,234.50", "−$1,234.50", "(1,234.50)", "($1,234.50)", "(MXN $ 1,234.50)"]) {
    assert.equal(accounting.parseInput(text), -1234.5, text);
  }
  for (const text of ["0", "0.00", "-0", "−0.00", "$—", "—", "MXN $ —", "($—)"]) {
    assert.equal(accounting.parseInput(text), 0, text);
    assert.equal(Object.is(accounting.parseInput(text), -0), false);
  }
  assert.equal(accounting.parseInput(-1234.5), -1234.5);
  assert.equal(Object.is(accounting.parseInput(-0), -0), false);
});

test("Accounting: malformed, blank, incomplete and foreign-separator inputs never become zero", () => {
  const invalid = [
    "", " ", "-", "−", "+", "$", "MXN", ".", "abc", "NaN", "Infinity",
    "1,23", "1234,567.89", "1,,234.50", "1,234,50", "1.234,56", "1 234.50", "1, 234.50",
    "1e3", "1E+3", "0x10", "1_000", "$1,234.50 USD", "USD 1,234.50", "MXN MXN 1",
    "$$1", "MXN $ $ 1", "(1", "1)", "((1))", "(-1)", "(+1)", "-($1)", "--1", "-$-1",
  ];
  for (const value of invalid) assert.ok(Number.isNaN(accounting.parseInput(value)), JSON.stringify(value));
  for (const value of [null, undefined, {}, [], true, NaN, Infinity, -Infinity]) {
    assert.ok(Number.isNaN(accounting.parseInput(value)), String(value));
  }
});

test("Accounting: excess precision is rejected rather than rounded for persistence", () => {
  for (const value of ["1.001", "12.345", "100.000", ".001", "0.00000000000000001", 1.001, 12.345, 0.001, 1e-20, -1e-20]) {
    assert.ok(Number.isNaN(accounting.parseInput(value)), String(value));
  }
  for (const value of [268435456.03, 536870912.05, 10000000000.03, 9999999999999.99]) {
    assert.equal(accounting.parseInput(value), value);
    assert.equal(accounting.parseInput(accounting.format(value)), value);
    assert.equal(accounting.parseInput(accounting.format(-value)), -value);
  }
  for (const value of ["268435456.031", "536870912.051", "10000000000.031", 268435456.031, 536870912.051, 10000000000.031]) {
    assert.ok(Number.isNaN(accounting.parseInput(value)), String(value));
  }
});

test("Accounting: editable values observe the same upper limit as import and export", () => {
  for (const value of [1e13, -1e13, "10000000000000", "$10,000,000,000,000.00", "999999999999999999999999999999999999.99"]) {
    assert.ok(Number.isNaN(accounting.parseInput(value)), String(value));
  }
  assert.equal(accounting.parseInput("9,999,999,999,999.99"), 9999999999999.99);
});

test("Accounting: input and focus presentation retain values through repeated edits", () => {
  for (const value of [0, 0.01, 1234.5, 12500.75, 268435456.03, -1234.5]) {
    const displayed = accounting.inputValue(value);
    const editing = accounting.editingValue(accounting.parseInput(displayed));
    assert.equal(accounting.parseInput(displayed), value);
    assert.equal(accounting.parseInput(editing), value);
    assert.equal(accounting.inputValue(accounting.parseInput(editing)), displayed);
  }
  assert.equal(accounting.inputValue(1234.5), "1,234.50");
  assert.equal(accounting.editingValue(1234.5), "1234.50");
  assert.equal(accounting.inputValue(0), "—");
  assert.equal(accounting.editingValue(0), "0.00");
});

test("Accounting: legacy precision or range remains visible without silent conversion", () => {
  for (const value of [100.123, -100.123, 1e13, 1e-20, NaN, Infinity]) {
    assert.equal(accounting.inputValue(value), String(value));
    assert.equal(accounting.editingValue(value), String(value));
  }
  assert.equal(accounting.inputValue("1,23"), "1,23");
  assert.equal(accounting.editingValue("1,23"), "1,23");
  assert.equal(accounting.inputValue(null), "");
});

test("Accounting: browser loading exposes the same frozen API without DOM dependencies", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "accounting.js"), "utf8");
  const context = vm.createContext({ Intl });
  vm.runInContext(source, context, { filename: "accounting.js" });
  assert.equal(context.TreasuryAccounting.format(-1234.5), "($1,234.50)");
  assert.equal(context.TreasuryAccounting.parseInput("$1,234.50"), 1234.5);
  assert.equal(Object.isFrozen(context.TreasuryAccounting), true);
});
