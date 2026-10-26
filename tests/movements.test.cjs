"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const importModule = require("../treasury-import.js");
const accountingModule = require("../accounting.js");

const script = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
assert.match(script, /\binitialize\(\);\s*$/u, "The application must retain its final initialize() call.");
const source = script.replace(/\binitialize\(\);\s*$/u, "");
const STORAGE_KEY = "ivanTreasuryProjectionV2";

// A small DOM adapter keeps these contract tests dependency-free. Browser tests
// remain necessary for focus, native dialog behavior, layout and real events.
class Element {
  constructor(tagName = "DIV") {
    this.tagName = tagName;
    this.value = "";
    this.textContent = "";
    this.innerHTML = "";
    this.checked = false;
    this.disabled = false;
    this.indeterminate = false;
    this.hidden = false;
    this.open = false;
    this.dataset = {};
    this.attributes = {};
    this.listeners = new Map();
    this.classes = new Set();
    this.classList = {
      add: (...names) => names.forEach((name) => this.classes.add(name)),
      remove: (...names) => names.forEach((name) => this.classes.delete(name)),
      contains: (name) => this.classes.has(name),
      toggle: (name, on) => {
        const enabled = on === undefined ? !this.classes.has(name) : on;
        if (enabled) this.classes.add(name);
        else this.classes.delete(name);
        return enabled;
      },
    };
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  emit(type, fields = {}) {
    const event = { target: this, preventDefault() {}, ...fields };
    for (const listener of this.listeners.get(type) || []) listener(event);
  }
  focus() { this.focused = true; }
  scrollIntoView() {}
  showModal() { this.open = true; }
  close() { this.open = false; this.emit("close"); }
  reset() { this.resetCount = (this.resetCount || 0) + 1; }
  checkValidity() { return true; }
  reportValidity() { return true; }
  setCustomValidity(message) { this.validationMessage = message; }
  querySelectorAll() { return []; }
  querySelector() { return null; }
  matches(selector) {
    return selector.split(",").some((part) => {
      const value = part.trim();
      const data = /^\[data-([a-z-]+)\]$/u.exec(value);
      if (data) return data[1].replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase()) in this.dataset;
      return value.toLowerCase() === this.tagName.toLowerCase();
    });
  }
  closest(selector) {
    for (let element = this; element; element = element.parentElement) {
      if (element.matches(selector)) return element;
    }
    return null;
  }
}

let harnessSequence = 0;

function harness(saved, options = {}) {
  const harnessId = ++harnessSequence;
  const elements = new Map();
  const values = new Map(saved ? [[STORAGE_KEY, JSON.stringify(saved)]] : []);
  const clock = { now: Date.now() };
  class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock.now])); }
    static now() { return clock.now; }
  }
  const timers = new Map();
  let nextTimerId = 0;
  function schedule(callback, delay = 0, ...args) {
    const id = ++nextTimerId;
    timers.set(id, { callback, delay, at: clock.now + delay, args });
    return id;
  }
  function unschedule(id) { timers.delete(id); }
  const storage = {
    writes: 0,
    fail: false,
    getItem: (key) => {
      if (options.storageReadFails) throw new Error("Storage access denied");
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      if (this.fail) throw new Error("Synthetic storage failure");
      this.writes += 1;
      values.set(key, String(value));
    },
    removeItem: (key) => values.delete(key),
  };
  let nextId = 0;
  const context = vm.createContext({
    console: { warn() {}, error() {}, log() {} },
    Intl,
    Date: ClockDate,
    Set,
    Map,
    structuredClone,
    AbortController,
    TextDecoder,
    TextEncoder,
    TreasuryImport: options.importer || importModule,
    TreasuryAccounting: accountingModule,
    crypto: { randomUUID: () => `synthetic-${harnessId}-${++nextId}` },
    localStorage: storage,
    document: {
      querySelector(selector) {
        if (!elements.has(selector)) elements.set(selector, new Element());
        return elements.get(selector);
      },
      querySelectorAll() { return []; },
      activeElement: new Element("BUTTON"),
      body: new Element("BODY"),
    },
    window: { confirm: () => true, setTimeout: schedule, clearTimeout: unschedule },
    setTimeout: schedule,
    clearTimeout: unschedule,
    requestAnimationFrame: (callback) => callback(),
  });
  vm.runInContext(source, context, { filename: "app.js" });
  return {
    storage,
    elements,
    clock,
    timers,
    advanceTime(milliseconds) {
      clock.now += milliseconds;
      const due = [...timers.entries()].filter(([, timer]) => timer.at <= clock.now);
      for (const [id, timer] of due) {
        if (!timers.has(id)) continue;
        timers.delete(id);
        timer.callback(...timer.args);
      }
    },
    run(code, input) {
      context.input = input;
      return vm.runInContext(code, context);
    },
    json(code, input) {
      context.input = input;
      return JSON.parse(vm.runInContext(`JSON.stringify(${code})`, context));
    },
    day(offset = 0) { return vm.runInContext(`toISODate(addDays(today, ${offset}))`, context); },
    saved() { return JSON.parse(values.get(STORAGE_KEY)); },
  };
}

function movement(id, date, extra = {}) {
  return { id, date, concept: `Movimiento ${id}`, type: "inflow", status: "confirmed", amount: 100, ...extra };
}

function seed(h, movements, accounts = [{ id: "bank-test", name: "Banco de prueba", balance: 1000 }]) {
  h.run('state.mode = "custom"; state.custom = input;', {
    accounts,
    movements,
  });
}

function prepare(h, movements, ids, patch) {
  return h.json("prepareMovementEdit(input.movements, input.ids, input.patch)", { movements, ids, patch });
}

test("R5: validates real ISO dates, including leap years", () => {
  const h = harness();
  for (const valid of [h.day(), "2028-02-29", "2027-12-31"]) {
    assert.equal(h.run("isValidISODate(input)", valid), true, valid);
  }
  for (const invalid of ["", null, undefined, "2027-02-29", "2028-02-30", "2028-13-01", "2028-04-31", "2028-1-01", "not-a-date"]) {
    assert.equal(h.run("isValidISODate(input)", invalid), false, String(invalid));
  }
});

test("R2: table filters combine without changing projection totals", () => {
  const h = harness();
  seed(h, [
    movement("a", h.day(1), { concept: "Cobro Alfa", amount: 200 }),
    movement("b", h.day(2), { concept: "Cobro Beta", status: "pending", amount: 300 }),
    movement("c", h.day(2), { concept: "Pago Alfa", type: "outflow", amount: 50 }),
  ]);
  const before = h.json("getPeriodTotals(getFilteredMovements())");
  h.run('state.movementFilters = { query: "COBRO", type: "inflow", status: "pending", from: input, to: input, scope: "projection" };', h.day(2));
  assert.deepEqual(h.json("getVisibleMovements().map(m => m.id)"), ["b"]);
  assert.deepEqual(h.json("getPeriodTotals(getFilteredMovements())"), before);
  assert.deepEqual(before, { inflows: 500, outflows: 50, inflowCount: 2, outflowCount: 1 });
});

test("R2: table date bounds are inclusive and inverted bounds match nothing", () => {
  const h = harness();
  seed(h, [movement("a", h.day(1)), movement("b", h.day(2)), movement("c", h.day(3))]);
  h.run('state.movementFilters = { query: "", type: "all", status: "all", from: input.from, to: input.to, scope: "all" };', { from: h.day(1), to: h.day(2) });
  assert.deepEqual(h.json("getVisibleMovements().map(m => m.id)"), ["a", "b"]);
  h.run("state.movementFilters.from = input;", h.day(3));
  assert.deepEqual(h.json("getVisibleMovements()"), []);
});

test("R2/R5: all scope exposes historical and excluded records without changing the forecast", () => {
  const h = harness();
  seed(h, [
    movement("past", h.day(-1)),
    movement("today", h.day()),
    movement("edge", h.day(14)),
    movement("future", h.day(15)),
    movement("pending", h.day(1), { status: "pending" }),
  ]);
  h.run("state.includePending = false;");
  assert.deepEqual(h.json("getFilteredMovements().map(m => m.id)"), ["today", "edge"]);
  h.run('state.movementFilters.scope = "all";');
  assert.deepEqual(h.json("getVisibleMovements().map(m => m.id)"), ["past", "today", "pending", "edge", "future"]);
  assert.deepEqual(h.json("getFilteredMovements().map(m => m.id)"), ["today", "edge"]);
});

test("R1/R2: selection synchronization prunes hidden and missing IDs without changing movements", () => {
  const h = harness();
  const movements = [movement("a", h.day(1)), movement("b", h.day(2), { type: "outflow" })];
  seed(h, movements);
  const before = JSON.stringify(movements);
  h.run('state.selectedMovementIds = new Set(["a", "b", "missing"]); state.movementFilters.type = "inflow"; updateMovementSelection();');
  assert.deepEqual(h.json("Array.from(state.selectedMovementIds)"), ["a"]);
  assert.equal(JSON.stringify(movements), before);
  h.run("clearMovementSelection();");
  assert.deepEqual(h.json("Array.from(state.selectedMovementIds)"), []);
});

test("R1: header and edit action reflect none, partial, all, and empty results", () => {
  const h = harness();
  seed(h, [movement("a", h.day(1)), movement("b", h.day(2))]);
  h.run("updateMovementSelection();");
  assert.deepEqual(h.json("[els.selectAllMovements.checked, els.selectAllMovements.indeterminate, els.selectAllMovements.disabled, els.editSelectedMovements.disabled]"), [false, false, false, true]);
  h.run('state.selectedMovementIds.add("a"); updateMovementSelection();');
  assert.deepEqual(h.json("[els.selectAllMovements.checked, els.selectAllMovements.indeterminate, els.editSelectedMovements.disabled]"), [false, true, false]);
  h.run('state.selectedMovementIds.add("b"); updateMovementSelection();');
  assert.deepEqual(h.json("[els.selectAllMovements.checked, els.selectAllMovements.indeterminate, els.editSelectedMovements.disabled]"), [true, false, false]);
  h.run('state.movementFilters.query = "No existe este concepto"; updateMovementSelection();');
  assert.deepEqual(h.json("[els.selectAllMovements.checked, els.selectAllMovements.indeterminate, els.selectAllMovements.disabled, els.editSelectedMovements.disabled]"), [false, false, true, true]);
});

test("R3/R4: one edit preserves every unrequested field and movement", () => {
  const h = harness();
  const movements = [
    movement("a", h.day(1), { amount: 123.45, concept: "Concepto intacto", type: "outflow", status: "pending" }),
    movement("b", h.day(2), { amount: 999 }),
  ];
  const original = JSON.parse(JSON.stringify(movements));
  const result = prepare(h, movements, ["a"], { date: h.day(4) });
  assert.equal(result.changedCount, 1);
  assert.deepEqual(result.movements, [{ ...original[0], date: h.day(4) }, original[1]]);
  assert.deepEqual(movements, original, "preparing an edit must not mutate its input");
});

test("R4: bulk status-only edit preserves mixed dates, amounts and types", () => {
  const h = harness();
  const movements = [movement("a", h.day(-10)), movement("b", h.day(2), { type: "outflow", amount: 450.75 }), movement("c", h.day(3))];
  const result = prepare(h, movements, ["b", "a"], { status: "pending" });
  assert.equal(result.changedCount, 2);
  assert.deepEqual(result.movements, [{ ...movements[0], status: "pending" }, { ...movements[1], status: "pending" }, movements[2]]);
});

test("R4: bulk date-only edit preserves mixed statuses and changes only selected IDs", () => {
  const h = harness();
  const movements = [movement("a", h.day(1)), movement("b", h.day(2), { status: "pending" }), movement("c", h.day(3))];
  const result = prepare(h, movements, ["a", "b"], { date: h.day(5) });
  assert.equal(result.changedCount, 2);
  assert.deepEqual(result.movements, [{ ...movements[0], date: h.day(5) }, { ...movements[1], date: h.day(5) }, movements[2]]);
});

test("R4: count reports changed movements, not changed fields", () => {
  const h = harness();
  const movements = [movement("a", h.day(1)), movement("b", h.day(2))];
  const result = prepare(h, movements, ["a", "b"], { date: h.day(5), status: "pending" });
  assert.equal(result.changedCount, 2);
});

test("R4: an unchanged patch reports zero changes", () => {
  const h = harness();
  const movements = [movement("a", h.day())];
  const result = prepare(h, movements, ["a"], { date: h.day(), status: "confirmed" });
  assert.equal(result.changedCount, 0);
  assert.deepEqual(result.movements, movements);
});

test("R5: changing a historical movement's status preserves its historical date", () => {
  const h = harness();
  const movements = [movement("old", h.day(-100))];
  assert.deepEqual(prepare(h, movements, ["old"], { status: "pending" }).movements, [{ ...movements[0], status: "pending" }]);
});

test("R3/R5: individual dialog omits an unchanged historical date from its status patch", () => {
  const h = harness();
  seed(h, [movement("old", h.day(-100))]);
  h.run('state.movementFilters.scope = "all"; openMovementEditor(["old"]); els.editMovementStatus.value = "pending";');
  assert.deepEqual(h.json("getMovementEditPatch()"), { status: "pending" });
  h.run("updateMovementEditPreview();");
  assert.equal(h.run("els.saveMovementEdit.disabled"), false);
  assert.equal(h.run("els.editMovementError.textContent"), "");
});

test("R7: editing dialog draft and cancelling do not alter records or storage", () => {
  const h = harness();
  seed(h, [movement("a", h.day(1)), movement("b", h.day(2))]);
  const before = h.json("state.custom");
  h.run('openMovementEditor(["a", "b"]);');
  assert.deepEqual(h.json("getMovementEditPatch()"), {}, "bulk modal initially applies no fields");
  h.run('els.editDateEnabled.checked = true; els.editMovementDate.value = input; updateMovementEditPreview();', h.day(6));
  assert.deepEqual(h.json("state.custom"), before);
  assert.equal(h.storage.writes, 0);
  // The native dialog's close event invokes this cleanup. Native Escape and
  // focus restoration are covered separately by browser verification.
  h.run("finishMovementEditor();");
  assert.equal(h.run("state.movementEdit"), null);
  assert.deepEqual(h.json("state.custom"), before);
  assert.equal(h.storage.writes, 0);
});

test("R5: invalid edits reject the entire batch without mutating inputs", async (t) => {
  const h = harness();
  const movements = [movement("a", h.day(1)), movement("b", h.day(2))];
  const original = JSON.stringify(movements);
  const cases = [
    ["empty patch", ["a", "b"], {}],
    ["unsupported field", ["a", "b"], { amount: 999 }],
    ["mixed supported/unsupported fields", ["a", "b"], { status: "pending", concept: "Overwrite" }],
    ["invalid status", ["a", "b"], { status: "approved" }],
    ["empty status", ["a", "b"], { status: "" }],
    ["empty date", ["a", "b"], { date: "" }],
    ["past date", ["a", "b"], { date: h.day(-1) }],
    ["impossible date", ["a", "b"], { date: "2028-02-30" }],
    ["missing ID", ["a", "missing"], { status: "pending" }],
    ["repeated selected ID", ["a", "a"], { status: "pending" }],
    ["empty selection", [], { status: "pending" }],
  ];
  for (const [name, ids, patch] of cases) {
    await t.test(name, () => {
      assert.throws(() => prepare(h, movements, ids, patch));
      assert.equal(JSON.stringify(movements), original);
    });
  }
});

test("R5: duplicate stored IDs reject an ambiguous edit", () => {
  const h = harness();
  const movements = [movement("same", h.day()), movement("same", h.day(1))];
  assert.throws(() => prepare(h, movements, ["same"], { status: "pending" }));
  assert.equal(movements.every((m) => m.status === "confirmed"), true);
});

