"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

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

function harness(saved) {
  const elements = new Map();
  const values = new Map(saved ? [[STORAGE_KEY, JSON.stringify(saved)]] : []);
  const storage = {
    writes: 0,
    fail: false,
    getItem: (key) => values.get(key) ?? null,
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
    Date,
    Set,
    Map,
    crypto: { randomUUID: () => `synthetic-${++nextId}` },
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
    window: { confirm: () => true },
    requestAnimationFrame: (callback) => callback(),
  });
  vm.runInContext(source, context, { filename: "app.js" });
  return {
    storage,
    elements,
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
  h.run("syncBankCount(1);");
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