test("R6: personal commit writes once, preserves accounts, and survives reloading", () => {
  const h = harness();
  seed(h, [movement("a", h.day(1)), movement("b", h.day(2), { type: "outflow", amount: 20 })]);
  const accounts = h.json("state.custom.accounts");
  assert.equal(h.run('commitMovementEdit(["a", "b"], { date: input, status: "pending" }, "custom")', h.day(3)), 2);
  assert.equal(h.storage.writes, 1);
  assert.deepEqual(h.saved(), h.json("state.custom"));
  assert.deepEqual(h.saved().accounts, accounts);
  const reloaded = harness(h.saved());
  assert.deepEqual(reloaded.json("state.custom"), h.saved());
});

test("R6: storage failure leaves in-memory and persisted state unchanged", () => {
  const h = harness();
  seed(h, [movement("a", h.day(1)), movement("b", h.day(2))]);
  const before = h.json("state.custom");
  h.storage.setItem(STORAGE_KEY, JSON.stringify(before));
  h.storage.fail = true;
  assert.throws(() => h.run('commitMovementEdit(["a", "b"], { status: "pending" }, "custom")'));
  assert.deepEqual(h.json("state.custom"), before);
  assert.deepEqual(h.saved(), before);
  assert.equal(h.storage.writes, 1, "failed edit must not add a persisted write");
});

test("R6: rejected batch writes nothing", () => {
  const h = harness();
  seed(h, [movement("a", h.day(1))]);
  const before = h.json("state.custom");
  assert.throws(() => h.run('commitMovementEdit(["a", "missing"], { status: "pending" }, "custom")'));
  assert.deepEqual(h.json("state.custom"), before);
  assert.equal(h.storage.writes, 0);
});

test("R6/R9: an editor opened in another mode cannot commit into the current mode", () => {
  const h = harness();
  seed(h, [movement("a", h.day(1))]);
  const before = h.json("state.custom");
  h.run('state.mode = "demo";');
  assert.throws(() => h.run('commitMovementEdit(["a"], { status: "pending" }, "custom")'));
  assert.deepEqual(h.json("state.custom"), before);
  assert.equal(h.storage.writes, 0);
});

test("R6: moving a movement outside the horizon updates totals and ending balance", () => {
  const h = harness();
  seed(h, [movement("a", h.day(), { amount: 200 }), movement("b", h.day(14), { type: "outflow", amount: 50 })]);
  assert.equal(h.run("getForecastSeries(getFilteredMovements(), getAvailableBalance()).at(-1).balance"), 1150);
  h.run('commitMovementEdit(["b"], { date: input }, "custom")', h.day(15));
  assert.deepEqual(h.json("getPeriodTotals(getFilteredMovements())"), { inflows: 200, outflows: 0, inflowCount: 1, outflowCount: 0 });
  assert.equal(h.run("getForecastSeries(getFilteredMovements(), getAvailableBalance()).at(-1).balance"), 1200);
  assert.equal(h.json("state.custom.movements").length, 2);
});

test("R6: changing status respects the global pending toggle", () => {
  const h = harness();
  seed(h, [movement("a", h.day(1), { amount: 200 })]);
  h.run("state.includePending = false;");
  h.run('commitMovementEdit(["a"], { status: "pending" }, "custom")');
  assert.deepEqual(h.json("getFilteredMovements()"), []);
  assert.equal(h.run("getForecastSeries(getFilteredMovements(), getAvailableBalance()).at(-1).balance"), 1000);
  h.run('state.movementFilters.scope = "all";');
  assert.deepEqual(h.json("getVisibleMovements().map(m => m.id)"), ["a"]);
});

test("R9: demo editing never writes or changes personal movements", () => {
  const h = harness();
  seed(h, [movement("personal", h.day(1))]);
  const personalBefore = h.json("state.custom");
  h.run('state.mode = "demo";');
  const demoBefore = h.json("demoMovements");
  assert.equal(h.run('commitMovementEdit(["d1"], { date: input, status: "pending" }, "demo")', h.day(6)), 1);
  assert.equal(h.storage.writes, 0);
  assert.deepEqual(h.json("state.custom"), personalBefore);
  assert.deepEqual(h.json("demoMovements"), demoBefore);
  assert.equal(h.run('getActiveMovements().find(m => m.id === "d1").date'), h.day(6));
  assert.equal(h.run('getActiveMovements().find(m => m.id === "d1").status'), "pending");
  h.run('state.mode = "custom";');
  assert.deepEqual(h.json("getActiveMovements()"), personalBefore.movements);
});

test("R8: Enter in capture inputs is prevented without changing draft or movements", () => {
  const h = harness();
  seed(h, []);
  h.run('els.movementConcept.value = "Borrador"; els.movementAmount.value = "125.50";');
  let prevented = false;
  h.run("handleCaptureKeydown(input)", { key: "Enter", target: new Element("INPUT"), isComposing: false, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(h.run("els.movementConcept.value"), "Borrador");
  assert.equal(h.run("els.movementAmount.value"), "125.50");
  assert.deepEqual(h.json("state.custom.movements"), []);
  assert.equal(h.storage.writes, 0);
});

test("R8: button activation, composition and non-Enter keys retain normal behavior", () => {
  const h = harness();
  const cases = [
    { key: "Enter", target: new Element("BUTTON"), isComposing: false },
    { key: "Enter", target: new Element("SELECT"), isComposing: false },
    { key: "Enter", target: new Element("INPUT"), isComposing: true },
    { key: "Tab", target: new Element("INPUT"), isComposing: false },
  ];
  for (const event of cases) {
    let prevented = false;
    event.preventDefault = () => { prevented = true; };
    h.run("handleCaptureKeydown(input)", event);
    assert.equal(prevented, false);
  }
});

test("R8: capture save failure preserves both draft and existing records", () => {
  const h = harness();
  seed(h, [movement("existing", h.day(1))]);
  const before = h.json("state.custom");
  h.run('els.movementDate.value = input; els.movementConcept.value = "Borrador nuevo"; els.movementAmount.value = "200"; els.movementType.value = "inflow"; els.movementStatus.value = "confirmed";', h.day(2));
  h.storage.fail = true;
  h.run("addMovement(input)", { preventDefault() {} });
  assert.deepEqual(h.json("state.custom"), before);
  assert.equal(h.run("els.movementConcept.value"), "Borrador nuevo");
  assert.equal(h.run("els.movementDate.value"), h.day(2));
  assert.equal(h.run("els.movementAmount.value"), "200");
  assert.equal(h.run("els.movementForm.resetCount || 0"), 0);
  assert.notEqual(h.run("els.captureFeedback.textContent"), "");
  assert.equal(h.storage.writes, 0);
});

test("R8: invalid capture preserves its draft and does not append a record", () => {
  const h = harness();
  seed(h, []);
  h.run('els.movementDate.value = input; els.movementConcept.value = "Corregir después"; els.movementAmount.value = "0";', h.day());
  h.run("addMovement(input)", { preventDefault() {} });
  assert.deepEqual(h.json("state.custom.movements"), []);
  assert.equal(h.run("els.movementConcept.value"), "Corregir después");
  assert.equal(h.run("els.movementAmount.value"), "0");
  assert.equal(h.run("els.movementForm.resetCount || 0"), 0);
  assert.equal(h.storage.writes, 0);
});

test("R8: explicit capture submission adds exactly one persisted movement", () => {
  const h = harness();
  seed(h, []);
  h.run('els.movementDate.value = input; els.movementConcept.value = "Cobro sintético"; els.movementAmount.value = "125.50"; els.movementType.value = "inflow"; els.movementStatus.value = "pending";', h.day(2));
  h.run("addMovement(input)", { preventDefault() {} });
  assert.equal(h.run("state.custom.movements.length"), 1);
  assert.deepEqual(h.saved(), h.json("state.custom"));
  assert.equal(h.saved().movements[0].concept, "Cobro sintético");
  assert.equal(h.saved().movements[0].amount, 125.5);
  assert.equal(h.saved().movements[0].status, "pending");
  assert.equal(h.saved().movements[0].date, h.day(2));
  assert.equal(h.storage.writes, 1);
  assert.equal(h.run("els.movementForm.resetCount"), 1);
});

test("R1/R2: initialized event handlers select visible rows and clear selection when filters change", () => {
  const h = harness();
  seed(h, [movement("a", h.day(1)), movement("b", h.day(2), { type: "outflow", amount: 20 }), movement("outside", h.day(20))]);
  h.run("initialize();");
  h.elements.get("#customModeButton").emit("click");
  assert.equal(h.run("state.mode"), "custom");
  const totalsBefore = h.json("getPeriodTotals(getFilteredMovements())");
  const header = h.elements.get("#selectAllMovements");
  header.checked = true;
  header.emit("change");
  assert.deepEqual(h.json("Array.from(state.selectedMovementIds)"), ["a", "b"]);
  const filter = h.elements.get("#movementTypeFilter");
  filter.value = "outflow";
  filter.emit("change");
  assert.deepEqual(h.json("Array.from(state.selectedMovementIds)"), []);
  assert.deepEqual(h.json("getVisibleMovements().map(m => m.id)"), ["b"]);
  assert.deepEqual(h.json("getPeriodTotals(getFilteredMovements())"), totalsBefore);
  header.checked = true;
  header.emit("change");
  assert.deepEqual(h.json("Array.from(state.selectedMovementIds)"), ["b"]);
  h.elements.get("#horizon").value = "30";
  h.elements.get("#horizon").emit("change");
  assert.deepEqual(h.json("Array.from(state.selectedMovementIds)"), []);
  assert.equal(h.run("state.horizon"), 30);
});

test("R3/R7: double click opens one movement; checkbox double click does not; Cancel discards draft", () => {
  const h = harness();
  seed(h, [movement("a", h.day(1))]);
  h.run("initialize();");
  h.elements.get("#customModeButton").emit("click");
  const row = new Element("TR");
  row.dataset.movementId = "a";
  const checkbox = new Element("INPUT");
  checkbox.dataset.selectMovement = "a";
  checkbox.parentElement = row;
  const tbody = h.elements.get("#movementsTableBody");
  tbody.emit("dblclick", { target: checkbox });
  assert.equal(h.run("state.movementEdit"), null);
  tbody.emit("dblclick", { target: row });
  assert.deepEqual(h.json("state.movementEdit.ids"), ["a"]);
  assert.equal(h.run("els.movementEditDialog.open"), true);
  h.run('els.editMovementStatus.value = "pending";');
  h.elements.get("#cancelMovementEdit").emit("click");
  assert.equal(h.run("state.movementEdit"), null);
  assert.equal(h.run("els.movementEditDialog.open"), false);
  assert.equal(h.run('state.custom.movements[0].status'), "confirmed");
  assert.equal(h.storage.writes, 0);
});

test("R8: initialized capture keydown wiring preserves a draft on Enter", () => {
  const h = harness();
  h.run("initialize();");
  h.elements.get("#customModeButton").emit("click");
  h.run('els.movementConcept.value = "Sigue aquí";');
  let prevented = false;
  h.elements.get("#movementForm").emit("keydown", {
    key: "Enter", target: new Element("INPUT"), isComposing: false,
    preventDefault() { prevented = true; },
  });
  assert.equal(prevented, true);
  assert.equal(h.run("els.movementConcept.value"), "Sigue aquí");
  assert.equal(h.run("state.custom.movements.length"), 0);
});

// Optional payment-bank assignment. Every record and account in these cases is
// synthetic; a bank assignment is metadata and must not alter cash balances.
function payment(id, date, extra = {}) {
  return movement(id, date, { type: "outflow", ...extra });
}

function paymentDraft(h, bankId = "") {
  h.run('els.movementDate.value = input.date; els.movementConcept.value = "Pago sintético"; els.movementAmount.value = "125.50"; els.movementType.value = "outflow"; els.movementStatus.value = "pending"; els.movementBank.value = input.bankId;', { date: h.day(2), bankId });
}

test("R10: legacy payments without bankId load without losing their financial data", () => {
  const legacy = {
    accounts: [{ id: "bank-legacy", name: "Banco histórico", balance: 1234.5 }],
    movements: [payment("old-payment", "2028-05-01", { amount: 987.65 }), movement("old-inflow", "2028-05-02")],
  };
  const h = harness(legacy);
  assert.deepEqual(h.json("state.custom"), legacy);
  assert.equal(h.run("getMovementBankId(state.custom.movements[0])"), "");
  assert.equal(h.run("getMovementBankLabel(state.custom.movements[0], state.custom.accounts)"), "Sin banco asignado");
  assert.equal(h.storage.writes, 0, "reading a legacy projection must not rewrite it");
});

test("R10: bank IDs apply only to payments and malformed optional values mean unassigned", () => {
  const h = harness();
  for (const value of [undefined, null, 123, {}, []]) {
    assert.equal(h.run("getMovementBankId(input)", payment("a", h.day(), { bankId: value })), "");
  }
  assert.equal(h.run("getMovementBankId(input)", payment("a", h.day(), { bankId: "bank-test" })), "bank-test");
  assert.equal(h.run("getMovementBankId(input)", movement("a", h.day(), { bankId: "bank-test" })), "");
});

test("R10: a payment can be saved with an empty optional bank", () => {
  const h = harness();
  seed(h, []);
  paymentDraft(h);
  h.run("addMovement(input)", { preventDefault() {} });
  assert.equal(h.run("state.custom.movements.length"), 1);
  assert.equal(h.run("state.custom.movements[0].type"), "outflow");
  assert.equal(h.run("getMovementBankId(state.custom.movements[0])"), "");
  assert.equal(h.saved().movements[0].amount, 125.5);
  assert.equal(h.storage.writes, 1);
});

test("R10: assigned payment capture persists the stable account ID across reload", () => {
  const h = harness();
  seed(h, []);
  paymentDraft(h, "bank-test");
  h.run("addMovement(input)", { preventDefault() {} });
  assert.equal(h.saved().movements[0].bankId, "bank-test");
  assert.deepEqual(h.saved().accounts, [{ id: "bank-test", name: "Banco de prueba", balance: 1000 }]);
  const reloaded = harness(h.saved());
  assert.equal(reloaded.run("getMovementBankId(state.custom.movements[0])"), "bank-test");
  assert.equal(reloaded.run("getMovementBankLabel(state.custom.movements[0], state.custom.accounts)"), "Banco de prueba");
});

test("R10: an inflow ignores a residual bank choice when explicitly submitted", () => {
  const h = harness();
  seed(h, []);
  paymentDraft(h, "bank-test");
  h.run('els.movementType.value = "inflow"; addMovement(input);', { preventDefault() {} });
  assert.equal(h.run("state.custom.movements[0].type"), "inflow");
  assert.equal(h.run("getMovementBankId(state.custom.movements[0])"), "");
  assert.equal(h.saved().movements[0].bankId ?? "", "");
});

test("R10: unknown bank capture rejects the submission and keeps the draft", () => {
  const h = harness();
  seed(h, []);
  paymentDraft(h, "bank-not-registered");
  h.run("addMovement(input)", { preventDefault() {} });
  assert.deepEqual(h.json("state.custom.movements"), []);
  assert.equal(h.run("els.movementConcept.value"), "Pago sintético");
  assert.equal(h.run("els.movementAmount.value"), "125.50");
  assert.equal(h.storage.writes, 0);
  assert.notEqual(h.run("els.captureFeedback.textContent"), "");
});

test("R10: assigning, changing and removing a payment bank preserve all financial values", () => {
  const h = harness();
  const accounts = [
    { id: "bank-a", name: "Banco Alfa", balance: 800 },
    { id: "bank-b", name: "Banco Beta", balance: 200 },
  ];
  seed(h, [payment("p", h.day(1), { amount: 45.67 }), movement("i", h.day(2), { amount: 100 })], accounts);
  const before = h.json("state.custom");
  const totals = h.json("getPeriodTotals(getFilteredMovements())");
  const balance = h.run("getForecastSeries(getFilteredMovements(), getAvailableBalance()).at(-1).balance");
  assert.equal(h.run('commitMovementEdit(["p"], { bankId: "bank-a" }, "custom")'), 1);
  assert.equal(h.run('commitMovementEdit(["p"], { bankId: "bank-b" }, "custom")'), 1);
  assert.equal(h.run("getMovementBankLabel(state.custom.movements[0])"), "Banco Beta");
  assert.equal(h.run('commitMovementEdit(["p"], { bankId: "" }, "custom")'), 1);
  assert.equal(h.run("getMovementBankId(state.custom.movements[0])"), "");
  assert.deepEqual(h.json("state.custom.accounts"), before.accounts);
  assert.deepEqual(h.json("state.custom.movements.map(({ bankId, ...financial }) => financial)"), before.movements);
  assert.deepEqual(h.json("getPeriodTotals(getFilteredMovements())"), totals);
  assert.equal(h.run("getForecastSeries(getFilteredMovements(), getAvailableBalance()).at(-1).balance"), balance);
  assert.equal(h.storage.writes, 3);
});

test("R10: clearing an already-unassigned legacy payment is a no-op", () => {
  const h = harness();
  seed(h, [payment("p", h.day(1))]);
  const before = h.json("state.custom");
  assert.equal(h.run('commitMovementEdit(["p"], { bankId: "" }, "custom")'), 0);
  assert.deepEqual(h.json("state.custom"), before);
  assert.equal(h.storage.writes, 0);
});

test("R10: a payment-only batch can share a bank while preserving mixed dates and statuses", () => {
  const h = harness();
  seed(h, [payment("p1", h.day(-2)), payment("p2", h.day(3), { status: "pending", amount: 50 }), payment("other", h.day(4))]);
  const before = h.json("state.custom.movements");
  assert.equal(h.run('commitMovementEdit(["p1", "p2"], { bankId: "bank-test" }, "custom")'), 2);
  assert.deepEqual(h.json("state.custom.movements"), [{ ...before[0], bankId: "bank-test" }, { ...before[1], bankId: "bank-test" }, before[2]]);
  assert.equal(h.storage.writes, 1);
});

test("R10: mixed inflow/payment batches reject bank assignment and clearing atomically", () => {
  const h = harness();
  seed(h, [payment("p", h.day(1)), movement("i", h.day(2))]);
  const before = h.json("state.custom");
  for (const bankId of ["bank-test", ""]) {
    assert.throws(() => h.run('commitMovementEdit(["p", "i"], { bankId: input, status: "pending" }, "custom")', bankId));
    assert.deepEqual(h.json("state.custom"), before);
    assert.equal(h.storage.writes, 0);
  }
  assert.equal(h.run('commitMovementEdit(["p", "i"], { status: "pending" }, "custom")'), 2, "a mixed batch must still support the previously authorized status edit");
});

test("R10: unknown or ambiguous bank IDs cannot partially apply other fields", () => {
  const h = harness();
  seed(h, [payment("p", h.day(1))]);
  const before = h.json("state.custom");
  for (const bankId of ["unknown", 123, null]) {
    assert.throws(() => h.run('commitMovementEdit(["p"], { bankId: input, status: "pending" }, "custom")', bankId));
    assert.deepEqual(h.json("state.custom"), before);
    assert.equal(h.storage.writes, 0);
  }
  h.run('state.custom.accounts.push({ id: "bank-test", name: "Otra cuenta con ID duplicado", balance: 5 });');
  const duplicated = h.json("state.custom");
  assert.throws(() => h.run('commitMovementEdit(["p"], { bankId: "bank-test", status: "pending" }, "custom")'));
  assert.deepEqual(h.json("state.custom"), duplicated);
  assert.equal(h.storage.writes, 0);
});

test("R10: renaming a bank preserves its ID and resolves the current name", () => {
  const h = harness();
  seed(h, [payment("p", h.day(1), { bankId: "bank-test" })]);
  h.run('state.custom.accounts[0].name = "Banco renombrado";');
  assert.equal(h.run("getMovementBankId(state.custom.movements[0])"), "bank-test");
  assert.equal(h.run("getMovementBankLabel(state.custom.movements[0])"), "Banco renombrado");
});

test("R10: removing and re-adding accounts never remaps a payment to a new bank", () => {
  const h = harness();
  seed(h, [payment("p", h.day(1), { bankId: "bank-b" })], [
    { id: "bank-a", name: "Banco Alfa", balance: 800 },
    { id: "bank-b", name: "Banco Beta", balance: 200 },
  ]);
  h.run('commitBankRemoval("bank-b");');
  assert.equal(h.run("getMovementBankId(state.custom.movements[0])"), "bank-b");
  assert.equal(h.run("getMovementBankLabel(state.custom.movements[0])"), "Banco no disponible");
  h.run("syncBankCount(2);");
  assert.notEqual(h.run("state.custom.accounts[1].id"), "bank-b");
  assert.equal(h.run("getMovementBankId(state.custom.movements[0])"), "bank-b");
  assert.equal(h.run("getMovementBankLabel(state.custom.movements[0])"), "Banco no disponible");
  const reloaded = harness(h.saved());
  assert.equal(reloaded.run("getMovementBankId(state.custom.movements[0])"), "bank-b");
  assert.equal(reloaded.run("getMovementBankLabel(state.custom.movements[0], state.custom.accounts)"), "Banco no disponible");
});

test("R10: an orphan bank does not block individual status editing and can be explicitly cleared", () => {
  const h = harness();
  seed(h, [payment("p", h.day(-2), { bankId: "removed-bank" })]);
  h.run('openMovementEditor(["p"]); els.editMovementStatus.value = "pending";');
  assert.deepEqual(h.json("getMovementEditPatch()"), { status: "pending" });
  h.run("updateMovementEditPreview();");
  assert.equal(h.run("els.saveMovementEdit.disabled"), false);
  h.run('commitMovementEdit(["p"], getMovementEditPatch(), "custom");');
  assert.equal(h.run("getMovementBankId(state.custom.movements[0])"), "removed-bank");
  assert.equal(h.run('commitMovementEdit(["p"], { bankId: "" }, "custom")'), 1);
  assert.equal(h.run("getMovementBankId(state.custom.movements[0])"), "");
});

test("R10: payment bank controls are optional and mixed editors do not apply a bank", () => {
  const h = harness();
  seed(h, [payment("p1", h.day(1)), payment("p2", h.day(2), { bankId: "bank-test" }), movement("i", h.day(3))]);
  h.run('openMovementEditor(["p1"]);');
  assert.equal(h.run("els.editBankField.hidden"), false);
  assert.equal(h.run("els.editBankEnabled.checked"), true);
  assert.deepEqual(h.json("getMovementEditPatch()"), {});
  h.run('openMovementEditor(["p1", "p2"]);');
  assert.equal(h.run("els.editBankField.hidden"), false);
  assert.equal(h.run("els.editBankEnabled.checked"), false);
  assert.deepEqual(h.json("getMovementEditPatch()"), {});
  h.run('openMovementEditor(["p1", "i"]);');
  assert.equal(h.run("els.editBankField.hidden"), true);
  assert.equal(h.run("els.editBankEnabled.checked"), false);
  h.run('els.editStatusEnabled.checked = true; els.editMovementStatus.value = "pending";');
  assert.deepEqual(h.json("getMovementEditPatch()"), { status: "pending" });
});

test("R10/R8: Enter and storage failure preserve a payment draft including its chosen bank", () => {
  const h = harness();
  seed(h, []);
  paymentDraft(h, "bank-test");
  let prevented = false;
  h.run("handleCaptureKeydown(input)", { key: "Enter", target: new Element("INPUT"), isComposing: false, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(h.run("els.movementBank.value"), "bank-test");
  assert.equal(h.run("els.movementAmount.value"), "125.50");
  h.storage.fail = true;
  h.run("addMovement(input)", { preventDefault() {} });
  assert.equal(h.run("els.movementBank.value"), "bank-test");
  assert.equal(h.run("els.movementConcept.value"), "Pago sintético");
  assert.deepEqual(h.json("state.custom.movements"), []);
  assert.equal(h.storage.writes, 0);
});

test("R10: assigning a bank respects the same atomic storage guarantee as date/status edits", () => {
  const h = harness();
  seed(h, [payment("p", h.day(1))]);
  const before = h.json("state.custom");
  h.storage.setItem(STORAGE_KEY, JSON.stringify(before));
  h.storage.fail = true;
  assert.throws(() => h.run('commitMovementEdit(["p"], { bankId: "bank-test" }, "custom")'));
  assert.deepEqual(h.json("state.custom"), before);
  assert.deepEqual(h.saved(), before);
});

test("R10: demo bank edits are isolated and never persisted into personal data", () => {
  const h = harness();
  seed(h, [payment("personal", h.day(1))]);
  const before = h.json("state.custom");
  h.run('state.mode = "demo";');
  assert.equal(h.run('commitMovementEdit(["d2"], { bankId: "demo-2" }, "demo")'), 1);
  assert.equal(h.run('getMovementBankId(getActiveMovements().find(m => m.id === "d2"))'), "demo-2");
  assert.equal(h.run('getMovementBankLabel(getActiveMovements().find(m => m.id === "d2"))'), "Institución Demo B");
  assert.deepEqual(h.json("state.custom"), before);
  assert.equal(h.storage.writes, 0);
});

// Extended movement management. These contracts intentionally use small,
// hand-calculated examples instead of reproducing the implementation.
const treasuryAccounts = [
  { id: "bank-a", name: "Banco Alfa", balance: 1000 },
  { id: "bank-b", name: "Banco Beta", balance: 500 },
  { id: "bank-c", name: "Banco Gamma", balance: 250 },
];

function seedTreasury(h, movements) {
  seed(h, movements, treasuryAccounts.map((account) => ({ ...account })));
}

function transfer(id, date, extra = {}) {
  return movement(id, date, { type: "transfer", fromBankId: "bank-a", toBankId: "bank-b", ...extra });
}

function transferDraft(h, extra = {}) {
  h.run('els.movementDate.value = input.date; els.movementConcept.value = input.concept; els.movementAmount.value = String(input.amount); els.movementType.value = "transfer"; els.movementStatus.value = "pending"; els.transferFromBank.value = input.fromBankId; els.transferToBank.value = input.toBankId;', {
    date: h.day(2), concept: "Traspaso sintético", amount: 40.25, fromBankId: "bank-a", toBankId: "bank-b", ...extra,
  });
}

test("EXT horizon: 60 and 90 days include their endpoint and exclude the following day", () => {
  const h = harness();
  seedTreasury(h, [movement("day60", h.day(60), { amount: 60 }), payment("day61", h.day(61), { amount: 10 }), movement("day90", h.day(90), { amount: 90 }), payment("day91", h.day(91), { amount: 100 })]);
  h.run("state.horizon = 60;");
  assert.deepEqual(h.json("getFilteredMovements().map(m => m.id)"), ["day60"]);
  assert.equal(h.run("getForecastSeries(getFilteredMovements(), getAvailableBalance()).length"), 61);
  h.run("state.horizon = 90;");
  assert.deepEqual(h.json("getFilteredMovements().map(m => m.id)"), ["day60", "day61", "day90"]);
  assert.equal(h.run("getForecastSeries(getFilteredMovements(), getAvailableBalance()).length"), 91);
  assert.equal(h.run("getForecastSeries(getFilteredMovements(), getAvailableBalance()).at(-1).balance"), 1890);
  assert.equal(h.run("toISODate(getForecastSeries(getFilteredMovements(), getAvailableBalance()).at(-1).date)"), h.day(90));
});

test("EXT detail: movement amounts and monetary KPIs retain two decimals", () => {
  const h = harness();
  assert.equal(h.run("detailCurrency.format(100.49)"), "$100.49");
  assert.equal(h.run("detailCurrency.format(100)"), "$100.00");
  assert.equal(h.run("detailCurrency.format(0.01)"), "$0.01");
  assert.equal(h.run("currency.format(100.49)"), "$100.49");
});

test("EXT categories: used payment categories follow the catalog and unassigned is always last", () => {
  const h = harness();
  const rows = [
    payment("none", h.day(1)), payment("tax", h.day(2), { categoryId: "impuestos", amount: 50 }),
    payment("cost1", h.day(2), { categoryId: "costos", amount: 20 }), payment("cost2", h.day(3), { categoryId: "costos", amount: 30 }),
    movement("income", h.day(1), { categoryId: "nomina" }), transfer("transfer", h.day(2)),
  ];
  seedTreasury(h, rows);
  assert.deepEqual(h.json("CATEGORY_OPTIONS.map(option => option.id)"), ["costos", "gastos", "nomina", "financieros", "impuestos", "otros"]);
  assert.deepEqual(h.json("getPaymentGroups().map(group => ({ id: group.id, ids: group.movements.map(m => m.id), total: group.total }))"), [
    { id: "costos", ids: ["cost1", "cost2"], total: 50 },
    { id: "impuestos", ids: ["tax"], total: 50 },
    { id: "", ids: ["none"], total: 100 },
  ]);
  assert.equal(h.run("getMovementCategoryId(state.custom.movements[4])"), "");
  assert.equal(h.run("getMovementCategoryLabel(state.custom.movements[0])"), "Sin categoría");
  assert.deepEqual(h.json("getPaymentGroups([]).map(group => ({ id: group.id, total: group.total, count: group.movements.length }))"), [{ id: "", total: 0, count: 0 }]);
  assert.deepEqual(h.json("getPaymentGroups([state.custom.movements[1]]).map(group => group.id)"), ["impuestos", ""]);
});

test("EXT categories: assignment, change and clearing preserve other fields and support batches of payments", () => {
  const h = harness();
  seedTreasury(h, [payment("a", h.day(-2)), payment("b", h.day(3), { categoryId: "gastos", status: "pending" }), movement("other", h.day(1))]);
  const before = h.json("state.custom");
  assert.equal(h.run('commitMovementEdit(["a", "b"], { categoryId: "nomina" }, "custom")'), 2);
  assert.deepEqual(h.json("state.custom.movements"), [{ ...before.movements[0], categoryId: "nomina" }, { ...before.movements[1], categoryId: "nomina" }, before.movements[2]]);
  assert.equal(h.run('commitMovementEdit(["a"], { categoryId: "" }, "custom")'), 1);
  assert.equal(h.run("getMovementCategoryId(state.custom.movements[0])"), "");
  assert.deepEqual(h.json("state.custom.accounts"), before.accounts);
  assert.equal(h.storage.writes, 2);
});

test("EXT categories: empty legacy category is a no-op and invalid or mixed batches reject atomically", () => {
  const h = harness();
  seedTreasury(h, [payment("p", h.day(1)), movement("i", h.day(1)), transfer("t", h.day(1))]);
  const before = h.json("state.custom");
  assert.equal(h.run('commitMovementEdit(["p"], { categoryId: "" }, "custom")'), 0);
  for (const patch of [{ categoryId: "unknown" }, { categoryId: null }, { categoryId: 3 }]) {
    assert.throws(() => h.run('commitMovementEdit(["p"], input, "custom")', patch));
  }
  for (const ids of [["p", "i"], ["p", "t"]]) {
    assert.throws(() => h.run('commitMovementEdit(input, { categoryId: "costos", status: "pending" }, "custom")', ids));
    assert.throws(() => h.run('commitMovementEdit(input, { categoryId: "" }, "custom")', ids));
  }
  assert.deepEqual(h.json("state.custom"), before);
  assert.equal(h.storage.writes, 0);
});

test("EXT categories: capture and reload preserve an optional payment category", () => {
  const h = harness();
  seed(h, []);
  paymentDraft(h);
  h.run('els.movementCategory.value = "gastos"; addMovement(input);', { preventDefault() {} });
  assert.equal(h.saved().movements[0].categoryId, "gastos");
  const reloaded = harness(h.saved());
  assert.equal(reloaded.run("getMovementCategoryId(state.custom.movements[0])"), "gastos");
  assert.equal(reloaded.run("state.custom.movements[0].amount"), 125.5);
});

test("EXT filters: bank matches payment assignment or either transfer endpoint, never unassigned income", () => {
  const h = harness();
  seedTreasury(h, [payment("assigned", h.day(1), { bankId: "bank-a", categoryId: "costos" }), payment("none", h.day(2)), payment("orphan", h.day(3), { bankId: "missing" }), movement("income", h.day(1)), transfer("out", h.day(4)), transfer("in", h.day(5), { fromBankId: "bank-c", toBankId: "bank-a" }), transfer("orphan-transfer", h.day(6), { fromBankId: "missing" })]);
  const totals = h.json("getPeriodTotals(getFilteredMovements())");
  h.run('state.movementFilters.bank = "bank-a";');
  assert.deepEqual(h.json("getVisibleMovements().map(m => m.id)"), ["assigned", "out", "in"]);
  h.run('state.movementFilters.bank = "unassigned";');
  assert.deepEqual(h.json("getVisibleMovements().map(m => m.id)"), ["none"]);
  h.run('state.movementFilters.bank = "unavailable";');
  assert.deepEqual(h.json("getVisibleMovements().map(m => m.id)"), ["orphan", "orphan-transfer"]);
  assert.deepEqual(h.json("getPeriodTotals(getFilteredMovements())"), totals);
});

test("EXT filters: category filters affect payments only and legacy filter objects stay compatible", () => {
  const h = harness();
  seedTreasury(h, [payment("cost", h.day(1), { categoryId: "costos", bankId: "bank-a" }), payment("none", h.day(2)), movement("income", h.day(3)), transfer("t", h.day(4))]);
  h.run('state.movementFilters.category = "costos"; state.movementFilters.bank = "bank-a";');
  assert.deepEqual(h.json("getVisibleMovements().map(m => m.id)"), ["cost"]);
  h.run('state.movementFilters.category = "unassigned"; state.movementFilters.bank = "all";');
  assert.deepEqual(h.json("getVisibleMovements().map(m => m.id)"), ["none"]);
  h.run('state.movementFilters = { query: "", type: "all", status: "all", from: "", to: "", scope: "projection" };');
  assert.deepEqual(h.json("getVisibleMovements().map(m => m.id)"), ["cost", "none", "income", "t"]);
});

test("EXT transfers: internal transfers do not inflate external cash totals or the consolidated forecast", () => {
  const h = harness();
  seedTreasury(h, [movement("income", h.day(1), { amount: 300 }), payment("payment", h.day(2), { amount: 120 }), transfer("transfer", h.day(), { amount: 900, status: "pending" })]);
  assert.deepEqual(h.json("getPeriodTotals(getFilteredMovements())"), { inflows: 300, outflows: 120, inflowCount: 1, outflowCount: 1 });
  assert.equal(h.run("getMovementCashImpact(state.custom.movements[2])"), 0);
  assert.equal(h.run("getMovementCashImpact(state.custom.movements[0])"), 300);
  assert.equal(h.run("getMovementCashImpact(state.custom.movements[1])"), -120);
  assert.equal(h.run("getForecastSeries(getFilteredMovements(), getAvailableBalance())[0].balance"), 1750);
  assert.equal(h.run("getForecastSeries(getFilteredMovements(), getAvailableBalance()).at(-1).balance"), 1930);
  assert.deepEqual(h.json("getSelectionTotals(state.custom.movements)"), { count: 3, inflows: 300, outflows: 120, transfers: 900, net: 180 });
  h.run("state.includePending = false;");
  assert.equal(h.run("getForecastSeries(getFilteredMovements(), getAvailableBalance()).at(-1).balance"), 1930);
  assert.deepEqual(h.json("getSelectionTotals([])"), { count: 0, inflows: 0, outflows: 0, transfers: 0, net: 0 });
});

test("EXT transfers: account transfer nets conserve the consolidated balance and ignore external payments", () => {
  const h = harness();
  const rows = [transfer("ab", h.day(1), { amount: 120 }), transfer("ba", h.day(2), { fromBankId: "bank-b", toBankId: "bank-a", amount: 20 }), payment("payment", h.day(1), { bankId: "bank-a", amount: 900 })];
  seedTreasury(h, rows);
  assert.equal(h.run('getAccountTransferNet("bank-a", state.custom.movements)'), -100);
  assert.equal(h.run('getAccountTransferNet("bank-b", state.custom.movements)'), 100);
  assert.equal(h.run('getAccountTransferNet("bank-c", state.custom.movements)'), 0);
  assert.equal(h.run('getAccountTransferNet("bank-a", state.custom.movements) + getAccountTransferNet("bank-b", state.custom.movements)'), 0);
});

test("EXT transfers: capture and reload retain transfer type/endpoints without payment metadata", () => {
  const h = harness();
  seedTreasury(h, []);
  transferDraft(h);
  h.run('els.movementBank.value = "bank-a"; els.movementCategory.value = "nomina"; addMovement(input);', { preventDefault() {} });
  assert.equal(h.run("state.custom.movements.length"), 1);
  const row = h.saved().movements[0];
  assert.equal(row.type, "transfer");
  assert.equal(row.fromBankId, "bank-a");
  assert.equal(row.toBankId, "bank-b");
  assert.equal(row.bankId, undefined);
  assert.equal(row.categoryId, undefined);
  const reloaded = harness(h.saved());
  assert.deepEqual(reloaded.json("state.custom"), h.saved());
  assert.equal(reloaded.run("getMovementCashImpact(state.custom.movements[0])"), 0);
});

test("EXT transfers: captured endpoints must be distinct existing accounts and failures retain the draft", () => {
  const h = harness();
  seedTreasury(h, []);
  for (const endpoints of [{ fromBankId: "bank-a", toBankId: "bank-a" }, { fromBankId: "missing", toBankId: "bank-b" }, { fromBankId: "bank-a", toBankId: "" }]) {
    transferDraft(h, endpoints);
    h.run("addMovement(input)", { preventDefault() {} });
    assert.deepEqual(h.json("state.custom.movements"), []);
    assert.equal(h.run("els.movementConcept.value"), "Traspaso sintético");
    assert.equal(h.run("els.transferFromBank.value"), endpoints.fromBankId);
    assert.equal(h.run("els.transferToBank.value"), endpoints.toBankId);
    assert.notEqual(h.run("els.captureFeedback.textContent"), "");
  }
  assert.equal(h.storage.writes, 0);
});

test("EXT transfers: storage rejection keeps endpoints and the unsubmitted transfer draft", () => {
  const h = harness();
  seedTreasury(h, []);
  transferDraft(h);
  h.storage.fail = true;
  h.run("addMovement(input)", { preventDefault() {} });
  assert.deepEqual(h.json("state.custom.movements"), []);
  assert.equal(h.run("els.transferFromBank.value"), "bank-a");
  assert.equal(h.run("els.transferToBank.value"), "bank-b");
  assert.equal(h.run("els.movementAmount.value"), "40.25");
  assert.equal(h.storage.writes, 0);
});

test("EXT transfers: a persisted orphan remains an internal transfer instead of becoming income", () => {
  const saved = { accounts: treasuryAccounts, movements: [transfer("orphan", "2028-05-01", { toBankId: "removed" })] };
  const h = harness(saved);
  assert.equal(h.run("state.custom.movements[0].type"), "transfer");
  assert.equal(h.run("state.custom.movements[0].toBankId"), "removed");
  assert.equal(h.run("getMovementCashImpact(state.custom.movements[0])"), 0);
  assert.deepEqual(h.json("getPeriodTotals(state.custom.movements)"), { inflows: 0, outflows: 0, inflowCount: 0, outflowCount: 0 });
});

test("EXT individual editing: concept is trimmed and cents amounts change only the target", () => {
  const h = harness();
  seedTreasury(h, [payment("p", h.day(1), { bankId: "bank-a", categoryId: "nomina" }), movement("other", h.day(2))]);
  const before = h.json("state.custom.movements");
  assert.equal(h.run('commitMovementEdit(["p"], { concept: "  Concepto corregido  ", amount: 1.12 }, "custom")'), 1);
  assert.deepEqual(h.json("state.custom.movements"), [{ ...before[0], concept: "Concepto corregido", amount: 1.12 }, before[1]]);
  assert.equal(h.storage.writes, 1);
});

test("EXT individual editing: invalid concept/amount patches are atomic and cannot be smuggled into a batch", () => {
  const h = harness();
  seedTreasury(h, [payment("a", h.day(1)), payment("b", h.day(2))]);
  const before = h.json("state.custom");
  for (const patch of [{ concept: "   " }, { concept: "a".repeat(71) }, { concept: 123 }, { amount: 0 }, { amount: -1 }, { amount: 1.001 }, { amount: NaN }, { amount: Infinity }, { amount: "20" }, { type: "inflow" }]) {
    assert.throws(() => h.run('commitMovementEdit(["a"], { ...input, status: "pending" }, "custom")', patch));
  }
  for (const patch of [{ amount: 200 }, { concept: "Changed" }]) {
    assert.throws(() => h.run('commitMovementEdit(["a", "b"], { ...input, status: "pending" }, "custom")', patch));
  }
  assert.deepEqual(h.json("state.custom"), before);
  assert.equal(h.storage.writes, 0);
});

test("EXT transfer editing: endpoint changes are individual, distinct and restricted to transfers", () => {
  const h = harness();
  seedTreasury(h, [transfer("t", h.day(1)), transfer("t2", h.day(2)), payment("p", h.day(1))]);
  assert.equal(h.run('commitMovementEdit(["t"], { toBankId: "bank-c", amount: 25.01 }, "custom")'), 1);
  assert.equal(h.run("state.custom.movements[0].fromBankId"), "bank-a");
  assert.equal(h.run("state.custom.movements[0].toBankId"), "bank-c");
  const before = h.json("state.custom");
  for (const [ids, patch] of [
    [["t"], { toBankId: "bank-a" }], [["t"], { fromBankId: "missing" }], [["t"], { toBankId: "" }],
    [["t", "t2"], { toBankId: "bank-b" }], [["p"], { fromBankId: "bank-a" }], [["t"], { bankId: "bank-a" }], [["t"], { categoryId: "gastos" }],
  ]) {
    assert.throws(() => h.run('commitMovementEdit(input.ids, { ...input.patch, status: "pending" }, "custom")', { ids, patch }));
  }
  assert.deepEqual(h.json("state.custom"), before);
  assert.equal(h.storage.writes, 1);
});

test("EXT bank removal: impact counts payment and transfer references and blocks a referenced bank", () => {
  const h = harness();
  seedTreasury(h, [payment("p", h.day(1), { bankId: "bank-a" }), transfer("t1", h.day(1), { amount: 80 }), transfer("t2", h.day(-10), { fromBankId: "bank-c", toBankId: "bank-a", amount: 20, status: "pending" })]);
  assert.deepEqual(h.json('getBankRemovalImpact("bank-a")'), { account: treasuryAccounts[0], paymentCount: 1, transferCount: 2, transferAmount: 100 });
  const before = h.json("state.custom");
  assert.throws(() => h.run('commitBankRemoval("bank-a")'));
  assert.deepEqual(h.json("state.custom"), before);
  assert.equal(h.storage.writes, 0);
});

test("EXT bank removal: retiring an unreferenced account preserves payments and other accounts", () => {
  const h = harness();
  seedTreasury(h, [payment("p", h.day(1), { bankId: "bank-b" }), movement("i", h.day(2))]);
  const rows = h.json("state.custom.movements");
  h.run('commitBankRemoval("bank-b");');
  assert.deepEqual(h.json("state.custom.accounts.map(a => a.id)"), ["bank-a", "bank-c"]);
  assert.deepEqual(h.json("state.custom.movements"), rows);
  assert.equal(h.run("getMovementBankLabel(state.custom.movements[0])"), "Banco no disponible");
  assert.deepEqual(h.saved(), h.json("state.custom"));
  assert.equal(h.storage.writes, 1);
});

test("EXT bank removal: last account, unknown ID and storage errors leave state unchanged", () => {
  const h = harness();
  seed(h, []);
  const single = h.json("state.custom");
  assert.throws(() => h.run('commitBankRemoval("bank-test")'));
  assert.deepEqual(h.json("state.custom"), single);
  seedTreasury(h, []);
  const before = h.json("state.custom");
  assert.throws(() => h.run('commitBankRemoval("not-there")'));
  h.storage.fail = true;
  assert.throws(() => h.run('commitBankRemoval("bank-b")'));
  assert.deepEqual(h.json("state.custom"), before);
  assert.equal(h.storage.writes, 0);
});

test("EXT undo: deletion persists atomically and creates one independent five-second recovery token", () => {
  const h = harness();
  seedTreasury(h, [payment("a", h.day(1)), movement("b", h.day(2))]);
  const token = h.run('deleteMovement("a")');
  assert.ok(token);
  assert.deepEqual(h.json("state.custom.movements.map(m => m.id)"), ["b"]);
  assert.deepEqual(h.saved(), h.json("state.custom"));
  assert.equal(h.run("state.undoDeletions.size"), 1);
  const entry = h.json("state.undoDeletions.get(input)", token);
  assert.equal(entry.movement.id, "a");
  assert.equal(entry.index, 0);
  assert.equal(entry.expiresAt, h.clock.now + 5000);
  assert.ok([...h.timers.values()].some((timer) => timer.delay === 5000));
  assert.equal(h.storage.writes, 1);
});

test("EXT undo: restoration merges into current data without reverting subsequent edits or additions", () => {
  const h = harness();
  const removed = payment("a", h.day(1), { bankId: "bank-a", categoryId: "costos", amount: 75.12 });
  seedTreasury(h, [removed, payment("b", h.day(2))]);
  const token = h.run('deleteMovement("a")');
  h.run('commitMovementEdit(["b"], { concept: "Corregido después", amount: 225.5 }, "custom");');
  transferDraft(h);
  h.run("addMovement(input)", { preventDefault() {} });
  h.run('persistCustomCandidate({ ...state.custom, accounts: state.custom.accounts.map(a => a.id === "bank-a" ? { ...a, name: "Renombrado después" } : a) });');
  h.run("undoDeleteMovement(input)", token);
  const rows = h.json("state.custom.movements");
  assert.deepEqual(rows.find((row) => row.id === "a"), removed);
  assert.equal(rows.find((row) => row.id === "b").amount, 225.5);
  assert.equal(rows.find((row) => row.id === "b").concept, "Corregido después");
  assert.equal(rows.filter((row) => row.type === "transfer").length, 1);
  assert.equal(h.run("state.custom.accounts[0].name"), "Renombrado después");
  assert.equal(h.run("state.undoDeletions.has(input)", token), false);
  assert.deepEqual(h.saved(), h.json("state.custom"));
});

test("EXT undo: consecutive deletions can be restored independently without duplicates", () => {
  const h = harness();
  seedTreasury(h, [payment("a", h.day(1)), payment("b", h.day(2)), movement("c", h.day(3))]);
  const a = h.run('deleteMovement("a")');
  const b = h.run('deleteMovement("b")');
  assert.notEqual(a, b);
  assert.equal(h.run("state.undoDeletions.size"), 2);
  h.run("undoDeleteMovement(input)", a);
  assert.equal(h.run("state.undoDeletions.has(input)", b), true);
  h.run("undoDeleteMovement(input)", b);
  assert.deepEqual(h.json("state.custom.movements.map(m => m.id).sort()"), ["a", "b", "c"]);
  assert.throws(() => h.run("undoDeleteMovement(input)", a));
  assert.equal(h.run("state.custom.movements.length"), 3);
});

test("EXT undo: the exact expiry boundary rejects restoration without changing saved data", () => {
  const h = harness();
  seedTreasury(h, [payment("a", h.day(1))]);
  const token = h.run('deleteMovement("a")');
  const expiresAt = h.run("state.undoDeletions.get(input).expiresAt", token);
  const before = h.json("state.custom");
  assert.throws(() => h.run("undoDeleteMovement(input.token, input.now)", { token, now: expiresAt }));
  assert.deepEqual(h.json("state.custom"), before);
  assert.deepEqual(h.saved(), before);
  assert.equal(h.storage.writes, 1);
});

test("EXT undo: timer expiry removes recovery without waiting in real time", () => {
  const h = harness();
  seedTreasury(h, [payment("a", h.day(1))]);
  const token = h.run('deleteMovement("a")');
  h.advanceTime(4999);
  assert.equal(h.run("state.undoDeletions.has(input)", token), true);
  h.advanceTime(1);
  assert.equal(h.run("state.undoDeletions.has(input)", token), false);
  assert.throws(() => h.run("undoDeleteMovement(input)", token));
  assert.equal(h.run("state.custom.movements.length"), 0);
});

test("EXT undo: failed deletion or unknown IDs neither mutate data nor offer phantom recovery", () => {
  const h = harness();
  seedTreasury(h, [payment("a", h.day(1))]);
  const before = h.json("state.custom");
  assert.throws(() => h.run('deleteMovement("missing")'));
  h.storage.fail = true;
  assert.throws(() => h.run('deleteMovement("a")'));
  assert.deepEqual(h.json("state.custom"), before);
  assert.equal(h.run("state.undoDeletions.size"), 0);
  assert.equal(h.timers.size, 0);
  assert.equal(h.storage.writes, 0);
});

test("EXT undo: storage failure preserves the recovery token for a timely retry", () => {
  const h = harness();
  seedTreasury(h, [payment("a", h.day(1))]);
  const token = h.run('deleteMovement("a")');
  const before = h.json("state.custom");
  h.storage.fail = true;
  assert.throws(() => h.run("undoDeleteMovement(input)", token));
  assert.deepEqual(h.json("state.custom"), before);
  assert.deepEqual(h.saved(), before);
  assert.equal(h.run("state.undoDeletions.has(input)", token), true);
  h.storage.fail = false;
  h.run("undoDeleteMovement(input)", token);
  assert.equal(h.run("state.custom.movements[0].id"), "a");
  assert.equal(h.run("state.undoDeletions.has(input)", token), false);
});

test("EXT undo: an existing movement ID cannot be overwritten by a recovered record", () => {
  const h = harness();
  seedTreasury(h, [payment("a", h.day(1))]);
  const token = h.run('deleteMovement("a")');
  h.run('persistCustomCandidate({ ...state.custom, movements: [input] });', payment("a", h.day(2), { concept: "Registro nuevo", amount: 500 }));
  const before = h.json("state.custom");
  assert.throws(() => h.run("undoDeleteMovement(input)", token));
  assert.deepEqual(h.json("state.custom"), before);
  assert.deepEqual(h.saved(), before);
});

test("EXT undo: a deleted transfer cannot be restored after an endpoint account is removed", () => {
  const h = harness();
  seedTreasury(h, [transfer("t", h.day(1))]);
  const token = h.run('deleteMovement("t")');
  h.run('commitBankRemoval("bank-b");');
  const before = h.json("state.custom");
  assert.throws(() => h.run("undoDeleteMovement(input)", token));
  assert.deepEqual(h.json("state.custom"), before);
  assert.deepEqual(h.saved(), before);
});

test("EXT undo: a payment can be recovered with its unavailable optional bank intact", () => {
  const h = harness();
  const row = payment("p", h.day(1), { bankId: "bank-b", categoryId: "gastos" });
  seedTreasury(h, [row]);
  const token = h.run('deleteMovement("p")');
  h.run('commitBankRemoval("bank-b");');
  h.run("undoDeleteMovement(input)", token);
  assert.deepEqual(h.json("state.custom.movements[0]"), row);
  assert.equal(h.run("getMovementBankLabel(state.custom.movements[0])"), "Banco no disponible");
});

// Model the relevant DOM behavior: replacing innerHTML disconnects its old
// buttons and releases their focus. This keeps concurrent-toast tests honest
// without pretending that the basic Element adapter is a browser renderer.
function trackUndoToastFocus(h) {
  h.run(`(() => {
    let html = "";
    let buttons = [];
    Object.defineProperty(els.undoToasts, "innerHTML", {
      get() { return html; },
      set(value) {
        if (buttons.includes(document.activeElement)) document.activeElement = document.body;
        html = value;
        buttons = [...value.matchAll(/data-undo-delete="([^"]+)"/g)].map(([, token]) => ({
          dataset: { undoDelete: token },
          focus() { document.activeElement = this; },
        }));
      },
    });
    els.undoToasts.querySelectorAll = (selector) => selector === "[data-undo-delete]" ? buttons : [];
    els.movementSearch.focus = () => { document.activeElement = els.movementSearch; };
  })();`);
}

test("EXT undo focus: expiring one toast preserves keyboard focus on another live recovery", () => {
  const h = harness();
  trackUndoToastFocus(h);
  seedTreasury(h, [payment("a", h.day(1)), payment("b", h.day(2))]);
  const a = h.run('deleteMovement("a")');
  h.advanceTime(2000);
  const b = h.run('deleteMovement("b")');
  h.run('els.undoToasts.querySelectorAll("[data-undo-delete]").find(button => button.dataset.undoDelete === input).focus();', b);
  h.advanceTime(3000);
  assert.equal(h.run("state.undoDeletions.has(input)", a), false);
  assert.equal(h.run("state.undoDeletions.has(input)", b), true);
  assert.equal(h.run("document.activeElement.dataset.undoDelete"), b);
  h.run("undoDeleteMovement(document.activeElement.dataset.undoDelete);");
  assert.deepEqual(h.json("state.custom.movements.map(m => m.id)"), ["b"]);
});

test("EXT undo focus: expiry leaves unrelated focus alone and moves an expired button to search", () => {
  const h = harness();
  trackUndoToastFocus(h);
  seedTreasury(h, [payment("a", h.day(1)), payment("b", h.day(2))]);
  h.run('deleteMovement("a"); document.activeElement = els.movementConcept;');
  h.advanceTime(5000);
  assert.equal(h.run("document.activeElement === els.movementConcept"), true);
  const b = h.run('deleteMovement("b")');
  h.run('els.undoToasts.querySelectorAll("[data-undo-delete]").find(button => button.dataset.undoDelete === input).focus();', b);
  h.advanceTime(5000);
  assert.equal(h.run("document.activeElement === els.movementSearch"), true);
});

test("EXT reset: storage rejection preserves current data, selection and live undo tokens", () => {
  const h = harness();
  seedTreasury(h, [payment("a", h.day(1)), payment("b", h.day(2))]);
  const token = h.run('deleteMovement("a")');
  h.run('state.selectedMovementIds.add("b");');
  const before = h.json("state.custom");
  const recovery = h.json("[...state.undoDeletions.entries()]");
  const timers = [...h.timers.keys()];
  const remove = h.storage.removeItem;
  h.storage.removeItem = () => { throw new Error("Synthetic removeItem failure"); };
  assert.doesNotThrow(() => h.run("resetCustomProjection();"));
  assert.deepEqual(h.json("state.custom"), before);
  assert.deepEqual(h.saved(), before);
  assert.deepEqual(h.json("[...state.selectedMovementIds]"), ["b"]);
  assert.deepEqual(h.json("[...state.undoDeletions.entries()]"), recovery);
  assert.deepEqual([...h.timers.keys()], timers);
  assert.match(h.run("els.captureFeedback.textContent"), /No se pudo restablecer/);
  h.storage.removeItem = remove;
  h.run("undoDeleteMovement(input)", token);
  assert.deepEqual(h.json("state.custom.movements.map(m => m.id).sort()"), ["a", "b"]);
});

test("EXT reset: a successful reset clears stored data and every pending recovery timer", () => {
  const h = harness();
  seedTreasury(h, [payment("a", h.day(1)), payment("b", h.day(2)), payment("c", h.day(3))]);
  h.run('deleteMovement("a"); deleteMovement("b"); state.selectedMovementIds.add("c");');
  assert.equal(h.timers.size, 2);
  h.run("resetCustomProjection();");
  assert.equal(h.storage.getItem(STORAGE_KEY), null);
  assert.equal(h.run("state.custom.accounts.length"), 1);
  assert.equal(h.run("state.custom.accounts[0].balance"), 0);
  assert.deepEqual(h.json("state.custom.movements"), []);
  assert.equal(h.run("state.selectedMovementIds.size"), 0);
  assert.equal(h.run("state.undoDeletions.size"), 0);
  assert.equal(h.timers.size, 0);
  assert.equal(h.run("els.undoToasts.innerHTML"), "");
});

test("EXT reset: declining confirmation preserves persisted data and recoveries", () => {
  const h = harness();
  seedTreasury(h, [payment("a", h.day(1)), payment("b", h.day(2))]);
  h.run('deleteMovement("a"); state.selectedMovementIds.add("b"); window.confirm = () => false;');
  const before = h.json("state.custom");
  const recovery = h.json("[...state.undoDeletions.entries()]");
  h.run("resetCustomProjection();");
  assert.deepEqual(h.json("state.custom"), before);
  assert.deepEqual(h.saved(), before);
  assert.deepEqual(h.json("[...state.selectedMovementIds]"), ["b"]);
  assert.deepEqual(h.json("[...state.undoDeletions.entries()]"), recovery);
  assert.equal(h.timers.size, 1);
});

// Import, duplication and saved simulations. Import parsing itself is tested
// by its module; these cases exercise the application commit boundary using
// normalized reports, including hostile reports that claim to be valid.
function reportRow(rowNumber, rowMovement, extra = {}) {
  return { rowNumber, movement: rowMovement, errors: [], warnings: [], duplicates: [], ...extra };
}

function scenarioState(h) {
  return h.json("({ base: getBaseProjection(), scenarios: state.savedScenarios, activeId: state.activeScenarioId, current: state.custom })");
}

function scenarioProjection(h, id) {
  return h.json('input === "base" ? getBaseProjection() : ((s) => ({ accounts: s.accounts, movements: s.movements }))(state.savedScenarios.find(s => s.id === input))', id);
}

function commitReport(h, report, selected, scenarioId = "base", allowPast = false) {
  return h.json("commitImportedMovements(input.report, input.selected, input.scenarioId, input.allowPast)", { report, selected, scenarioId, allowPast });
}

test("SIM legacy: previous projections load as Base without rewriting or losing their records", () => {
  const legacy = { accounts: treasuryAccounts, movements: [payment("p", "2028-05-01", { amount: 12.34, bankId: "bank-a", categoryId: "costos" }), transfer("t", "2028-05-02"), movement("i", "2028-05-03")] };
  const h = harness(legacy);
  assert.equal(h.run("state.activeScenarioId"), "base");
  assert.deepEqual(h.json("state.savedScenarios"), []);
  assert.deepEqual(h.json("getBaseProjection()"), legacy);
  assert.deepEqual(h.saved(), legacy);
  assert.equal(h.storage.writes, 0);
});

test("SIM create: a saved scenario activates an independent copy while preserving record and account IDs", () => {
  const h = harness();
  seedTreasury(h, [payment("p", h.day(1), { bankId: "bank-a", categoryId: "nomina", amount: 12.34 }), transfer("t", h.day(2))]);
  const base = h.json("state.custom");
  const id = h.run('createSavedScenario("  Simulación inicial  ")');
  assert.ok(id && id !== "base");
  assert.equal(h.run("state.activeScenarioId"), id);
  assert.equal(h.run("state.savedScenarios[0].name"), "Simulación inicial");
  assert.deepEqual(h.json("state.custom"), base);
  assert.deepEqual(h.json("getBaseProjection()"), base);
  assert.deepEqual(scenarioProjection(h, id), base);
  assert.equal(h.run("state.custom.accounts === getBaseProjection().accounts"), false);
  assert.equal(h.run("state.custom.accounts[0] === getBaseProjection().accounts[0]"), false);
  assert.equal(h.run("state.custom.movements[0] === getBaseProjection().movements[0]"), false);
  assert.ok(h.run("state.savedScenarios[0].createdAt"));
  assert.ok(h.run("state.savedScenarios[0].updatedAt"));
  assert.equal(h.storage.writes, 1);
});

test("SIM isolation: editing a scenario leaves Base and another scenario unchanged", () => {
  const h = harness();
  seedTreasury(h, [payment("p", h.day(1), { amount: 100 })]);
  const base = h.json("state.custom");
  const first = h.run('createSavedScenario("Primero")');
  const second = h.run('createSavedScenario("Segundo")');
  h.run("switchSavedScenario(input);", first);
  h.run('commitMovementEdit(["p"], { amount: 55.25, concept: "Solo primero" }, "custom"); state.custom.accounts[0].name = "Banco del primero"; persistCustomCandidate(state.custom);');
  assert.deepEqual(h.json("getBaseProjection()"), base);
  assert.deepEqual(scenarioProjection(h, second), base);
  assert.equal(scenarioProjection(h, first).movements[0].amount, 55.25);
  assert.equal(scenarioProjection(h, first).accounts[0].name, "Banco del primero");
  h.run("switchSavedScenario(input);", second);
  assert.deepEqual(h.json("state.custom"), base);
});

test("SIM sources: default creation copies Base and explicit creation can copy another saved scenario", () => {
  const h = harness();
  seedTreasury(h, [payment("p", h.day(1), { amount: 100 })]);
  const modified = h.run('createSavedScenario("Modificado")');
  h.run('commitMovementEdit(["p"], { amount: 400 }, "custom");');
  const fromBase = h.run('createSavedScenario("Desde Base")');
  assert.equal(scenarioProjection(h, fromBase).movements[0].amount, 100);
  const fromSaved = h.run('createSavedScenario("Desde modificado", input)', modified);
  assert.equal(scenarioProjection(h, fromSaved).movements[0].amount, 400);
  assert.equal(scenarioProjection(h, fromSaved).movements[0].id, "p");
  const before = scenarioState(h);
  assert.throws(() => h.run('createSavedScenario("Origen ausente", "missing")'));
  assert.deepEqual(scenarioState(h), before);
});

test("SIM names: empty, oversized and case-insensitive duplicate names are rejected atomically", () => {
  const h = harness();
  seedTreasury(h, []);
  for (const name of ["", "   ", "a".repeat(61)]) assert.throws(() => h.run("createSavedScenario(input)", name));
  assert.equal(h.run("state.savedScenarios.length"), 0);
  assert.equal(h.storage.writes, 0);
  const first = h.run('createSavedScenario("Simulación")');
  const second = h.run('createSavedScenario("Otro")');
  const before = scenarioState(h);
  assert.throws(() => h.run('createSavedScenario("sIMULACIÓN")'));
  assert.throws(() => h.run('renameSavedScenario(input, "SIMULACIÓN")', second));
  assert.throws(() => h.run('renameSavedScenario(input, " ")', first));
  assert.deepEqual(scenarioState(h), before);
  h.run('renameSavedScenario(input, "  Nombre nuevo  ");', first);
  assert.equal(h.run("state.savedScenarios.find(s => s.id === input).name", first), "Nombre nuevo");
});

test("SIM persistence: Base remains at the legacy root and every scenario plus active choice survives reload", () => {
  const h = harness();
  seedTreasury(h, [payment("p", h.day(1), { amount: 123.45 })]);
  const base = h.json("state.custom");
  const first = h.run('createSavedScenario("Uno")');
  h.run('commitMovementEdit(["p"], { amount: 200 }, "custom");');
  const second = h.run('createSavedScenario("Dos")');
  h.run('commitMovementEdit(["p"], { amount: 300 }, "custom");');
  const saved = h.saved();
  assert.equal(saved.scenarioVersion, 1);
  assert.equal(saved.activeScenarioId, second);
  assert.deepEqual(saved.accounts, base.accounts);
  assert.deepEqual(saved.movements, base.movements);
  assert.equal(saved.savedScenarios.length, 2);
  const reloaded = harness(saved);
  assert.equal(reloaded.run("state.activeScenarioId"), second);
  assert.equal(reloaded.run("state.custom.movements[0].amount"), 300);
  assert.equal(scenarioProjection(reloaded, first).movements[0].amount, 200);
  assert.deepEqual(reloaded.json("getBaseProjection()"), base);
  assert.equal(reloaded.storage.writes, 0);
});

test("SIM persistence: an unavailable saved active ID falls back to Base without discarding valid scenarios", () => {
  const h = harness();
  seedTreasury(h, [payment("p", h.day(1))]);
  h.run('createSavedScenario("Conservado");');
  const saved = h.saved();
  saved.activeScenarioId = "not-there";
  const reloaded = harness(saved);
  assert.equal(reloaded.run("state.activeScenarioId"), "base");
  assert.equal(reloaded.run("state.savedScenarios.length"), 1);
  assert.deepEqual(reloaded.json("state.custom.movements"), saved.movements);
});

test("SIM atomicity: rejected storage does not create, switch, rename or delete scenarios", () => {
  const h = harness();
  seedTreasury(h, [payment("p", h.day(1))]);
  const id = h.run('createSavedScenario("Original")');
  const before = scenarioState(h);
  const saved = h.saved();
  h.storage.fail = true;
  for (const code of ['createSavedScenario("Nuevo")', 'switchSavedScenario("base")', 'renameSavedScenario(input, "Renombrado")', 'deleteSavedScenario(input)']) {
    assert.throws(() => h.run(code, id));
    assert.deepEqual(scenarioState(h), before);
    assert.deepEqual(h.saved(), saved);
  }
});

test("SIM deletion: deleting the active scenario returns to Base and preserves other simulations", () => {
  const h = harness();
  seedTreasury(h, [payment("p", h.day(1))]);
  const base = h.json("state.custom");
  const first = h.run('createSavedScenario("Primero")');
  const second = h.run('createSavedScenario("Segundo")');
  const before = scenarioState(h);
  assert.throws(() => h.run('deleteSavedScenario("base")'));
  assert.throws(() => h.run('switchSavedScenario("missing")'));
  assert.deepEqual(scenarioState(h), before);
  h.run("deleteSavedScenario(input);", second);
  assert.equal(h.run("state.activeScenarioId"), "base");
  assert.deepEqual(h.json("state.custom"), base);
  assert.deepEqual(h.json("state.savedScenarios.map(s => s.id)"), [first]);
});

test("SIM limit: a full catalog rejects creation and applying without room for its mandatory Base backup", () => {
  const h = harness();
  seedTreasury(h, [payment("p", h.day(1))]);
  const ids = [];
  for (let index = 1; index <= 10; index += 1) ids.push(h.run("createSavedScenario(input)", `Escenario ${index}`));
  const before = scenarioState(h);
  const saved = h.saved();
  assert.throws(() => h.run('createSavedScenario("Once")'));
  assert.throws(() => h.run("applySavedScenarioToBase(input)", ids[0]));
  assert.deepEqual(scenarioState(h), before);
  assert.deepEqual(h.saved(), saved);
});

test("SIM apply: replacing Base creates an independent backup and preserves the source scenario", () => {
  const h = harness();
  seedTreasury(h, [payment("p", h.day(1), { amount: 100 })]);
  const originalBase = h.json("state.custom");
  const sourceId = h.run('createSavedScenario("Aplicar")');
  h.run('commitMovementEdit(["p"], { amount: 450 }, "custom");');
  const sourceProjection = h.json("state.custom");
  const writesBefore = h.storage.writes;
  const backupId = h.run("applySavedScenarioToBase(input)", sourceId);
  assert.ok(backupId && backupId !== sourceId && backupId !== "base");
  assert.equal(h.run("state.activeScenarioId"), "base");
  assert.deepEqual(h.json("getBaseProjection()"), sourceProjection);
  assert.deepEqual(scenarioProjection(h, sourceId), sourceProjection);
  assert.deepEqual(scenarioProjection(h, backupId), originalBase);
  assert.equal(h.storage.writes, writesBefore + 1, "backup and replacement must persist as one transaction");
  h.run('commitMovementEdit(["p"], { amount: 500 }, "custom");');
  assert.equal(scenarioProjection(h, sourceId).movements[0].amount, 450);
  assert.equal(scenarioProjection(h, backupId).movements[0].amount, 100);
});

test("SIM apply: storage failure leaves Base, scenario catalog and active data intact", () => {
  const h = harness();
  seedTreasury(h, [payment("p", h.day(1))]);
  const id = h.run('createSavedScenario("Cambios")');
  h.run('commitMovementEdit(["p"], { amount: 700 }, "custom");');
  const before = scenarioState(h);
  const saved = h.saved();
  h.storage.fail = true;
  assert.throws(() => h.run("applySavedScenarioToBase(input)", id));
  assert.deepEqual(scenarioState(h), before);
  assert.deepEqual(h.saved(), saved);
});

test("SIM comparison: scenarios share date/horizon and metrics stay independent of table filters", () => {
  const h = harness();
  seed(h, [payment("p", h.day(2), { amount: 1200 }), movement("i", h.day(3), { amount: 500 }), transfer("t", h.day(1), { amount: 600 })], [
    { id: "bank-a", name: "Banco Alfa", balance: 600 }, { id: "bank-b", name: "Banco Beta", balance: 400 },
  ]);
  const id = h.run('createSavedScenario("Pago aplazado")');
  h.run('commitMovementEdit(["p"], { date: input }, "custom");', h.day(15));
  const before = scenarioState(h);
  const writes = h.storage.writes;
  h.run('state.horizon = 14; state.movementFilters.query = "sin coincidencias";');
  const base14 = h.json("getScenarioMetrics(getBaseProjection())");
  const scenario14 = h.json("getScenarioMetrics(state.custom)");
  assert.equal(base14.initialBalance, 1000);
  assert.equal(base14.minimumBalance, -200);
  assert.equal(base14.finalBalance, 300);
  assert.equal(scenario14.initialBalance, 1000);
  assert.equal(scenario14.minimumBalance, 1000);
  assert.equal(scenario14.finalBalance, 1500);
  assert.equal(scenario14.firstShortfallDate, null);
  assert.equal(h.run('((value) => value instanceof Date ? toISODate(value) : value)(getScenarioMetrics(getBaseProjection()).firstShortfallDate)'), h.day(2));
  h.run("state.horizon = 30;");
  assert.equal(h.run("getScenarioMetrics(getBaseProjection()).finalBalance"), 300);
  assert.equal(h.run("getScenarioMetrics(state.custom).finalBalance"), 300);
  assert.deepEqual(scenarioState(h), before);
  assert.equal(h.storage.writes, writes);
  assert.equal(h.run("state.activeScenarioId"), id);
});

test("SIM comparison: the global pending rule applies equally and internal transfers remain neutral", () => {
  const h = harness();
  seedTreasury(h, [movement("pending", h.day(1), { status: "pending", amount: 250 }), transfer("internal", h.day(2), { status: "pending", amount: 900 })]);
  h.run('createSavedScenario("Igual")');
  h.run("state.includePending = false;");
  assert.equal(h.run("getScenarioMetrics(getBaseProjection()).finalBalance"), 1750);
  assert.equal(h.run("getScenarioMetrics(state.custom).finalBalance"), 1750);
  h.run("state.includePending = true;");
  assert.equal(h.run("getScenarioMetrics(getBaseProjection()).finalBalance"), 2000);
  assert.deepEqual(h.json("getScenarioMetrics(state.custom)"), h.json("getScenarioMetrics(getBaseProjection())"));
});

test("DUP identity: repeated duplications preserve source fields and create distinct movement IDs", () => {
  const h = harness();
  const original = payment("p", h.day(1), { bankId: "bank-a", categoryId: "nomina", amount: 45.67, status: "pending" });
  seedTreasury(h, [original]);
  const first = h.json('commitDuplicateMovement("p", {})');
  const second = h.json('commitDuplicateMovement("p", {})');
  assert.notEqual(first.id, original.id);
  assert.notEqual(first.id, second.id);
  assert.deepEqual({ ...first, id: original.id }, original);
  assert.deepEqual({ ...second, id: original.id }, original);
  assert.deepEqual(h.json("state.custom.movements[0]"), original);
  assert.equal(h.run("state.custom.movements.length"), 3);
  assert.ok(Math.abs(h.run("getPeriodTotals(getFilteredMovements()).outflows") - 137.01) < 1e-8);
  assert.equal(h.storage.writes, 2);
});

test("DUP validation: a historical source needs an explicitly valid new date and stays unchanged", () => {
  const h = harness();
  const old = payment("old", h.day(-2), { amount: 15 });
  seedTreasury(h, [old]);
  assert.throws(() => h.run('commitDuplicateMovement("old", {})'));
  assert.equal(h.storage.writes, 0);
  const copy = h.json('commitDuplicateMovement("old", { date: input, concept: "Copia revisada", amount: 20.25 })', h.day());
  assert.equal(copy.date, h.day());
  assert.equal(copy.concept, "Copia revisada");
  assert.equal(copy.amount, 20.25);
  assert.deepEqual(h.json("state.custom.movements[0]"), old);
});

test("DUP validation: forbidden IDs, invalid amounts and invalid transfer endpoints cannot create records", () => {
  const h = harness();
  seedTreasury(h, [payment("p", h.day(1)), transfer("t", h.day(2))]);
  const before = h.json("state.custom");
  for (const [id, patch] of [["missing", {}], ["p", { id: "forced" }], ["p", { amount: 0 }], ["p", { amount: 1.001 }], ["p", { amount: 1e13 }], ["p", { categoryId: "unknown" }], ["t", { toBankId: "bank-a" }], ["t", { fromBankId: "missing" }]]) {
    assert.throws(() => h.run("commitDuplicateMovement(input.id, input.patch)", { id, patch }));
  }
  assert.deepEqual(h.json("state.custom"), before);
  assert.equal(h.storage.writes, 0);
});

test("DUP isolation: duplication targets only the active personal scenario and rejects a stale origin", () => {
  const h = harness();
  seedTreasury(h, [payment("p", h.day(1))]);
  const base = h.json("state.custom");
  const scenarioId = h.run('createSavedScenario("Duplicar aquí")');
  assert.throws(() => h.run('commitDuplicateMovement("p", {}, "base")'));
  h.run('commitDuplicateMovement("p", {}, input);', scenarioId);
  assert.equal(h.run("state.custom.movements.length"), 2);
  assert.deepEqual(h.json("getBaseProjection()"), base);
  h.run('state.mode = "demo";');
  assert.throws(() => h.run('commitDuplicateMovement("d2", {})'));
  assert.equal(h.run("state.custom.movements.length"), 2);
});

test("DUP atomicity: storage rejection preserves the source and the entire scenario state", () => {
  const h = harness();
  seedTreasury(h, [payment("p", h.day(1))]);
  h.run('createSavedScenario("Sin pérdida")');
  const before = scenarioState(h);
  const saved = h.saved();
  h.storage.fail = true;
  assert.throws(() => h.run('commitDuplicateMovement("p", { amount: 500 })'));
  assert.deepEqual(scenarioState(h), before);
  assert.deepEqual(h.saved(), saved);
});

test("IMP commit: selected rows append with new IDs, including intentionally selected identical rows", () => {
  const h = harness();
  const existing = payment("existing", h.day(1), { amount: 50, bankId: "bank-a" });
  seedTreasury(h, [existing]);
  const report = { rows: [reportRow(2, { ...existing }, { duplicates: ["existing"] }), reportRow(3, { ...existing }, { duplicates: ["existing"] }), reportRow(4, movement("unused", h.day(2)))] };
  const originalReport = JSON.parse(JSON.stringify(report));
  const imported = commitReport(h, report, [2, 3]);
  assert.equal(imported.length, 2);
  assert.equal(new Set([existing.id, ...imported.map(row => row.id)]).size, 3);
  assert.equal(h.run("state.custom.movements.length"), 3);
  assert.equal(h.run("getPeriodTotals(getFilteredMovements()).outflows"), 150);
  assert.deepEqual(h.json("state.custom.movements[0]"), existing);
  assert.deepEqual(report, originalReport, "committing must not alter the review report");
  assert.equal(h.storage.writes, 1);
});

test("IMP selection: invalid selected rows reject the whole batch while unselected errors do not block chosen valid rows", () => {
  const h = harness();
  seedTreasury(h, []);
  const report = { rows: [reportRow(2, payment("a", h.day(1))), reportRow(3, payment("b", h.day(2)), { errors: ["Error de validación de origen"] })] };
  assert.throws(() => commitReport(h, report, [2, 3]));
  assert.deepEqual(h.json("state.custom.movements"), []);
  assert.equal(h.storage.writes, 0);
  const imported = commitReport(h, report, [2]);
  assert.equal(imported.length, 1);
  assert.equal(h.run("state.custom.movements.length"), 1);
});

test("IMP selection: empty, repeated, missing or ambiguous row numbers cannot commit", () => {
  const h = harness();
  seedTreasury(h, []);
  const report = { rows: [reportRow(2, payment("a", h.day(1)))] };
  for (const selected of [[], [2, 2], [2, 99]]) assert.throws(() => commitReport(h, report, selected));
  const ambiguous = { rows: [reportRow(2, payment("a", h.day(1))), reportRow(2, payment("b", h.day(2)))] };
  assert.throws(() => commitReport(h, ambiguous, [2]));
  assert.deepEqual(h.json("state.custom.movements"), []);
  assert.equal(h.storage.writes, 0);
});

test("IMP revalidation: apparently clean reports cannot bypass movement, amount or account rules", () => {
  const h = harness();
  seedTreasury(h, [payment("existing", h.day(1))]);
  const before = h.json("state.custom");
  const invalid = [
    payment("bad", h.day(1), { amount: 0 }), payment("bad", h.day(1), { amount: -5 }), payment("bad", h.day(1), { amount: 1.001 }),
    payment("bad", h.day(1), { amount: 1e13 }), payment("bad", h.day(1), { amount: Infinity }),
    payment("bad", h.day(1), { concept: " " }), payment("bad", h.day(1), { concept: "a".repeat(71) }),
    payment("bad", "2028-02-30"), payment("bad", h.day(1), { bankId: "unknown" }), payment("bad", h.day(1), { categoryId: "unknown" }),
    payment("bad", h.day(1), { status: "paid" }), movement("bad", h.day(1), { type: "unknown" }),
    transfer("bad", h.day(1), { toBankId: "bank-a" }), transfer("bad", h.day(1), { fromBankId: "missing" }),
  ];
  for (const row of invalid) {
    const report = { rows: [reportRow(2, payment("valid", h.day(1))), reportRow(3, row)] };
    assert.throws(() => commitReport(h, report, [2, 3]), JSON.stringify(row));
    assert.deepEqual(h.json("state.custom"), before);
  }
  assert.equal(h.storage.writes, 0);
});

test("IMP historical: past dates require explicit permission and remain outside the current forecast", () => {
  const h = harness();
  seedTreasury(h, []);
  const report = { rows: [reportRow(2, payment("old", h.day(-1), { amount: 250 }))] };
  assert.throws(() => commitReport(h, report, [2]));
  assert.equal(h.storage.writes, 0);
  const imported = commitReport(h, report, [2], "base", true);
  assert.equal(imported[0].date, h.day(-1));
  assert.equal(h.run("state.custom.movements.length"), 1);
  assert.deepEqual(h.json("getFilteredMovements()"), []);
});

test("IMP transfer: a valid imported transfer retains endpoints and has zero consolidated cash effect", () => {
  const h = harness();
  seedTreasury(h, []);
  const report = { rows: [reportRow(2, transfer("external-id", h.day(1), { amount: 80.25 }))] };
  const imported = commitReport(h, report, [2]);
  assert.notEqual(imported[0].id, "external-id");
  assert.equal(imported[0].type, "transfer");
  assert.equal(imported[0].fromBankId, "bank-a");
  assert.equal(imported[0].toBankId, "bank-b");
  assert.equal(h.run("getForecastSeries(getFilteredMovements(), getAvailableBalance()).at(-1).balance"), 1750);
  assert.deepEqual(h.json("getPeriodTotals(getFilteredMovements())"), { inflows: 0, outflows: 0, inflowCount: 0, outflowCount: 0 });
});

test("IMP atomicity: failed storage keeps every scenario and the report intact", () => {
  const h = harness();
  seedTreasury(h, [payment("existing", h.day(1))]);
  const id = h.run('createSavedScenario("Importar")');
  const report = { rows: [reportRow(2, payment("new", h.day(2)))] };
  const originalReport = JSON.parse(JSON.stringify(report));
  const before = scenarioState(h);
  const saved = h.saved();
  h.storage.fail = true;
  assert.throws(() => commitReport(h, report, [2], id));
  assert.deepEqual(scenarioState(h), before);
  assert.deepEqual(h.saved(), saved);
  assert.deepEqual(report, originalReport);
});

test("IMP isolation: a stale expected scenario is rejected and a valid import changes only its target", () => {
  const h = harness();
  seedTreasury(h, [payment("existing", h.day(1))]);
  const base = h.json("state.custom");
  const id = h.run('createSavedScenario("Destino")');
  const report = { rows: [reportRow(2, payment("new", h.day(2)))] };
  assert.throws(() => commitReport(h, report, [2], "base"));
  assert.equal(h.run("state.custom.movements.length"), 1);
  commitReport(h, report, [2], id);
  assert.equal(h.run("state.custom.movements.length"), 2);
  assert.deepEqual(h.json("getBaseProjection()"), base);
  assert.equal(scenarioProjection(h, id).movements.length, 2);
});

test("SIM undo: a recovery belongs to its originating scenario even when IDs are shared across copies", () => {
  const h = harness();
  seedTreasury(h, [payment("p", h.day(1))]);
  const id = h.run('createSavedScenario("Origen")');
  const token = h.run('deleteMovement("p")');
  assert.equal(h.run("state.undoDeletions.get(input).scenarioId", token), id);
  h.run('switchSavedScenario("base");');
  assert.throws(() => h.run("undoDeleteMovement(input)", token));
  assert.equal(h.run("state.custom.movements.length"), 1);
  assert.equal(h.run("state.undoDeletions.has(input)", token), true);
  assert.equal(h.run("els.undoToasts.innerHTML.includes(input)", token), false);
  h.run("switchSavedScenario(input);", id);
  h.run("undoDeleteMovement(input);", token);
  assert.equal(h.run("state.custom.movements[0].id"), "p");
  assert.equal(h.run("getBaseProjection().movements.length"), 1);
});

test("SIM undo: switching away and back does not renew the original five-second deadline", () => {
  const h = harness();
  seedTreasury(h, [payment("p", h.day(1))]);
  const id = h.run('createSavedScenario("Caduca")');
  const token = h.run('deleteMovement("p")');
  const expiresAt = h.run("state.undoDeletions.get(input).expiresAt", token);
  h.advanceTime(2000);
  h.run('switchSavedScenario("base");');
  h.advanceTime(2000);
  h.run("switchSavedScenario(input);", id);
  assert.equal(h.run("state.undoDeletions.get(input).expiresAt", token), expiresAt);
  h.advanceTime(1000);
  assert.throws(() => h.run("undoDeleteMovement(input)", token));
  assert.equal(h.run("state.custom.movements.length"), 0);
});

test("SIM undo: applying a scenario invalidates recoveries belonging to the replaced Base", () => {
  const h = harness();
  seedTreasury(h, [payment("p", h.day(1)), payment("other", h.day(2))]);
  const id = h.run('createSavedScenario("Nueva Base")');
  h.run('commitMovementEdit(["p"], { amount: 600 }, "custom"); switchSavedScenario("base");');
  const token = h.run('deleteMovement("p")');
  const previousBase = h.json("state.custom");
  const backupId = h.run("applySavedScenarioToBase(input)", id);
  assert.deepEqual(scenarioProjection(h, backupId), previousBase);
  assert.equal(h.run("state.undoDeletions.has(input)", token), false);
  assert.throws(() => h.run("undoDeleteMovement(input)", token));
  assert.equal(h.run('state.custom.movements.find(m => m.id === "p").amount'), 600);
});

test("SIM reset: clearing the active scenario preserves Base, other saved data and their recoveries", () => {
  const h = harness();
  seedTreasury(h, [payment("p", h.day(1))]);
  const id = h.run('createSavedScenario("Solo limpiar aquí")');
  h.run('switchSavedScenario("base");');
  const baseToken = h.run('deleteMovement("p")');
  const base = h.json("state.custom");
  h.run("switchSavedScenario(input);", id);
  const scenarioToken = h.run('deleteMovement("p")');
  h.run("resetCustomProjection();");
  assert.equal(h.run("state.activeScenarioId"), id);
  assert.deepEqual(h.json("getBaseProjection()"), base);
  assert.equal(h.run("state.custom.accounts.length"), 1);
  assert.equal(h.run("state.custom.accounts[0].balance"), 0);
  assert.deepEqual(h.json("state.custom.movements"), []);
  assert.equal(h.run("state.undoDeletions.has(input)", baseToken), true);
  assert.equal(h.run("state.undoDeletions.has(input)", scenarioToken), false);
  h.run('switchSavedScenario("base");');
  h.run("undoDeleteMovement(input);", baseToken);
  assert.equal(h.run("state.custom.movements.length"), 1);
});

async function pasteImportReview(h, text) {
  h.run('openImportDialog(); els.importSource.value = "paste"; els.importPaste.value = input;', text);
  await h.run("nextImportStep();");
  assert.equal(h.run("state.importDraft?.step"), "mapping", h.run("els.importError.textContent"));
  await h.run("nextImportStep();");
  assert.equal(h.run("state.importDraft?.step"), "review", h.run("els.importError.textContent"));
}

test("IMP controller: review initially selects valid rows without duplicates using the real text parser", async () => {
  const h = harness();
  seedTreasury(h, [payment("existing", h.day(1), { concept: "Pago existente", amount: 100, bankId: "bank-a", categoryId: "costos" })]);
  const before = h.json("state.custom");
  await pasteImportReview(h, [
    "Fecha\tConcepto\tImporte\tTipo\tEstatus\tBanco\tCategoría",
    `${h.day(2)}\tPago nuevo\t50.25\tPago\tConfirmado\t\t`,
    `${h.day(1)}\tPago existente\t100\tPago\tConfirmado\tBanco Alfa\tCostos`,
    `${h.day(3)}\tImporte inválido\ttexto\tPago\tConfirmado\t\t`,
  ].join("\n"));
  assert.deepEqual(h.json("[...state.importDraft.selectedRows]"), [2]);
  assert.equal(h.run("state.importDraft.report.rows[0].errors.length"), 0);
  assert.ok(h.run("state.importDraft.report.rows[1].duplicates.length") > 0);
  assert.ok(h.run("state.importDraft.report.rows[2].errors.length") > 0);
  assert.deepEqual(h.json("state.custom"), before);
  assert.equal(h.storage.writes, 0, "reading and reviewing must never persist");
});

test("IMP controller: changed data fingerprint rejects confirmation without discarding the review", async () => {
  const h = harness();
  seedTreasury(h, [payment("existing", h.day(1))]);
  await pasteImportReview(h, `Fecha\tConcepto\tImporte\n${h.day(2)}\tNuevo\t20.25`);
  const draft = h.run("state.importDraft");
  h.run('commitMovementEdit(["existing"], { amount: 333 }, "custom");');
  const before = h.json("state.custom");
  const saved = h.saved();
  const writes = h.storage.writes;
  h.run("confirmImportMovements();");
  assert.equal(h.run("state.importDraft"), draft);
  assert.deepEqual(h.json("[...state.importDraft.selectedRows]"), [2]);
  assert.deepEqual(h.json("state.custom"), before);
  assert.deepEqual(h.saved(), saved);
  assert.equal(h.storage.writes, writes);
  assert.notEqual(h.run("els.importError.textContent"), "");
});

test("IMP controller: storage failure retains the draft and selected rows for a successful retry", async () => {
  const h = harness();
  seedTreasury(h, []);
  await pasteImportReview(h, `Fecha\tConcepto\tImporte\n${h.day(2)}\tNuevo\t20.25`);
  const draft = h.run("state.importDraft");
  const before = h.json("state.custom");
  const report = h.json("state.importDraft.report");
  h.storage.fail = true;
  h.run("confirmImportMovements();");
  assert.equal(h.run("state.importDraft"), draft);
  assert.equal(h.run("state.importDraft.busy"), false);
  assert.equal(h.run("state.importDraft.step"), "review");
  assert.deepEqual(h.json("[...state.importDraft.selectedRows]"), [2]);
  assert.deepEqual(h.json("state.importDraft.report"), report);
  assert.deepEqual(h.json("state.custom"), before);
  assert.equal(h.storage.writes, 0);
  assert.notEqual(h.run("els.importError.textContent"), "");
  h.storage.fail = false;
  h.run("confirmImportMovements();");
  assert.equal(h.run("state.importDraft"), null);
  assert.equal(h.run("state.custom.movements.length"), 1);
  assert.equal(h.run("state.custom.movements[0].amount"), 20.25);
  assert.equal(h.storage.writes, 1);
});

test("IMP controller: a cancelled asynchronous read cannot alter a newly opened draft or import records", async () => {
  let finishRead;
  let readSignal;
  let markReadStarted;
  const readStarted = new Promise((resolve) => { markReadStarted = resolve; });
  // Control only completion timing of external file reading. All application
  // handlers and rendering functions execute normally, with no render stubs.
  const importer = { ...importModule, readXlsx(_bytes, { signal }) {
    readSignal = signal;
    return new Promise((resolve) => { finishRead = resolve; markReadStarted(); });
  } };
  const h = harness(undefined, { importer });
  seedTreasury(h, []);
  h.run("openImportDialog();");
  h.elements.get("#importFile").files = [{ name: "synthetic.xlsx", size: 8, arrayBuffer: async () => new Uint8Array(8).buffer }];
  const pending = h.run("nextImportStep();");
  await Promise.race([readStarted, pending]);
  assert.equal(typeof finishRead, "function", h.run("els.importError.textContent"));
  h.run('cancelImportDraft(); openImportDialog(); els.importError.textContent = "Borrador nuevo";');
  const freshDraft = h.run("state.importDraft");
  const uiBefore = h.json("[els.importSheet.innerHTML, els.importMapping.innerHTML, els.importFileInfo.textContent, els.importError.textContent]");
  assert.equal(readSignal.aborted, true);
  const lateResult = importModule.parseText(`Fecha\tConcepto\tImporte\n${h.day(1)}\tResultado antiguo\t100`, { delimiter: "auto" });
  finishRead(lateResult);
  await pending;
  assert.equal(h.run("state.importDraft"), freshDraft);
  assert.equal(h.run("state.importDraft.step"), "source");
  assert.equal(h.run("state.importDraft.busy"), false);
  assert.deepEqual(h.json("[els.importSheet.innerHTML, els.importMapping.innerHTML, els.importFileInfo.textContent, els.importError.textContent]"), uiBefore);
  assert.deepEqual(h.json("state.custom.movements"), []);
  assert.equal(h.storage.writes, 0);
});

test("IMP integration: large exact cents accepted in preview can commit while third decimals remain invalid", () => {
  const h = harness();
  seedTreasury(h, []);
  const validAmounts = [268435456.03, 536870912.05, 10000000000.03];
  const invalidAmounts = [1.001, 12.345, 268435456.031, 536870912.051, 10000000000.031];
  const text = ["Fecha\tConcepto\tImporte", ...[...validAmounts, ...invalidAmounts]
    .map((amount, index) => `${h.day(1)}\tImporte ${index}\t${amount}`)].join("\n");
  const sheet = importModule.parseText(text, { delimiter: "auto" }).sheets[0];
  const report = importModule.preview(sheet, {}, {
    accounts: h.json("state.custom.accounts"), categories: h.json("CATEGORY_OPTIONS"),
    existingMovements: [], todayISO: h.day(), minDate: h.day(),
  });
  assert.equal(report.summary.valid, validAmounts.length);
  assert.equal(report.summary.invalid, invalidAmounts.length);
  assert.ok(report.rows.slice(validAmounts.length).every((row) =>
    row.errors.some((error) => error.code === "INVALID_AMOUNT")));

  const added = commitReport(h, report, report.rows.slice(0, validAmounts.length).map((row) => row.rowNumber));
  assert.deepEqual(added.map((record) => record.amount), validAmounts);
  assert.deepEqual(h.saved().movements.map((record) => record.amount), validAmounts);
  const before = h.json("state.custom");
  const writes = h.storage.writes;
  for (const amount of invalidAmounts) {
    assert.throws(() => commitReport(h, {
      rows: [reportRow(2, payment("untrusted", h.day(1), { amount }))],
    }, [2]), /importe|decimales/i);
  }
  assert.deepEqual(h.json("state.custom"), before);
  assert.equal(h.storage.writes, writes);
});

// Accounting presentation is shared with the real formatting module. These
// contracts exercise app boundaries where text must remain numeric money;
// exhaustive parsing/formatting cases belong to accounting.test.cjs.
test("ACC capture: grouped and currency-prefixed amounts persist as numbers without losing cents", () => {
  for (const value of ["1,234.50", "$1,234.50", "MXN $ 1,234.50"]) {
    const h = harness();
    seed(h, []);
    h.run('els.movementDate.value = input.date; els.movementConcept.value = "Pago contable"; els.movementAmount.value = input.value; els.movementType.value = "outflow"; els.movementStatus.value = "confirmed";', { date: h.day(1), value });
    h.run("addMovement(input)", { preventDefault() {} });
    assert.equal(h.run("state.custom.movements.length"), 1, value);
    assert.equal(h.saved().movements[0].amount, 1234.5, value);
    assert.equal(typeof h.saved().movements[0].amount, "number");
    assert.equal(h.saved().movements[0].type, "outflow");
    assert.equal(h.storage.writes, 1);
  }
});

test("ACC capture: malformed, negative and overprecise text preserves the draft without saving zero", () => {
  const h = harness();
  seed(h, [movement("existing", h.day(1))]);
  const before = h.json("state.custom");
  for (const value of ["1,23", "1.234,56", "1.001", "($1,234.50)", "", "texto"]) {
    h.run('els.movementDate.value = input.date; els.movementConcept.value = "Borrador contable"; els.movementAmount.value = input.value; els.movementType.value = "outflow";', { date: h.day(1), value });
    h.run("addMovement(input)", { preventDefault() {} });
    assert.deepEqual(h.json("state.custom"), before, value);
    assert.equal(h.run("els.movementAmount.value"), value);
    assert.equal(h.run("els.movementConcept.value"), "Borrador contable");
    assert.notEqual(h.run("els.captureFeedback.textContent"), "");
  }
  assert.equal(h.storage.writes, 0);
  assert.equal(h.run("els.movementForm.resetCount || 0"), 0);
});

test("ACC editor: formatted original is a no-op and a grouped replacement keeps cents and identity", () => {
  const h = harness();
  const original = payment("p", h.day(1), { amount: 1234567.89, bankId: "bank-a", categoryId: "costos" });
  seedTreasury(h, [original]);
  h.run('openMovementEditor(["p"]);');
  assert.equal(h.run("els.editMovementAmount.value"), "1,234,567.89");
  assert.deepEqual(h.json("getMovementEditPatch()"), {});
  assert.equal(h.storage.writes, 0);
  h.run('els.editMovementAmount.value = "$2,345.67"; submitMovementEdit(input);', { preventDefault() {} });
  assert.deepEqual(h.saved().movements, [{ ...original, amount: 2345.67 }]);
  assert.equal(h.storage.writes, 1);
});

test("ACC duplicate: editing the formatted copy creates a numeric amount and preserves the source", () => {
  const h = harness();
  const original = payment("p", h.day(1), { amount: 1234.5, bankId: "bank-b", categoryId: "gastos" });
  seedTreasury(h, [original]);
  h.run('openMovementEditor(["p"], undefined, "duplicate");');
  assert.equal(h.run("els.editMovementAmount.value"), "1,234.50");
  h.run('els.editMovementAmount.value = "9,876.54"; els.editMovementConcept.value = "Copia contable"; submitMovementEdit(input);', { preventDefault() {} });
  const rows = h.saved().movements;
  assert.deepEqual(rows[0], original);
  assert.equal(rows.length, 2);
  assert.notEqual(rows[1].id, original.id);
  assert.deepEqual({ ...rows[1], id: original.id }, { ...original, concept: "Copia contable", amount: 9876.54 });
  assert.equal(h.storage.writes, 1);
});

test("ACC legacy: changing status alone never rounds an untouched legacy amount", () => {
  const legacy = { accounts: [{ id: "bank-legacy", name: "Banco anterior", balance: 100.123 }],
    movements: [payment("legacy", "2028-05-01", { amount: 12.345 })] };
  const h = harness(legacy);
  h.run('state.mode = "custom"; openMovementEditor(["legacy"]); els.editMovementStatus.value = "pending";');
  assert.deepEqual(h.json("getMovementEditPatch()"), { status: "pending" });
  h.run("submitMovementEdit(input)", { preventDefault() {} });
  assert.equal(h.saved().movements[0].amount, 12.345);
  assert.equal(h.saved().movements[0].status, "pending");
  assert.equal(h.saved().accounts[0].balance, 100.123);
  assert.equal(h.storage.writes, 1);
});

test("ACC bank: accounting text and an explicit accounting zero update only the chosen balance", () => {
  const h = harness();
  seedTreasury(h, [payment("p", h.day(1))]);
  const before = h.json("state.custom");
  assert.equal(h.run('commitBankBalance("bank-b", "$1,234.50")'), 1234.5);
  assert.deepEqual(h.saved(), { ...before,
    accounts: before.accounts.map(account => account.id === "bank-b" ? { ...account, balance: 1234.5 } : account) });
  assert.equal(h.storage.writes, 1);
  assert.equal(h.run('commitBankBalance("bank-b", "$—")'), 0);
  assert.equal(h.saved().accounts[1].balance, 0);
  assert.deepEqual(h.saved().movements, before.movements);
  assert.equal(h.storage.writes, 2);
});

test("ACC bank: invalid or missing-bank edits cannot replace a balance with zero or a rounded value", () => {
  const h = harness();
  seedTreasury(h, [payment("p", h.day(1))]);
  h.run("persistCustomCandidate(state.custom);");
  const before = h.json("state.custom");
  const writes = h.storage.writes;
  for (const value of ["", "-", "1,23", "1.001", "1.234,56", "texto", "($1.00)", "10,000,000,000,000.00"]) {
    assert.throws(() => h.run('commitBankBalance("bank-b", input)', value), undefined, value);
    assert.deepEqual(h.json("state.custom"), before, value);
    assert.deepEqual(h.saved(), before, value);
  }
  assert.throws(() => h.run('commitBankBalance("missing", "12.34")'));
  assert.equal(h.storage.writes, writes);
});

test("ACC bank: storage failure is atomic and a valid grouped balance can be retried", () => {
  const h = harness();
  seedTreasury(h, [payment("p", h.day(1))]);
  h.run("persistCustomCandidate(state.custom);");
  const before = h.json("state.custom");
  const writes = h.storage.writes;
  h.storage.fail = true;
  assert.throws(() => h.run('commitBankBalance("bank-a", "2,000.25")'), /guardar|almacenamiento/i);
  assert.deepEqual(h.json("state.custom"), before);
  assert.deepEqual(h.saved(), before);
  assert.equal(h.storage.writes, writes);
  h.storage.fail = false;
  assert.equal(h.run('commitBankBalance("bank-a", "2,000.25")'), 2000.25);
  assert.equal(h.saved().accounts[0].balance, 2000.25);
  assert.equal(h.storage.writes, writes + 1);
});

test("ACC bank: formatted edits stay in their scenario and reject a stale origin or demo", () => {
  const h = harness();
  seedTreasury(h, [payment("p", h.day(1))]);
  const base = h.json("state.custom");
  const id = h.run('createSavedScenario("Saldos contables")');
  const writes = h.storage.writes;
  assert.throws(() => h.run('commitBankBalance("bank-a", "1,234.50", "base")'));
  assert.equal(h.storage.writes, writes);
  h.run('commitBankBalance("bank-a", "1,234.50", input)', id);
  assert.equal(h.run("state.custom.accounts[0].balance"), 1234.5);
  assert.deepEqual(h.json("getBaseProjection()"), base);
  h.run('state.mode = "demo";');
  assert.throws(() => h.run('commitBankBalance("bank-a", "2,345.67", input)', id));
  assert.equal(h.run("state.custom.accounts[0].balance"), 1234.5);
  assert.equal(h.storage.writes, writes + 1);
});

test("ACC render: KPIs preserve cents and outflows or negative balances use accounting parentheses without duplicate signs", () => {
  const h = harness();
  seed(h, [movement("in", h.day(1), { amount: 10.11 }), payment("out", h.day(2), { amount: 50.25 })],
    [{ id: "bank-test", name: "Banco cero", balance: 0 }]);
  h.run("renderCaptureList(); renderDashboard();");
  assert.equal(h.run("els.availableBalance.textContent"), "$—");
  assert.equal(h.run("els.periodInflows.textContent"), "$10.11");
  assert.equal(h.run("els.periodOutflows.textContent"), "$50.25");
  assert.equal(h.run("els.projectedBalance.textContent"), "($40.14)");
  assert.equal(h.run("els.minimumBalance.textContent"), "($40.14)");
  for (const expression of ["els.captureList.innerHTML", "els.movementsTableBody.innerHTML"]) {
    const rendered = h.run(expression);
    assert.match(rendered, /\(\$50\.25\)/);
    assert.doesNotMatch(rendered, /[+−-]\s*\$/);
  }
  assert.equal(h.run("state.custom.movements[1].amount"), 50.25);
  assert.equal(h.storage.writes, 0);
});

test("ACC input events: focus preserves the draft; blur formats cents without changing Enter capture behavior", () => {
  const h = harness();
  seed(h, []);
  h.run("bindEvents();");
  const amount = h.elements.get("#movementAmount");
  amount.tagName = "INPUT";
  amount.dataset.moneyInput = "amount";
  amount.dataset.moneyError = "movementAmountError";
  amount.value = "1,234.50";
  amount.emit("focus");
  assert.equal(amount.value, "1,234.50", "focus must not rewrite text while a user selects or pastes");
  amount.value = "$2,345.67";
  amount.emit("input");
  assert.equal(amount.value, "$2,345.67", "typing must not rewrite the field or jump the cursor");
  amount.emit("blur");
  assert.equal(amount.value, "2,345.67");
  assert.equal(accountingModule.parseInput(amount.value), 2345.67);
  amount.emit("focus");
  assert.equal(amount.value, "2,345.67");
  let prevented = false;
  h.elements.get("#movementForm").emit("keydown", {
    target: amount, key: "Enter", isComposing: false, preventDefault() { prevented = true; },
  });
  assert.equal(prevented, true);
  assert.equal(amount.value, "2,345.67");
  amount.value = "1.001";
  amount.emit("input");
  amount.emit("blur");
  assert.equal(amount.value, "1.001", "invalid precision must remain available to correct");
  assert.notEqual(amount.validationMessage, "");
  assert.equal(amount.getAttribute("aria-invalid"), "true");
  assert.deepEqual(h.json("state.custom.movements"), []);
  assert.equal(h.storage.writes, 0);
  assert.equal(h.run("els.movementForm.resetCount || 0"), 0);
});

test("ACC bank events: typing does not save; failed blur retains the draft and a second blur retries atomically", () => {
  const h = harness();
  seedTreasury(h, []);
  h.run("bindEvents();");
  const editor = h.elements.get("#banksEditor");
  const row = new Element("DIV");
  row.dataset.bankId = "bank-a";
  const balance = new Element("INPUT");
  balance.parentElement = row;
  Object.assign(balance.dataset, { field: "balance", moneyInput: "balance", scenarioId: "base", moneyError: "bank-balance-error-test" });
  balance.value = "1,000.00";
  editor.emit("focusin", { target: balance });
  assert.equal(balance.value, "1,000.00", "focusing a bank balance must preserve its text");
  balance.value = "2,000.25";
  editor.emit("input", { target: balance });
  assert.equal(h.run("state.custom.accounts[0].balance"), 1000);
  assert.equal(h.storage.writes, 0);
  const before = h.json("state.custom");
  h.storage.fail = true;
  editor.emit("focusout", { target: balance });
  assert.deepEqual(h.json("state.custom"), before);
  assert.equal(h.storage.writes, 0);
  assert.equal(accountingModule.parseInput(balance.value), 2000.25);
  assert.notEqual(balance.validationMessage, "");
  assert.equal(balance.getAttribute("aria-invalid"), "true");
  h.storage.fail = false;
  editor.emit("focusout", { target: balance });
  assert.equal(h.saved().accounts[0].balance, 2000.25);
  assert.equal(balance.value, "2,000.25");
  assert.equal(balance.validationMessage, "");
  assert.equal(balance.getAttribute("aria-invalid"), null);
  assert.equal(h.elements.get("#bank-balance-error-test").hidden, true);
  assert.equal(h.storage.writes, 1);
  const saved = h.saved();
  balance.value = "";
  editor.emit("input", { target: balance });
  editor.emit("focusout", { target: balance });
  assert.equal(balance.value, "", "an empty draft must remain available to correct");
  assert.equal(balance.getAttribute("aria-invalid"), "true");
  assert.deepEqual(h.saved(), saved);
  assert.equal(h.run("state.custom.accounts[0].balance"), 2000.25, "an empty input must never turn a bank balance into zero");
  assert.equal(h.storage.writes, 1);
});


test("REGRESSION cash shortfall: exact cents settle to zero without a false negative day", () => {
  const h = harness();
  seedTreasury(h, [
    payment("first", h.day(1), { amount: 6250.01 }),
    payment("second", h.day(2), { amount: 18749.99 }),
  ]);
  h.run('state.custom.accounts = state.custom.accounts.map((account, i) => ({ ...account, balance: i === 0 ? 25000 : 0 })); state.horizon = 7;');
  const series = h.json("getForecastSeries(getFilteredMovements(), getAvailableBalance())");
  assert.equal(series.at(-1).balance, 0);
  assert.ok(series.every(point => point.balance >= 0));
  assert.equal(h.run("getScenarioMetrics(state.custom).firstShortfallDate"), null);
});

test("REGRESSION bank blur: recalculates KPIs but keeps movement action nodes intact", () => {
  const h = harness();
  seedTreasury(h, [payment("editable", h.day(1), { amount: 50 })]);
  h.run("bindEvents();");
  const editor = h.elements.get("#banksEditor");
  const row = new Element("DIV");
  row.dataset.bankId = "bank-a";
  const input = new Element("INPUT");
  input.parentElement = row;
  Object.assign(input.dataset, { field: "balance", moneyInput: "balance", scenarioId: "base", moneyError: "bank-balance-error-regression" });
  input.value = "1,000.00";
  editor.emit("focusin", { target: input });
  input.value = "2,000.00";
  const actionBefore = h.elements.get("#movementsTableBody").innerHTML;
  editor.emit("focusout", { target: input });
  assert.equal(h.saved().accounts[0].balance, 2000);
  assert.equal(h.elements.get("#movementsTableBody").innerHTML, actionBefore);
  assert.equal(h.run("els.availableBalance.textContent"), "$2,750.00");
});

test("STABILITY: a stale tab refuses to overwrite changes stored by another tab", () => {
  const h = harness();
  seedTreasury(h, [payment("one", h.day(1))]);
  h.run("persistCustomCandidate(state.custom)");
  const saved = h.saved();
  h.storage.setItem(STORAGE_KEY, JSON.stringify({ ...saved, externalMarker: "other-tab" }));
  assert.throws(() => h.run('commitMovementEdit(["one"], { status: "pending" }, "custom")'), /Otra pestaña/);
  assert.equal(h.saved().externalMarker, "other-tab");
  assert.equal(h.run('state.custom.movements[0].status'), "confirmed");
});

test("STABILITY: multiple undo operations restore the original sibling order", () => {
  const h = harness();
  seedTreasury(h, [payment("a", h.day(1)), payment("b", h.day(1)), payment("c", h.day(1))]);
  const a = h.run('deleteMovement("a")');
  const b = h.run('deleteMovement("b")');
  h.run('undoDeleteMovement(input)', a);
  h.run('undoDeleteMovement(input)', b);
  assert.deepEqual(h.json('state.custom.movements.map(m => m.id)'), ["a", "b", "c"]);
});

test("STABILITY: historical subcent balances do not create a cent from two displayed zeros", () => {
  const h = harness({
    accounts: [
      { id: "a", name: "A", balance: 0.0049 },
      { id: "b", name: "B", balance: 0.0049 },
    ],
    movements: [],
  });
  assert.equal(h.run("getAvailableBalance(state.custom.accounts)"), 0);
  assert.equal(h.run("getScenarioMetrics(state.custom).finalBalance"), 0);
});

test("STABILITY: export rows retain bank IDs, while an unassigned payment exports an empty bank name", () => {
  const h = harness();
  seedTreasury(h, [payment("assigned", h.day(1), { bankId: "bank-a" }), payment("unassigned", h.day(2))]);
  const rows = h.json('getExportRows("all")');
  assert.equal(rows[0].bankId, "bank-a");
  assert.equal(rows[1].bankId, "");
  assert.equal(rows[1].bank, "");
});

test("STABILITY: blocked localStorage reads never prevent loading the example", () => {
  const h = harness(undefined, { storageReadFails: true });
  assert.equal(h.run("state.scenarioStorageBlocked"), true);
  assert.match(h.run("state.scenarioLoadError"), /almacenamiento/i);
  assert.equal(h.run("state.mode"), "demo");
  assert.equal(h.run("getActiveMovements().length"), 13);
  assert.throws(() => h.run("commitWorkspace(state.custom, [], 'base')"), /almacenamiento/i);
});

test("STABILITY: opening across midnight refreshes the projection date and excludes yesterday", () => {
  const h = harness();
  const previous = h.day();
  const future = h.day(1);
  seedTreasury(h, [payment("today-movement", previous), payment("tomorrow-movement", future)]);
  h.run("initialize();");
  h.elements.get("#customModeButton").emit("click");
  assert.deepEqual(h.json("getFilteredMovements().map(m => m.id)"), ["today-movement", "tomorrow-movement"]);
  h.advanceTime(86400000);
  assert.equal(h.run("todayISO"), future);
  assert.equal(h.run("els.projectionStart.value"), future);
  assert.equal(h.run("els.movementDate.min"), future);
  assert.deepEqual(h.json("getFilteredMovements().map(m => m.id)"), ["tomorrow-movement"]);
});

test("STABILITY: reverse-sequence removals restore original order in any undo order", () => {
  for (const undoOrder of [["a", "b"], ["b", "a"]]) {
    const h = harness();
    seedTreasury(h, ["a","b","c","d"].map((id, n) => payment(id, h.day(n + 1))));
    const tokens = { b: h.run('deleteMovement("b")'), a: h.run('deleteMovement("a")') };
    for (const id of undoOrder) h.run("undoDeleteMovement(input)", tokens[id]);
    assert.deepEqual(h.json("state.custom.movements.map(m => m.id)"), ["a", "b", "c", "d"]);
  }
});

test("STABILITY: overlapping three deletions restore original order in a scrambled order", () => {
  const h = harness();
  seedTreasury(h, ["a","b","c","d","e"].map((id, n) => payment(id, h.day(n + 1))));
  const tokens = {
    b: h.run('deleteMovement("b")'),
    a: h.run('deleteMovement("a")'),
    c: h.run('deleteMovement("c")'),
  };
  for (const id of ["c", "b", "a"]) h.run("undoDeleteMovement(input)", tokens[id]);
  assert.deepEqual(h.json("state.custom.movements.map(m => m.id)"), ["a","b","c","d","e"]);
});

test("STABILITY: legacy subcent payments reconcile forecast, totals and categories consistently", () => {
  const h = harness();
  seedTreasury(h, [
    payment("tiny-1", h.day(1), { amount: 0.0049 }),
    payment("tiny-2", h.day(1), { amount: 0.0049 }),
  ], [{ id: "bank-a", name: "Banco A", balance: 100 }]);
  assert.equal(h.run("getPeriodTotals(getFilteredMovements()).outflows"), 0);
  assert.equal(h.run("getSelectionTotals(state.custom.movements).outflows"), 0);
  assert.equal(h.run("getPaymentGroups(state.custom.movements).at(-1).total"), 0);
  assert.equal(h.run("getForecastSeries(getFilteredMovements(), getAvailableBalance()).at(-1).balance"), 100);
});
