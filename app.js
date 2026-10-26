"use strict";

const STORAGE_KEY = "ivanTreasuryProjectionV2";
const CATEGORY_OPTIONS = [
  { id: "costos", label: "Costos" },
  { id: "gastos", label: "Gastos" },
  { id: "nomina", label: "Nómina" },
  { id: "financieros", label: "Financieros" },
  { id: "impuestos", label: "Impuestos" },
  { id: "otros", label: "Otros" },
];

const demoAccounts = [
  { id: "demo-1", name: "Institución Demo A", balance: 2450000 },
  { id: "demo-2", name: "Institución Demo B", balance: 980000 },
  { id: "demo-3", name: "Institución Demo C", balance: 1390000 },
];

const demoMovements = [
  { id: "d1", offsetDays: 1, concept: "Cobro Cliente Demo A", type: "inflow", amount: 580000, status: "confirmed" },
  { id: "d2", offsetDays: 2, concept: "Pago a proveedores", type: "outflow", amount: 420000, status: "confirmed" },
  { id: "d3", offsetDays: 3, concept: "Impuestos mensuales", type: "outflow", amount: 310000, status: "confirmed" },
  { id: "d4", offsetDays: 4, concept: "Cobro servicio empresarial", type: "inflow", amount: 750000, status: "pending" },
  { id: "d5", offsetDays: 5, concept: "Nómina quincenal", type: "outflow", amount: 840000, status: "confirmed" },
  { id: "d6", offsetDays: 7, concept: "Renta y servicios", type: "outflow", amount: 135000, status: "confirmed" },
  { id: "d7", offsetDays: 9, concept: "Cobro Cliente Demo B", type: "inflow", amount: 465000, status: "pending" },
  { id: "d8", offsetDays: 12, concept: "Pago de infraestructura", type: "outflow", amount: 225000, status: "pending" },
  { id: "d9", offsetDays: 15, concept: "Cobro de anualidades", type: "inflow", amount: 890000, status: "confirmed" },
  { id: "d10", offsetDays: 18, concept: "Nómina quincenal", type: "outflow", amount: 840000, status: "confirmed" },
  { id: "d11", offsetDays: 21, concept: "Pago a proveedores", type: "outflow", amount: 510000, status: "pending" },
  { id: "d12", offsetDays: 25, concept: "Cobro Cliente Demo C", type: "inflow", amount: 630000, status: "pending" },
  { id: "d13", offsetDays: 28, concept: "Impuestos provisionales", type: "outflow", amount: 340000, status: "confirmed" },
];

let today = startOfDay(new Date());
let todayISO = toISODate(today);

const state = {
  mode: "demo",
  horizon: 14,
  includePending: true,
  chartScaleMode: "auto",
  custom: loadCustomState(),
  demoEdits: new Map(),
  movementFilters: createMovementFilters(),
  selectedMovementIds: new Set(),
  movementEdit: null,
  bankRetirement: null,
  undoDeletions: new Map(),
  savedScenarios: [],
  activeScenarioId: "base",
  scenarioBase: null,
  scenarioStorageBlocked: false,
  scenarioLoadError: "",
  scenarioAction: null,
  importDraft: null,
};

loadSavedScenarios();

// Snapshot of the latest state read or written by this tab. Never overwrite
// changes from another tab silently.
let lastPersistedSnapshot = null;
try {
  lastPersistedSnapshot = localStorage.getItem(STORAGE_KEY);
} catch (error) {
  state.scenarioStorageBlocked = true;
  state.scenarioLoadError = "Este navegador bloqueó el almacenamiento. Puedes consultar el ejemplo, pero no guardar cambios personales hasta habilitarlo.";
}


const els = {
  savedScenariosPanel: document.querySelector("#savedScenariosPanel"),
  scenarioSelect: document.querySelector("#scenarioSelect"),
  createScenarioButton: document.querySelector("#createScenarioButton"),
  duplicateScenarioButton: document.querySelector("#duplicateScenarioButton"),
  renameScenarioButton: document.querySelector("#renameScenarioButton"),
  deleteScenarioButton: document.querySelector("#deleteScenarioButton"),
  returnToBaseButton: document.querySelector("#returnToBaseButton"),
  applyScenarioButton: document.querySelector("#applyScenarioButton"),
  scenarioFeedback: document.querySelector("#scenarioFeedback"),
  scenarioNameDialog: document.querySelector("#scenarioNameDialog"),
  scenarioNameForm: document.querySelector("#scenarioNameForm"),
  scenarioNameTitle: document.querySelector("#scenarioNameTitle"),
  scenarioNameInput: document.querySelector("#scenarioNameInput"),
  scenarioSourceField: document.querySelector("#scenarioSourceField"),
  scenarioSource: document.querySelector("#scenarioSource"),
  scenarioNameError: document.querySelector("#scenarioNameError"),
  cancelScenarioName: document.querySelector("#cancelScenarioName"),
  saveScenarioName: document.querySelector("#saveScenarioName"),
  scenarioDeleteDialog: document.querySelector("#scenarioDeleteDialog"),
  scenarioDeleteTitle: document.querySelector("#scenarioDeleteTitle"),
  scenarioDeleteDescription: document.querySelector("#scenarioDeleteDescription"),
  scenarioDeleteImpact: document.querySelector("#scenarioDeleteImpact"),
  scenarioDeleteError: document.querySelector("#scenarioDeleteError"),
  cancelScenarioDelete: document.querySelector("#cancelScenarioDelete"),
  confirmScenarioDelete: document.querySelector("#confirmScenarioDelete"),
  scenarioApplyDialog: document.querySelector("#scenarioApplyDialog"),
  scenarioApplyTitle: document.querySelector("#scenarioApplyTitle"),
  scenarioApplyDescription: document.querySelector("#scenarioApplyDescription"),
  scenarioApplyImpact: document.querySelector("#scenarioApplyImpact"),
  scenarioApplyError: document.querySelector("#scenarioApplyError"),
  cancelScenarioApply: document.querySelector("#cancelScenarioApply"),
  confirmScenarioApply: document.querySelector("#confirmScenarioApply"),
  scenarioComparisonBody: document.querySelector("#scenarioComparisonBody"),
  scenarioComparisonHelp: document.querySelector("#scenarioComparisonHelp"),
  movementEditHelp: document.querySelector("#movementEditHelp"),
  openImportButton: document.querySelector("#openImportButton"),
  movementImportDialog: document.querySelector("#movementImportDialog"),
  importTargetScenario: document.querySelector("#importTargetScenario"),
  importSteps: document.querySelector("#importSteps"),
  importError: document.querySelector("#importError"),
  cancelImport: document.querySelector("#cancelImport"),
  backImport: document.querySelector("#backImport"),
  nextImport: document.querySelector("#nextImport"),
  confirmImport: document.querySelector("#confirmImport"),
  importSourceStep: document.querySelector("#importSourceStep"),
  importSource: document.querySelector("#importSource"),
  importFilePanel: document.querySelector("#importFilePanel"),
  importFile: document.querySelector("#importFile"),
  importFileInfo: document.querySelector("#importFileInfo"),
  importPastePanel: document.querySelector("#importPastePanel"),
  importPaste: document.querySelector("#importPaste"),
  importMappingStep: document.querySelector("#importMappingStep"),
  importSheetField: document.querySelector("#importSheetField"),
  importSheet: document.querySelector("#importSheet"),
  importMapping: document.querySelector("#importMapping"),
  importSourcePreview: document.querySelector("#importSourcePreview"),
  importMappingError: document.querySelector("#importMappingError"),
  importHeaderRow: document.querySelector("#importHeaderRow"),
  importDateOrder: document.querySelector("#importDateOrder"),
  importNumberFormat: document.querySelector("#importNumberFormat"),
  importDefaultType: document.querySelector("#importDefaultType"),
  importDefaultStatus: document.querySelector("#importDefaultStatus"),
  importAllowPast: document.querySelector("#importAllowPast"),
  importReviewStep: document.querySelector("#importReviewStep"),
  importReviewSummary: document.querySelector("#importReviewSummary"),
  importReviewFilter: document.querySelector("#importReviewFilter"),
  importReviewBody: document.querySelector("#importReviewBody"),
  importReviewHelp: document.querySelector("#importReviewHelp"),
  importSelectValid: document.querySelector("#importSelectValid"),
  importClearSelection: document.querySelector("#importClearSelection"),
  importReviewPrev: document.querySelector("#importReviewPrev"),
  importReviewNext: document.querySelector("#importReviewNext"),
  importReviewPageLabel: document.querySelector("#importReviewPageLabel"),
  demoModeButton: document.querySelector("#demoModeButton"),
  customModeButton: document.querySelector("#customModeButton"),
  heroEyebrow: document.querySelector("#heroEyebrow"),
  heroTitlePrimary: document.querySelector("#heroTitlePrimary"),
  heroTitleAccent: document.querySelector("#heroTitleAccent"),
  heroCopy: document.querySelector("#heroCopy"),
  heroPrimaryAction: document.querySelector("#heroPrimaryAction"),
  dataPillText: document.querySelector("#dataPillText"),
  horizon: document.querySelector("#horizon"),
  projectionStart: document.querySelector("#projectionStart"),
  includePending: document.querySelector("#includePending"),
  builderSection: document.querySelector("#builderSection"),
  bankCount: document.querySelector("#bankCount"),
  banksEditor: document.querySelector("#banksEditor"),
  initialTotal: document.querySelector("#initialTotal"),
  movementForm: document.querySelector("#movementForm"),
  movementDate: document.querySelector("#movementDate"),
  movementConcept: document.querySelector("#movementConcept"),
  movementType: document.querySelector("#movementType"),
  movementStatus: document.querySelector("#movementStatus"),
  movementAmount: document.querySelector("#movementAmount"),
  movementBankField: document.querySelector("#movementBankField"),
  movementBank: document.querySelector("#movementBank"),
  movementCategoryField: document.querySelector("#movementCategoryField"),
  movementCategory: document.querySelector("#movementCategory"),
  transferFields: document.querySelector("#transferFields"),
  transferFromBank: document.querySelector("#transferFromBank"),
  transferToBank: document.querySelector("#transferToBank"),
  captureFeedback: document.querySelector("#captureFeedback"),
  capturedMovementCount: document.querySelector("#capturedMovementCount"),
  captureList: document.querySelector("#captureList"),
  resetProjection: document.querySelector("#resetProjection"),
  dashboardKicker: document.querySelector("#dashboardKicker"),
  dashboardTitle: document.querySelector("#dashboardTitle"),
  lastUpdate: document.querySelector("#lastUpdate"),
  availableBalance: document.querySelector("#availableBalance"),
  accountCountLabel: document.querySelector("#accountCountLabel"),
  periodInflows: document.querySelector("#periodInflows"),
  periodOutflows: document.querySelector("#periodOutflows"),
  projectedBalance: document.querySelector("#projectedBalance"),
  projectedDelta: document.querySelector("#projectedDelta"),
  inflowCount: document.querySelector("#inflowCount"),
  outflowCount: document.querySelector("#outflowCount"),
  accountsTableBody: document.querySelector("#accountsTableBody"),
  movementsTableBody: document.querySelector("#movementsTableBody"),
  movementSummary: document.querySelector("#movementSummary"),
  movementSearch: document.querySelector("#movementSearch"),
  movementTypeFilter: document.querySelector("#movementTypeFilter"),
  movementStatusFilter: document.querySelector("#movementStatusFilter"),
  movementBankFilter: document.querySelector("#movementBankFilter"),
  movementCategoryFilter: document.querySelector("#movementCategoryFilter"),
  movementScopeFilter: document.querySelector("#movementScopeFilter"),
  movementFromFilter: document.querySelector("#movementFromFilter"),
  movementToFilter: document.querySelector("#movementToFilter"),
  clearMovementFilters: document.querySelector("#clearMovementFilters"),
  selectAllMovements: document.querySelector("#selectAllMovements"),
  selectionSummary: document.querySelector("#selectionSummary"),
  selectionTotals: document.querySelector("#selectionTotals"),
  paymentGroups: document.querySelector("#paymentGroups"),
  exportScope: document.querySelector("#exportScope"),
  exportMovements: document.querySelector("#exportMovements"),
  exportFeedback: document.querySelector("#exportFeedback"),
  editSelectedMovements: document.querySelector("#editSelectedMovements"),
  clearMovementSelection: document.querySelector("#clearMovementSelection"),
  movementTableHint: document.querySelector("#movementTableHint"),
  movementFeedback: document.querySelector("#movementFeedback"),
  movementFilterFeedback: document.querySelector("#movementFilterFeedback"),
  movementEditDialog: document.querySelector("#movementEditDialog"),
  movementEditForm: document.querySelector("#movementEditForm"),
  movementEditTitle: document.querySelector("#movementEditTitle"),
  movementEditDescription: document.querySelector("#movementEditDescription"),
  editDateEnabled: document.querySelector("#editDateEnabled"),
  editMovementDate: document.querySelector("#editMovementDate"),
  editStatusEnabled: document.querySelector("#editStatusEnabled"),
  editMovementStatus: document.querySelector("#editMovementStatus"),
  editBankField: document.querySelector("#editBankField"),
  editBankEnabled: document.querySelector("#editBankEnabled"),
  editMovementBank: document.querySelector("#editMovementBank"),
  editIndividualFields: document.querySelector("#editIndividualFields"),
  editMovementConcept: document.querySelector("#editMovementConcept"),
  editMovementAmount: document.querySelector("#editMovementAmount"),
  editCategoryField: document.querySelector("#editCategoryField"),
  editCategoryEnabled: document.querySelector("#editCategoryEnabled"),
  editMovementCategory: document.querySelector("#editMovementCategory"),
  editTransferFields: document.querySelector("#editTransferFields"),
  editTransferFromBank: document.querySelector("#editTransferFromBank"),
  editTransferToBank: document.querySelector("#editTransferToBank"),
  addBankButton: document.querySelector("#addBankButton"),
  bankRetireDialog: document.querySelector("#bankRetireDialog"),
  bankRetireTitle: document.querySelector("#bankRetireTitle"),
  bankRetireDescription: document.querySelector("#bankRetireDescription"),
  bankRetireImpact: document.querySelector("#bankRetireImpact"),
  bankRetireError: document.querySelector("#bankRetireError"),
  cancelBankRetire: document.querySelector("#cancelBankRetire"),
  confirmBankRetire: document.querySelector("#confirmBankRetire"),
  undoToasts: document.querySelector("#undoToasts"),
  editMovementError: document.querySelector("#editMovementError"),
  editMovementPreview: document.querySelector("#editMovementPreview"),
  cancelMovementEdit: document.querySelector("#cancelMovementEdit"),
  saveMovementEdit: document.querySelector("#saveMovementEdit"),
  addMovementButton: document.querySelector("#addMovementButton"),
  minimumBalance: document.querySelector("#minimumBalance"),
  minimumBalanceDate: document.querySelector("#minimumBalanceDate"),
  largestOutflow: document.querySelector("#largestOutflow"),
  largestOutflowLabel: document.querySelector("#largestOutflowLabel"),
  pendingCount: document.querySelector("#pendingCount"),
  pendingAmount: document.querySelector("#pendingAmount"),
  chartScaleAuto: document.querySelector("#chartScaleAuto"),
  chartScaleZero: document.querySelector("#chartScaleZero"),
  forecastChart: document.querySelector("#forecastChart"),
  liveRegion: document.querySelector("#liveRegion"),
};

const currency = { format: TreasuryAccounting.format };
const detailCurrency = currency;

const compactCurrency = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  notation: "compact",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const shortDate = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
});

const longDate = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
});

function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return startOfDay(result);
}

function toISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseISODate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isValidISODate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && toISODate(parseISODate(value)) === value;
}

function differenceInDays(date, baseDate) {
  const milliseconds = startOfDay(date).getTime() - startOfDay(baseDate).getTime();
  return Math.round(milliseconds / 86400000);
}

function createId(prefix) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toSafeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function readMoneyInput(input, originalValue) {
  // An untouched legacy value must not be rounded by an unrelated edit.
  if (originalValue !== undefined && [TreasuryAccounting.inputValue(originalValue), String(originalValue), TreasuryAccounting.editingValue(originalValue)].includes(input.value)) return originalValue;
  return TreasuryAccounting.parseInput(input.value);
}

function setMoneyInputError(input, message = "") {
  input.setCustomValidity(message);
  if (message) input.setAttribute("aria-invalid", "true");
  else input.removeAttribute("aria-invalid");
  const error = input.dataset.moneyError ? document.querySelector(`#${input.dataset.moneyError}`) : null;
  if (error) { error.textContent = message; error.hidden = !message; }
}

function focusMoneyInput(input) {
  // Do not rewrite a focused field: focus/selection/paste may be one native action.
  // The formatter runs only after editing has finished.
  setMoneyInputError(input);
}

function commitBankBalance(bankId, rawValue, expectedScenarioId = state.activeScenarioId) {
  requirePersonalScenario();
  if (expectedScenarioId !== state.activeScenarioId) throw new Error("El escenario cambió. Revisa el saldo en el escenario actual.");
  const accounts = state.custom.accounts.filter((account) => account.id === bankId);
  if (accounts.length !== 1) throw new Error("No se puede identificar el banco de forma única.");
  const value = TreasuryAccounting.parseInput(rawValue);
  if (!Number.isFinite(value) || value < 0) throw new Error("Escribe un saldo desde cero, con hasta dos decimales y formato 1,234.50. El saldo anterior se conserva.");
  if (value !== accounts[0].balance) {
    persistCustomCandidate({ ...state.custom, accounts: state.custom.accounts.map((account) => account.id === bankId ? { ...account, balance: value } : account) });
  }
  return value;
}

function finishMoneyInput(input) {
  const isBalance = input.dataset.moneyInput === "balance";
  try {
    if (!input.value.trim() && !isBalance) { setMoneyInputError(input); return; }
    if (isBalance) {
      const row = input.closest("[data-bank-id]");
      const account = state.custom.accounts.find((item) => item.id === row?.dataset.bankId);
      if (!account || input.dataset.scenarioId !== state.activeScenarioId || state.mode !== "custom") throw new Error("El banco o el escenario cambió. Revisa el saldo en el destino actual.");
      const value = readMoneyInput(input, account.balance);
      // Keep pre-existing precision when merely entering/leaving the field.
      if (value === account.balance) input.value = TreasuryAccounting.inputValue(account.balance);
      else input.value = TreasuryAccounting.inputValue(commitBankBalance(account.id, input.value, input.dataset.scenarioId));
      els.initialTotal.textContent = currency.format(getAvailableBalance(state.custom.accounts));
      els.captureFeedback.textContent = "";
      // A blur can precede the click on a movement action. Preserve its DOM node.
      renderDashboard({ preserveMovementRows: true });
    } else {
      const original = input === els.editMovementAmount && state.movementEdit?.ids.length === 1 ? state.movementEdit.original[0].amount : undefined;
      const value = readMoneyInput(input, original);
      if (!(original !== undefined && value === original) && (!Number.isFinite(value) || value <= 0)) throw new Error("Escribe un importe mayor a cero, con hasta dos decimales y formato 1,234.50.");
      input.value = TreasuryAccounting.inputValue(value);
    }
    setMoneyInputError(input);
  } catch (error) {
    setMoneyInputError(input, error.message);
    if (isBalance) els.captureFeedback.textContent = error.message;
  }
  if (input === els.editMovementAmount && state.movementEdit) updateMovementEditPreview();
}

function bindMoneyInputs() {
  [els.movementAmount, els.editMovementAmount].forEach((input) => {
    input.addEventListener("focus", () => focusMoneyInput(input));
    input.addEventListener("blur", () => finishMoneyInput(input));
    input.addEventListener("input", () => setMoneyInputError(input));
  });
  els.banksEditor.addEventListener("focusin", (event) => {
    if (event.target.matches("[data-money-input]")) focusMoneyInput(event.target);
  });
  els.banksEditor.addEventListener("focusout", (event) => {
    if (event.target.matches("[data-money-input]")) finishMoneyInput(event.target);
  });
  els.banksEditor.addEventListener("input", (event) => {
    if (event.target.matches("[data-money-input]")) setMoneyInputError(event.target);
  });
}

function createDefaultCustomState() {
  return {
    accounts: [{ id: createId("bank"), name: "Banco 1", balance: 0 }],
    movements: [],
  };
}

function loadCustomState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return createDefaultCustomState();
    }

    const parsed = JSON.parse(stored);
    const accounts = Array.isArray(parsed.accounts) && parsed.accounts.length > 0
      ? parsed.accounts.slice(0, 10).map((account, index) => ({
          id: String(account.id || createId("bank")),
          name: String(account.name || `Banco ${index + 1}`).slice(0, 50),
          balance: toSafeNumber(account.balance),
        }))
      : createDefaultCustomState().accounts;

    const movements = Array.isArray(parsed.movements)
      ? parsed.movements.map((movement) => ({
          id: String(movement.id || createId("movement")),
          date: /^\d{4}-\d{2}-\d{2}$/.test(String(movement.date)) ? String(movement.date) : todayISO,
          concept: String(movement.concept || "Movimiento").slice(0, 70),
          type: ["outflow", "transfer"].includes(movement.type) ? movement.type : "inflow",
          status: movement.status === "pending" ? "pending" : "confirmed",
          amount: toSafeNumber(movement.amount),
          ...(getMovementBankId(movement) ? { bankId: getMovementBankId(movement) } : {}),
          ...(getMovementCategoryId(movement) ? { categoryId: getMovementCategoryId(movement) } : {}),
          ...(movement.type === "transfer" ? {
            fromBankId: typeof movement.fromBankId === "string" ? movement.fromBankId : "",
            toBankId: typeof movement.toBankId === "string" ? movement.toBankId : "",
          } : {}),
        }))
      : [];

    return { accounts, movements };
  } catch (error) {
    console.warn("No fue posible recuperar la proyección guardada.", error);
    return createDefaultCustomState();
  }
}

function saveCustomState() {
  try {
    persistCustomCandidate(state.custom);
  } catch (error) {
    console.warn("No fue posible guardar la proyección en este navegador.", error);
  }
}

function persistCustomCandidate(candidate) {
  if (state.activeScenarioId === "base") {
    commitWorkspace(candidate, state.savedScenarios, "base");
    return;
  }
  const active = state.savedScenarios.find((scenario) => scenario.id === state.activeScenarioId);
  if (!active) throw new Error("El escenario de destino ya no está disponible.");
  const scenarios = state.savedScenarios.map((scenario) => scenario.id === active.id
    ? { ...scenario, ...candidate, updatedAt: new Date().toISOString() } : scenario);
  commitWorkspace(getBaseProjection(), scenarios, active.id);
}

function cloneProjection(projection) {
  return { accounts: projection.accounts.map((account) => ({ ...account })),
    movements: projection.movements.map((movement) => ({ ...movement })) };
}

function getBaseProjection() {
  return state.activeScenarioId === "base" ? state.custom : state.scenarioBase;
}

function getScenarioProjection(id) {
  if (id === "base") return getBaseProjection();
  if (id === state.activeScenarioId) return state.custom;
  const scenario = state.savedScenarios.find((item) => item.id === id);
  if (!scenario) throw new Error("El escenario elegido ya no está disponible.");
  return { accounts: scenario.accounts, movements: scenario.movements };
}

function getScenarioName(id = state.activeScenarioId) {
  return id === "base" ? "Base personal" : state.savedScenarios.find((item) => item.id === id)?.name || "Escenario no disponible";
}

function loadSavedScenarios() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed.savedScenarios === undefined) return;
    if (parsed.scenarioVersion !== 1 || !Array.isArray(parsed.savedScenarios) || parsed.savedScenarios.length > 10) {
      throw new Error("Formato de escenarios desconocido.");
    }
    const ids = new Set();
    const names = new Set();
    const scenarios = parsed.savedScenarios.map((item) => {
      if (!item || typeof item.id !== "string" || !item.id || item.id === "base" || ids.has(item.id)
        || typeof item.name !== "string" || !item.name.trim() || item.name.trim().length > 60
        || names.has(item.name.trim().toLocaleLowerCase("es"))
        || !Array.isArray(item.accounts) || item.accounts.length < 1 || item.accounts.length > 10
        || !Array.isArray(item.movements)) throw new Error("Escenario incompleto.");
      const accountIds = new Set();
      item.accounts.forEach((account) => {
        if (!account || typeof account.id !== "string" || !account.id || accountIds.has(account.id)
          || typeof account.name !== "string" || !Number.isFinite(account.balance) || account.balance < 0) throw new Error("Cuenta de escenario inválida.");
        accountIds.add(account.id);
      });
      const movementIds = new Set();
      item.movements.forEach((movement) => {
        if (!movement || typeof movement.id !== "string" || !movement.id || movementIds.has(movement.id)
          || !isValidISODate(movement.date) || typeof movement.concept !== "string"
          || !["inflow", "outflow", "transfer"].includes(movement.type)
          || !["confirmed", "pending"].includes(movement.status)
          || !Number.isFinite(movement.amount) || movement.amount < 0) throw new Error("Movimiento de escenario inválido.");
        movementIds.add(movement.id);
      });
      ids.add(item.id);
      names.add(item.name.trim().toLocaleLowerCase("es"));
      return { id: item.id, name: item.name.trim(), createdAt: String(item.createdAt || ""),
        updatedAt: String(item.updatedAt || ""), ...cloneProjection(item) };
    });
    state.scenarioBase = state.custom;
    state.savedScenarios = scenarios;
    state.activeScenarioId = ids.has(parsed.activeScenarioId) ? parsed.activeScenarioId : "base";
    if (state.activeScenarioId !== "base") {
      state.custom = cloneProjection(scenarios.find((item) => item.id === state.activeScenarioId));
    }
  } catch (error) {
    // Legacy loading already handles malformed JSON. Never overwrite an unreadable scenario collection.
    let hasScenarios = false;
    try { hasScenarios = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}").savedScenarios !== undefined; } catch (_) { /* legacy */ }
    if (hasScenarios) {
      state.scenarioStorageBlocked = true;
      state.scenarioLoadError = "No se pudieron recuperar los escenarios guardados. Se muestra Base y se bloquea el guardado para conservar los datos originales.";
    }
  }
}

function commitWorkspace(base, scenarios, activeId) {
  if (state.scenarioStorageBlocked) throw new Error(state.scenarioLoadError);
  const target = activeId === "base" ? base : scenarios.find((item) => item.id === activeId);
  if (!target) throw new Error("El escenario de destino ya no está disponible.");
  const payload = scenarios.length
    ? { ...base, scenarioVersion: 1, savedScenarios: scenarios, activeScenarioId: activeId }
    : base;
  try {
    const currentSnapshot = localStorage.getItem(STORAGE_KEY);
    if (currentSnapshot !== lastPersistedSnapshot) {
      throw new Error("Otra pestaña modificó la proyección. Recarga esta página antes de guardar para evitar sobrescribir cambios.");
    }
    const nextSnapshot = JSON.stringify(payload);
    localStorage.setItem(STORAGE_KEY, nextSnapshot);
    lastPersistedSnapshot = nextSnapshot;
  } catch (error) {
    if (error.message?.includes("Otra pestaña")) throw error;
    throw new Error("No se pudo guardar en este navegador. Los datos no se modificaron. Revisa el espacio o los permisos de almacenamiento e intenta de nuevo.");
  }
  state.scenarioBase = base;
  state.savedScenarios = scenarios;
  state.activeScenarioId = activeId;
  state.custom = activeId === "base" ? base : { accounts: target.accounts, movements: target.movements };
}

function validateScenarioName(name, exceptId = "") {
  if (typeof name !== "string" || !name.trim() || name.trim().length > 60) throw new Error("Escribe un nombre de 1 a 60 caracteres.");
  const trimmed = name.trim();
  const key = trimmed.toLocaleLowerCase("es");
  if (key === "base personal" || state.savedScenarios.some((item) => item.id !== exceptId && item.name.toLocaleLowerCase("es") === key)) {
    throw new Error("Ya existe un escenario con ese nombre. Elige otro.");
  }
  return trimmed;
}

function requirePersonalScenario() {
  if (state.mode !== "custom") throw new Error("Abre tu proyección personal para trabajar con escenarios.");
}

function createSavedScenario(name, sourceId = "base") {
  requirePersonalScenario();
  if (state.savedScenarios.length >= 10) throw new Error("Puedes guardar hasta 10 escenarios. Elimina uno antes de crear otro.");
  const validName = validateScenarioName(name);
  const projection = cloneProjection(getScenarioProjection(sourceId));
  const id = createId("scenario");
  const timestamp = new Date().toISOString();
  const scenario = { id, name: validName, createdAt: timestamp, updatedAt: timestamp, ...projection };
  commitWorkspace(getBaseProjection(), [...state.savedScenarios, scenario], id);
  resetScenarioContext();
  return id;
}

function switchSavedScenario(id) {
  requirePersonalScenario();
  if (id === state.activeScenarioId) return true;
  getScenarioProjection(id);
  if ((els.movementConcept.value.trim() || els.movementAmount.value)
    && !window.confirm("Hay una captura sin guardar. ¿Quieres descartarla y cambiar de escenario?")) {
    els.scenarioSelect.value = state.activeScenarioId;
    return false;
  }
  commitWorkspace(getBaseProjection(), state.savedScenarios, id);
  resetScenarioContext();
  return true;
}

function renameSavedScenario(id, name) {
  requirePersonalScenario();
  if (id === "base") throw new Error("Base personal conserva su nombre.");
  if (!state.savedScenarios.some((item) => item.id === id)) throw new Error("El escenario ya no está disponible.");
  const validName = validateScenarioName(name, id);
  const scenarios = state.savedScenarios.map((item) => item.id === id
    ? { ...item, name: validName, updatedAt: new Date().toISOString() } : item);
  commitWorkspace(getBaseProjection(), scenarios, state.activeScenarioId);
}

function deleteSavedScenario(id) {
  requirePersonalScenario();
  if (id === "base") throw new Error("Base personal no se puede eliminar.");
  if (!state.savedScenarios.some((item) => item.id === id)) throw new Error("El escenario ya no está disponible.");
  const wasActive = state.activeScenarioId === id;
  commitWorkspace(getBaseProjection(), state.savedScenarios.filter((item) => item.id !== id), wasActive ? "base" : state.activeScenarioId);
  clearScenarioUndo(id);
  if (wasActive) resetScenarioContext();
}

function applySavedScenarioToBase(id) {
  requirePersonalScenario();
  if (id === "base") throw new Error("Elige una simulación para usarla como Base.");
  if (state.savedScenarios.length >= 10) throw new Error("Libera un lugar de escenario para conservar una copia de la Base anterior.");
  const projection = cloneProjection(getScenarioProjection(id));
  const previousBase = cloneProjection(getBaseProjection());
  const backupId = createId("scenario");
  const prefix = `Base anterior · ${todayISO}`;
  let name = prefix;
  let counter = 2;
  while (state.savedScenarios.some((item) => item.name.toLocaleLowerCase("es") === name.toLocaleLowerCase("es"))) name = `${prefix} (${counter++})`;
  const timestamp = new Date().toISOString();
  const backup = { id: backupId, name, createdAt: timestamp, updatedAt: timestamp, ...previousBase };
  commitWorkspace(projection, [...state.savedScenarios, backup], "base");
  clearScenarioUndo("base");
  resetScenarioContext();
  return backupId;
}

function clearScenarioUndo(id) {
  [...state.undoDeletions.entries()].forEach(([token, entry]) => {
    if ((entry.scenarioId || "base") === id) expireUndoDeletion(token);
  });
}

function resetScenarioContext() {
  cancelImportDraft();
  [els.movementEditDialog, els.bankRetireDialog].forEach((dialog) => { if (dialog.open) dialog.close(); });
  state.movementEdit = null;
  state.bankRetirement = null;
  state.selectedMovementIds.clear();
  state.movementFilters = createMovementFilters();
  els.movementForm.reset();
  els.movementConcept.value = "";
  els.movementAmount.value = "";
  setMoneyInputError(els.movementAmount);
  els.movementDate.value = todayISO;
  els.movementType.value = "inflow";
  els.movementStatus.value = "confirmed";
  els.movementBank.value = "";
  els.movementCategory.value = "";
  els.transferFromBank.value = "";
  els.transferToBank.value = "";
  els.captureFeedback.textContent = "";
  els.movementFeedback.textContent = "";
  els.exportFeedback.textContent = "";
  syncMovementFilterControls();
  renderUndoToasts();
}

function getScenarioMetrics(projection) {
  const movements = projection.movements.filter(isMovementIncluded);
  const initialBalance = getAvailableBalance(projection.accounts);
  const series = getForecastSeries(movements, initialBalance);
  const minimum = series.reduce((lowest, point) => point.balance < lowest.balance ? point : lowest, series[0]);
  const firstShortfall = series.find((point) => point.balance < 0);
  return { initialBalance, minimumBalance: minimum.balance, minimumDate: toISODate(minimum.date),
    finalBalance: series.at(-1).balance, firstShortfallDate: firstShortfall ? toISODate(firstShortfall.date) : null };
}

function getActiveAccounts() {
  return state.mode === "demo" ? demoAccounts : state.custom.accounts;
}

function getMovementBankId(movement) {
  return movement.type === "outflow" && typeof movement.bankId === "string" ? movement.bankId : "";
}

function getMovementBankLabel(movement, accounts = getActiveAccounts()) {
  const bankId = getMovementBankId(movement);
  if (!bankId) return "Sin banco asignado";
  return accounts.find((account) => account.id === bankId)?.name || "Banco no disponible";
}

function getBankLabel(id, accounts = getActiveAccounts()) {
  return accounts.find((account) => account.id === id)?.name || "Banco no disponible";
}

function getMovementCategoryId(movement) {
  return movement.type === "outflow" && CATEGORY_OPTIONS.some((category) => category.id === movement.categoryId)
    ? movement.categoryId : "";
}

function getMovementCategoryLabel(movement) {
  return CATEGORY_OPTIONS.find((category) => category.id === getMovementCategoryId(movement))?.label || "Sin categoría";
}

function getMovementTypeLabel(movement) {
  return { inflow: "Cobro", outflow: "Pago", transfer: "Traspaso" }[movement.type] || "Movimiento";
}

function getMovementAccountLabel(movement, accounts = getActiveAccounts()) {
  if (movement.type === "transfer") return `${getBankLabel(movement.fromBankId, accounts)} → ${getBankLabel(movement.toBankId, accounts)}`;
  return movement.type === "outflow" ? getMovementBankLabel(movement, accounts) : "";
}

function getMovementCashImpact(movement) {
  return movement.type === "inflow" ? movement.amount : movement.type === "outflow" ? -movement.amount : 0;
}

function getAccountTransferNet(bankId, movements) {
  return movements.reduce((total, movement) => movement.type !== "transfer" ? total
    : total + (movement.toBankId === bankId ? movement.amount : 0) - (movement.fromBankId === bankId ? movement.amount : 0), 0);
}

function isValidMovementAmount(amount) {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return false;
  const cents = Math.round(amount * 100);
  const rounded = cents / 100;
  const tolerance = Math.min(1e-8, Number.EPSILON * Math.max(1, Math.abs(amount)) * 2);
  return Number.isSafeInteger(cents) && Math.abs(amount - rounded) <= tolerance;
}

function validateTransfer(movement, accounts = getActiveAccounts()) {
  const ids = [movement.fromBankId, movement.toBankId];
  if (ids.some((id) => typeof id !== "string" || !id || accounts.filter((account) => account.id === id).length !== 1)) {
    throw new Error("Elige dos cuentas disponibles para el traspaso.");
  }
  if (ids[0] === ids[1]) throw new Error("La cuenta de origen y la de destino deben ser diferentes.");
}

function renderCategoryOptions(select, value = "") {
  select.innerHTML = '<option value="">Sin categoría</option>'
    + CATEGORY_OPTIONS.map((category) => `<option value="${category.id}">${category.label}</option>`).join("");
  select.value = CATEGORY_OPTIONS.some((category) => category.id === value) ? value : "";
}

function renderTransferOptions(select, accounts, value = "") {
  select.innerHTML = '<option value="">Selecciona una cuenta</option>'
    + accounts.map((account) => `<option value="${escapeHTML(account.id)}">${escapeHTML(account.name)}</option>`).join("");
  select.value = accounts.some((account) => account.id === value) ? value : "";
}

function renderBankOptions(select, accounts, bankId = "", preserveUnavailable = false) {
  const available = accounts.some((account) => account.id === bankId);
  const selectedId = available || preserveUnavailable ? bankId : "";
  select.innerHTML = '<option value="">Sin banco asignado</option>'
    + accounts.map((account) => `<option value="${escapeHTML(account.id)}">${escapeHTML(account.name)}</option>`).join("")
    + (selectedId && !available ? `<option value="${escapeHTML(selectedId)}" disabled>Banco no disponible</option>` : "");
  select.value = selectedId;
}

function renderCaptureBank() {
  const isPayment = els.movementType.value === "outflow";
  const isTransfer = els.movementType.value === "transfer";
  els.movementBankField.hidden = !isPayment;
  els.movementBank.disabled = !isPayment;
  renderBankOptions(els.movementBank, state.custom.accounts, isPayment ? els.movementBank.value : "");
  els.movementCategoryField.hidden = !isPayment;
  els.movementCategory.disabled = !isPayment;
  renderCategoryOptions(els.movementCategory, isPayment ? els.movementCategory.value : "");
  els.transferFields.hidden = !isTransfer;
  [els.transferFromBank, els.transferToBank].forEach((select) => {
    select.disabled = !isTransfer;
    renderTransferOptions(select, state.custom.accounts, isTransfer ? select.value : "");
  });
}

function getActiveMovements() {
  if (state.mode === "demo") {
    return demoMovements.map((movement) => ({
      ...movement,
      date: toISODate(addDays(today, movement.offsetDays)),
      ...state.demoEdits.get(movement.id),
    }));
  }

  return state.custom.movements;
}

function getAvailableBalance(accounts = getActiveAccounts()) {
  // Each account has a payable balance in cents. Rounding each legacy entry
  // separately prevents two visually-zero fractions combining into one cent.
  const totalCents = accounts.reduce((sum, account) => sum + Math.round(toSafeNumber(account.balance) * 100), 0);
  return totalCents / 100;
}

function isMovementIncluded(movement) {
  const offsetDays = differenceInDays(parseISODate(movement.date), today);
  const isInsideHorizon = offsetDays >= 0 && offsetDays <= state.horizon;
  const statusAllowed = state.includePending || movement.status === "confirmed";
  return isInsideHorizon && statusAllowed;
}

function getFilteredMovements() {
  return getActiveMovements()
    .filter(isMovementIncluded)
    .sort((a, b) => parseISODate(a.date) - parseISODate(b.date));
}

// Table filters are deliberately separate from the forecast inputs above.
function createMovementFilters() {
  return { query: "", type: "all", status: "all", from: "", to: "", scope: "projection", bank: "all", category: "all" };
}

function movementMatchesBank(movement, filter, accounts = getActiveAccounts()) {
  if (!filter || filter === "all") return true;
  const ids = movement.type === "transfer" ? [movement.fromBankId, movement.toBankId]
    : movement.type === "outflow" ? [getMovementBankId(movement)] : [];
  if (filter === "unassigned") return movement.type === "outflow" && !getMovementBankId(movement);
  if (filter === "unavailable") return ids.some((id) => id && !accounts.some((account) => account.id === id));
  return ids.includes(filter);
}

function getMovementFilterError() {
  const { from, to } = state.movementFilters;
  if ((from && !isValidISODate(from)) || (to && !isValidISODate(to))) {
    return "Introduce fechas válidas para filtrar.";
  }
  return from && to && from > to ? "La fecha Desde no puede ser posterior a Hasta." : "";
}

function normalizeMovementSearch(value) {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}

function getVisibleMovements() {
  if (getMovementFilterError()) return [];
  const filters = state.movementFilters;
  const query = normalizeMovementSearch(filters.query.trim());
  return getActiveMovements().filter((movement) =>
    (filters.scope === "all" || isMovementIncluded(movement))
    && (!query || normalizeMovementSearch(movement.concept).includes(query))
    && (filters.type === "all" || movement.type === filters.type)
    && (filters.status === "all" || movement.status === filters.status)
    && movementMatchesBank(movement, filters.bank)
    && (!filters.category || filters.category === "all" || (movement.type === "outflow"
      && getMovementCategoryId(movement) === (filters.category === "unassigned" ? "" : filters.category)))
    && (!filters.from || movement.date >= filters.from)
    && (!filters.to || movement.date <= filters.to)
  ).sort((a, b) => parseISODate(a.date) - parseISODate(b.date));
}

function updateMovementSelection() {
  const visibleIds = new Set(getVisibleMovements().map((movement) => movement.id));
  for (const id of state.selectedMovementIds) {
    if (!visibleIds.has(id)) state.selectedMovementIds.delete(id);
  }
  const count = state.selectedMovementIds.size;
  els.selectAllMovements.checked = count > 0 && count === visibleIds.size;
  els.selectAllMovements.indeterminate = count > 0 && count < visibleIds.size;
  els.selectAllMovements.disabled = visibleIds.size === 0;
  els.selectionSummary.textContent = `${count} ${count === 1 ? "movimiento seleccionado" : "movimientos seleccionados"}`;
  const totals = getSelectionTotals(getActiveMovements().filter((movement) => state.selectedMovementIds.has(movement.id)));
  els.selectionTotals.textContent = count
    ? `Cobros ${detailCurrency.format(totals.inflows)} · Pagos ${detailCurrency.format(totals.outflows)} · Traspasos ${detailCurrency.format(totals.transfers)} · Neto ${detailCurrency.format(totals.net)}` : "";
  els.editSelectedMovements.disabled = count === 0;
  els.clearMovementSelection.disabled = count === 0;
  els.movementsTableBody.querySelectorAll("[data-select-movement]").forEach((checkbox) => {
    checkbox.checked = state.selectedMovementIds.has(checkbox.dataset.selectMovement);
    checkbox.closest("tr").classList.toggle("is-selected", checkbox.checked);
  });
}

function getSelectionTotals(movements) {
  const totals = { count: movements.length, inflows: 0, outflows: 0, transfers: 0, net: 0 };
  movements.forEach((movement) => {
    if (movement.type === "inflow") totals.inflows += movement.amount;
    else if (movement.type === "outflow") totals.outflows += movement.amount;
    else if (movement.type === "transfer") totals.transfers += movement.amount;
  });
  totals.net = totals.inflows - totals.outflows;
  return totals;
}

function getPaymentGroups(movements = getVisibleMovements()) {
  return [...CATEGORY_OPTIONS, { id: "", label: "Sin categoría" }].map((category) => {
    const entries = movements.filter((movement) => movement.type === "outflow" && getMovementCategoryId(movement) === category.id);
    return { ...category, movements: entries, total: entries.reduce((sum, movement) => sum + movement.amount, 0) };
  }).filter((group) => group.movements.length || group.id === "");
}

function renderPaymentGroups() {
  els.paymentGroups.innerHTML = getPaymentGroups().map((group) => `
    <details class="payment-category" ${group.id === "" ? "open" : ""}>
      <summary class="category-heading"><strong>${group.label}</strong><span>${group.movements.length} ${group.movements.length === 1 ? "pago" : "pagos"}</span><strong>${detailCurrency.format(group.total)}</strong></summary>
      ${group.movements.length ? group.movements.map((movement) => `<div class="category-payment">
        <div><strong>${escapeHTML(movement.concept)}</strong><small>${shortDate.format(parseISODate(movement.date))} · ${escapeHTML(getMovementBankLabel(movement))}</small></div>
        <span class="amount-out">${detailCurrency.format(movement.amount)}</span>
      </div>`).join("") : '<p class="category-empty">No hay pagos sin categoría con estos filtros.</p>'}
    </details>`).join("");
}

function clearMovementSelection() {
  state.selectedMovementIds.clear();
  updateMovementSelection();
}

function syncMovementFilterControls() {
  const filters = state.movementFilters;
  els.movementSearch.value = filters.query;
  els.movementTypeFilter.value = filters.type;
  els.movementStatusFilter.value = filters.status;
  els.movementScopeFilter.value = filters.scope;
  els.movementFromFilter.value = filters.from;
  els.movementToFilter.value = filters.to;
  renderMovementFilterOptions();
}

function renderMovementFilterOptions() {
  els.movementBankFilter.innerHTML = '<option value="all">Todos los bancos</option><option value="unassigned">Pagos sin banco</option><option value="unavailable">Banco no disponible</option>'
    + getActiveAccounts().map((account) => `<option value="${escapeHTML(account.id)}">${escapeHTML(account.name)}</option>`).join("");
  const bank = state.movementFilters.bank || "all";
  const validBank = ["all", "unassigned", "unavailable"].includes(bank) || getActiveAccounts().some((account) => account.id === bank);
  state.movementFilters.bank = validBank ? bank : "all";
  els.movementBankFilter.value = state.movementFilters.bank;
  els.movementCategoryFilter.innerHTML = '<option value="all">Todas las categorías</option><option value="unassigned">Sin categoría</option>'
    + CATEGORY_OPTIONS.map((category) => `<option value="${category.id}">${category.label}</option>`).join("");
  els.movementCategoryFilter.value = state.movementFilters.category || "all";
}

function prepareMovementEdit(movements, ids, patch, accounts = getActiveAccounts()) {
  if (!Array.isArray(ids) || ids.length === 0 || new Set(ids).size !== ids.length) {
    throw new Error("Selecciona movimientos únicos antes de editar.");
  }
  const fields = patch && typeof patch === "object" ? Object.keys(patch) : [];
  const allowed = ["date", "status", "bankId", "categoryId", "concept", "amount", "fromBankId", "toBankId"];
  if (fields.length === 0 || fields.some((field) => !allowed.includes(field))) {
    throw new Error("Elige los campos y los nuevos valores que quieres cambiar.");
  }
  if (ids.length !== 1 && fields.some((field) => ["concept", "amount", "fromBankId", "toBankId"].includes(field))) {
    throw new Error("El concepto, importe y las cuentas de un traspaso solo se editan individualmente.");
  }
  const changes = { ...patch };
  if (fields.includes("concept")) {
    if (typeof patch.concept !== "string" || !patch.concept.trim() || patch.concept.trim().length > 70) {
      throw new Error("Escribe un concepto de 1 a 70 caracteres.");
    }
    changes.concept = patch.concept.trim();
  }
  if (fields.includes("amount") && !isValidMovementAmount(patch.amount)) {
    throw new Error("El importe debe ser mayor a cero y tener como máximo dos decimales.");
  }
  if (fields.includes("date") && (!isValidISODate(patch.date) || patch.date < todayISO)) {
    throw new Error("La nueva fecha debe ser válida y no puede ser anterior a hoy.");
  }
  if (fields.includes("status") && !["confirmed", "pending"].includes(patch.status)) {
    throw new Error("Elige Confirmado o Por confirmar.");
  }
  const selected = new Set(ids);
  const counts = new Map(ids.map((id) => [id, 0]));
  movements.forEach((movement) => {
    if (selected.has(movement.id)) counts.set(movement.id, counts.get(movement.id) + 1);
  });
  if ([...counts.values()].some((count) => count !== 1)) {
    throw new Error("Hay movimientos ausentes o con identificadores duplicados. Cierra el editor y revisa la selección.");
  }
  if (fields.includes("bankId")) {
    if (movements.some((movement) => selected.has(movement.id) && movement.type !== "outflow")) {
      throw new Error("Para cambiar el banco, selecciona únicamente pagos.");
    }
    if (typeof patch.bankId !== "string" || (patch.bankId && accounts.filter((account) => account.id === patch.bankId).length !== 1)) {
      throw new Error("Elige un banco disponible o Sin banco asignado.");
    }
  }
  if (fields.includes("categoryId")) {
    if (movements.some((movement) => selected.has(movement.id) && movement.type !== "outflow")) {
      throw new Error("Para cambiar la categoría, selecciona únicamente pagos.");
    }
    if (typeof patch.categoryId !== "string" || (patch.categoryId && !CATEGORY_OPTIONS.some((category) => category.id === patch.categoryId))) {
      throw new Error("Elige una categoría disponible o Sin categoría.");
    }
  }
  if (fields.some((field) => ["fromBankId", "toBankId"].includes(field))
    && movements.some((movement) => selected.has(movement.id) && movement.type !== "transfer")) {
    throw new Error("Las cuentas de origen y destino solo corresponden a traspasos.");
  }
  movements.filter((movement) => selected.has(movement.id) && movement.type === "transfer").forEach((movement) => {
    if (fields.some((field) => ["date", "amount", "fromBankId", "toBankId"].includes(field))) validateTransfer({ ...movement, ...changes }, accounts);
  });
  let changedCount = 0;
  const updated = movements.map((movement) => {
    if (!selected.has(movement.id) || !fields.some((field) =>
      (field === "bankId" ? getMovementBankId(movement) : field === "categoryId" ? getMovementCategoryId(movement) : movement[field]) !== changes[field])) return movement;
    changedCount += 1;
    return { ...movement, ...changes };
  });
  return { movements: updated, changedCount };
}

function commitMovementEdit(ids, patch, mode, expectedScenarioId = state.activeScenarioId) {
  if (mode !== state.mode || !["demo", "custom"].includes(mode)) {
    throw new Error("La vista cambió. Cierra el editor y selecciona de nuevo los movimientos.");
  }
  if (mode === "custom" && expectedScenarioId !== state.activeScenarioId) throw new Error("El escenario cambió. Abre de nuevo el movimiento.");
  const result = prepareMovementEdit(getActiveMovements(), ids, patch, getActiveAccounts());
  if (result.changedCount === 0) return 0;
  if (mode === "custom") {
    persistCustomCandidate({ ...state.custom, movements: result.movements });
  } else {
    const selected = new Set(ids);
    result.movements.forEach((movement) => {
      if (selected.has(movement.id)) {
        state.demoEdits.set(movement.id, {
          date: movement.date,
          status: movement.status,
          concept: movement.concept,
          amount: movement.amount,
          ...(movement.type === "outflow" ? { bankId: getMovementBankId(movement), categoryId: getMovementCategoryId(movement) } : {}),
          ...(movement.type === "transfer" ? { fromBankId: movement.fromBankId, toBankId: movement.toBankId } : {}),
        });
      }
    });
  }
  return result.changedCount;
}

function validateNewMovement(input, accounts = state.custom.accounts, allowPast = false) {
  if (!input || typeof input.concept !== "string" || !input.concept.trim() || input.concept.trim().length > 70) throw new Error("Escribe un concepto de 1 a 70 caracteres.");
  if (!isValidISODate(input.date) || (!allowPast && input.date < todayISO)) throw new Error("Elige una fecha válida desde hoy; los históricos requieren autorización en la importación.");
  if (!isValidMovementAmount(input.amount) || input.amount >= 1e13) throw new Error("El importe debe ser positivo, menor a 10 billones y tener hasta dos decimales.");
  if (!["inflow", "outflow", "transfer"].includes(input.type)) throw new Error("Elige Cobro, Pago o Traspaso.");
  if (!["confirmed", "pending"].includes(input.status)) throw new Error("Elige Confirmado o Por confirmar.");
  const movement = { date: input.date, concept: input.concept.trim(), type: input.type, status: input.status, amount: input.amount };
  if (input.type === "outflow") {
    const bankId = input.bankId === undefined ? "" : input.bankId;
    const categoryId = input.categoryId === undefined ? "" : input.categoryId;
    if (typeof bankId !== "string" || (bankId && accounts.filter((account) => account.id === bankId).length !== 1)) throw new Error("Elige un banco disponible o Sin banco asignado.");
    if (typeof categoryId !== "string" || (categoryId && !CATEGORY_OPTIONS.some((category) => category.id === categoryId))) throw new Error("Elige una categoría disponible o Sin categoría.");
    if (bankId) movement.bankId = bankId;
    if (categoryId) movement.categoryId = categoryId;
  }
  if (input.type === "transfer") {
    movement.fromBankId = input.fromBankId;
    movement.toBankId = input.toBankId;
    validateTransfer(movement, accounts);
  }
  return movement;
}

function freshMovementId(used) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const id = createId("movement");
    if (!used.has(id)) { used.add(id); return id; }
  }
  throw new Error("No se pudo generar un identificador único. Intenta de nuevo.");
}

function commitDuplicateMovement(id, patch = {}, expectedScenarioId = state.activeScenarioId) {
  requirePersonalScenario();
  if (expectedScenarioId !== state.activeScenarioId) throw new Error("El escenario cambió. Abre otra vez la copia.");
  const matches = state.custom.movements.filter((movement) => movement.id === id);
  if (matches.length !== 1) throw new Error("No se puede identificar el movimiento original de forma única.");
  const allowed = ["date", "concept", "amount", "status", "bankId", "categoryId", "fromBankId", "toBankId"];
  if (!patch || typeof patch !== "object" || Object.keys(patch).some((field) => !allowed.includes(field))) throw new Error("La copia contiene campos no admitidos.");
  if (matches[0].type !== "outflow" && ["bankId", "categoryId"].some((field) => Object.hasOwn(patch, field))) throw new Error("Solo los pagos admiten banco y categoría.");
  if (matches[0].type !== "transfer" && ["fromBankId", "toBankId"].some((field) => Object.hasOwn(patch, field))) throw new Error("Solo los traspasos admiten cuentas de origen y destino.");
  const normalized = validateNewMovement({ ...matches[0], ...patch });
  const used = new Set(state.custom.movements.map((movement) => movement.id));
  const movement = { id: freshMovementId(used), ...normalized };
  persistCustomCandidate({ ...state.custom, movements: [...state.custom.movements, movement] });
  return movement;
}

function commitImportedMovements(report, selectedRowNumbers, expectedScenarioId, allowPast = false) {
  requirePersonalScenario();
  if (expectedScenarioId !== state.activeScenarioId) throw new Error("El escenario cambió. Revisa de nuevo la importación en el destino elegido.");
  if (!report || !Array.isArray(report.rows) || !Array.isArray(selectedRowNumbers) || !selectedRowNumbers.length
    || selectedRowNumbers.length > 5000 || new Set(selectedRowNumbers).size !== selectedRowNumbers.length) throw new Error("Selecciona filas válidas y únicas para importar.");
  const normalized = selectedRowNumbers.map((number) => {
    const matches = report.rows.filter((row) => row.rowNumber === number);
    if (matches.length !== 1 || !matches[0].movement || !Array.isArray(matches[0].errors) || matches[0].errors.length) throw new Error(`La fila ${number} no está lista para importar.`);
    return validateNewMovement(matches[0].movement, state.custom.accounts, allowPast === true);
  });
  const used = new Set(state.custom.movements.map((movement) => movement.id));
  const movements = normalized.map((movement) => ({ id: freshMovementId(used), ...movement }));
  persistCustomCandidate({ ...state.custom, movements: [...state.custom.movements, ...movements] });
  return movements;
}

function getMovementEditPatch() {
  const edit = state.movementEdit;
  const patch = {};
  if (els.editDateEnabled.checked) patch.date = els.editMovementDate.value;
  if (els.editStatusEnabled.checked) patch.status = els.editMovementStatus.value;
  if (!els.editBankEnabled.disabled && els.editBankEnabled.checked) patch.bankId = els.editMovementBank.value;
  if (!els.editCategoryEnabled.disabled && els.editCategoryEnabled.checked) patch.categoryId = els.editMovementCategory.value;
  if (edit && edit.ids.length === 1) {
    patch.concept = els.editMovementConcept.value.trim();
    patch.amount = readMoneyInput(els.editMovementAmount, edit.original[0].amount);
    if (edit.original[0].type === "transfer") {
      patch.fromBankId = els.editTransferFromBank.value;
      patch.toBankId = els.editTransferToBank.value;
    }
  }
  // An unchanged historical date must not block an individual status edit.
  if (edit && edit.ids.length === 1) {
    Object.keys(patch).forEach((field) => {
      const original = field === "bankId" ? getMovementBankId(edit.original[0])
        : field === "categoryId" ? getMovementCategoryId(edit.original[0]) : edit.original[0][field];
      if (patch[field] === original) delete patch[field];
    });
  }
  return patch;
}

function updateMovementEditPreview() {
  els.editMovementDate.disabled = !els.editDateEnabled.checked;
  els.editMovementStatus.disabled = !els.editStatusEnabled.checked;
  els.editMovementBank.disabled = els.editBankEnabled.disabled || !els.editBankEnabled.checked;
  els.editMovementCategory.disabled = els.editCategoryEnabled.disabled || !els.editCategoryEnabled.checked;
  els.editMovementError.textContent = "";
  els.saveMovementEdit.disabled = true;
  if (!state.movementEdit) return;
  if (state.movementEdit.kind === "duplicate") {
    try {
      validateNewMovement({ ...state.movementEdit.original[0], ...getMovementEditPatch() });
      els.editMovementPreview.textContent = `Se añadirá una copia a ${getScenarioName()}. El movimiento original se conserva.`;
      els.saveMovementEdit.disabled = false;
    } catch (error) {
      els.editMovementPreview.textContent = "Revisa los datos de la copia antes de agregarla.";
      els.editMovementError.textContent = error.message;
    }
    return;
  }
  const patch = getMovementEditPatch();
  if (Object.keys(patch).length === 0) {
    els.editMovementPreview.textContent = "Elige los campos y los nuevos valores que quieres aplicar.";
    return;
  }
  try {
    const result = prepareMovementEdit(getActiveMovements(), state.movementEdit.ids, patch, getActiveAccounts());
    const fieldLabels = { date: "fecha", status: "estatus", bankId: "banco", categoryId: "categoría", concept: "concepto", amount: "importe", fromBankId: "cuenta de origen", toBankId: "cuenta de destino" };
    const fields = Object.keys(patch).map((field) => fieldLabels[field]).join(", ");
    els.editMovementPreview.textContent = result.changedCount
      ? `Se aplicarán los cambios de ${fields} a ${result.changedCount} de ${state.movementEdit.ids.length} movimientos seleccionados.`
      : "Los movimientos ya tienen los valores indicados.";
    els.saveMovementEdit.disabled = result.changedCount === 0;
  } catch (error) {
    els.editMovementPreview.textContent = "No se aplicarán cambios hasta corregir los datos.";
    els.editMovementError.textContent = error.message;
  }
}

function openMovementEditor(ids, opener = document.activeElement, kind = "edit") {
  if (kind === "duplicate" && (state.mode !== "custom" || ids.length !== 1)) return;
  const active = getActiveMovements();
  const originals = ids.map((id) => active.filter((movement) => movement.id === id));
  if (ids.length === 0 || new Set(ids).size !== ids.length || originals.some((matches) => matches.length !== 1)) {
    els.movementFeedback.textContent = "No se puede editar esta selección: hay movimientos ausentes o identificadores duplicados.";
    return;
  }
  const movements = originals.map(([movement]) => ({ ...movement }));
  state.movementEdit = {
    ids: [...ids], mode: state.mode, original: movements, opener, kind, scenarioId: state.activeScenarioId,
    openerId: opener?.dataset?.editMovement || opener?.dataset?.duplicateMovement,
    openerInCapture: Boolean(opener?.closest?.("#captureList")),
  };
  const single = ids.length === 1;
  const first = movements[0];
  const onlyPayments = movements.every((movement) => movement.type === "outflow");
  els.movementEditTitle.textContent = kind === "duplicate" ? "Duplicar movimiento" : single ? "Editar movimiento" : `Editar ${ids.length} movimientos`;
  els.saveMovementEdit.textContent = kind === "duplicate" ? "Agregar copia" : "Guardar cambios";
  els.movementEditHelp.textContent = kind === "duplicate"
    ? "Revisa la fecha y los datos. La copia se guardará como otro movimiento en el escenario activo."
    : "Marca los campos que quieres cambiar. Los demás conservarán su valor.";
  els.movementEditDescription.textContent = single
    ? `${getMovementTypeLabel(first)} · ${detailCurrency.format(first.amount)}. Corrige los datos y revisa los cambios antes de guardar.`
    : `Los nuevos valores se aplicarán a los ${ids.length} movimientos seleccionados.`;
  els.editDateEnabled.checked = single;
  els.editStatusEnabled.checked = single;
  els.editBankField.hidden = !onlyPayments;
  els.editBankEnabled.disabled = !onlyPayments;
  els.editBankEnabled.checked = single && onlyPayments;
  els.editCategoryField.hidden = !onlyPayments;
  els.editCategoryEnabled.disabled = !onlyPayments;
  els.editCategoryEnabled.checked = single && onlyPayments;
  els.editIndividualFields.hidden = !single;
  els.editMovementConcept.disabled = !single;
  els.editMovementAmount.disabled = !single;
  els.editMovementConcept.value = single ? first.concept : "";
  els.editMovementAmount.value = single ? TreasuryAccounting.inputValue(first.amount) : "";
  setMoneyInputError(els.editMovementAmount);
  const isTransfer = single && first.type === "transfer";
  els.editTransferFields.hidden = !isTransfer;
  [els.editTransferFromBank, els.editTransferToBank].forEach((select) => { select.disabled = !isTransfer; });
  renderTransferOptions(els.editTransferFromBank, getActiveAccounts(), isTransfer ? first.fromBankId : "");
  renderTransferOptions(els.editTransferToBank, getActiveAccounts(), isTransfer ? first.toBankId : "");
  els.editMovementDate.min = todayISO;
  els.editMovementDate.value = movements.every((movement) => movement.date === first.date) ? first.date : todayISO;
  els.editMovementStatus.value = movements.every((movement) => movement.status === first.status) ? first.status : "confirmed";
  const bankId = getMovementBankId(first);
  const commonBankId = onlyPayments && movements.every((movement) => getMovementBankId(movement) === bankId) ? bankId : "";
  renderBankOptions(els.editMovementBank, getActiveAccounts(), commonBankId, true);
  const categoryId = getMovementCategoryId(first);
  renderCategoryOptions(els.editMovementCategory, onlyPayments && movements.every((movement) => getMovementCategoryId(movement) === categoryId) ? categoryId : "");
  updateMovementEditPreview();
  els.movementEditDialog.showModal();
  (single ? els.editMovementDate : els.editDateEnabled).focus();
}

function finishMovementEditor() {
  const edit = state.movementEdit;
  const opener = edit?.opener;
  state.movementEdit = null;
  if (opener?.isConnected && !opener.disabled) {
    opener.focus();
    return;
  }
  if (edit?.openerId && edit.mode === state.mode) {
    const container = edit.openerInCapture ? els.captureList : els.movementsTableBody;
    const action = edit.kind === "duplicate" ? "duplicateMovement" : "editMovement";
    const replacement = [...container.querySelectorAll(edit.kind === "duplicate" ? "[data-duplicate-movement]" : "[data-edit-movement]")]
      .find((button) => button.dataset[action] === edit.openerId);
    if (replacement) {
      replacement.focus();
      return;
    }
  }
  els.movementSearch.focus();
}

function submitMovementEdit(event) {
  event.preventDefault();
  const edit = state.movementEdit;
  if (!edit) return;
  try {
    if (edit.kind === "duplicate") {
      const copy = commitDuplicateMovement(edit.ids[0], getMovementEditPatch(), edit.scenarioId);
      state.selectedMovementIds.clear();
      renderCaptureList();
      renderDashboard();
      const message = `Movimiento duplicado en ${getScenarioName()}. ${getVisibleMovements().some((movement) => movement.id === copy.id) ? "" : "La copia está fuera de los filtros actuales; elige Todos los movimientos para verla."}`;
      els.movementFeedback.textContent = message;
      els.captureFeedback.textContent = message;
      els.movementEditDialog.close();
      return;
    }
    const count = commitMovementEdit(edit.ids, getMovementEditPatch(), edit.mode, edit.scenarioId);
    if (!count) {
      els.editMovementError.textContent = "No hay cambios que guardar.";
      return;
    }
    state.selectedMovementIds.clear();
    renderCaptureList();
    renderDashboard();
    const hiddenCount = edit.ids.filter((id) => !getVisibleMovements().some((movement) => movement.id === id)).length;
    els.movementFeedback.textContent = `${count} ${count === 1 ? "movimiento actualizado" : "movimientos actualizados"}. `
      + (state.mode === "demo" ? "Cambios de ejemplo temporales; se restablecen al recargar. " : "Cambios guardados en este navegador. ")
      + (hiddenCount ? `${hiddenCount} ${hiddenCount === 1 ? "queda" : "quedan"} fuera de los filtros actuales. Usa Todos los movimientos o limpia los filtros para verlos.` : "");
    els.movementEditDialog.close();
  } catch (error) {
    els.editMovementError.textContent = error.message;
  }
}

function handleCaptureKeydown(event) {
  if (event.key === "Enter" && event.target.tagName === "INPUT" && !event.isComposing) {
    event.preventDefault();
    els.captureFeedback.textContent = "Tu captura se conserva. Usa Agregar movimiento para registrarla.";
  }
}

function getPeriodTotals(filteredMovements) {
  return filteredMovements.reduce(
    (totals, movement) => {
      if (movement.type === "inflow") {
        totals.inflows += movement.amount;
        totals.inflowCount += 1;
      } else if (movement.type === "outflow") {
        totals.outflows += movement.amount;
        totals.outflowCount += 1;
      }
      return totals;
    },
    { inflows: 0, outflows: 0, inflowCount: 0, outflowCount: 0 },
  );
}

function getForecastSeries(filteredMovements, startingBalance) {
  const movementMap = new Map();

  filteredMovements.forEach((movement) => {
    const day = differenceInDays(parseISODate(movement.date), today);
    const existing = movementMap.get(day) ?? [];
    existing.push(movement);
    movementMap.set(day, existing);
  });

  // Store the running position in integer cents: zero must never be a
  // negative floating-point residue that triggers a false cash shortfall.
  let runningCents = Math.round(startingBalance * 100);
  const series = [{ day: 0, date: today, balance: runningCents / 100, movements: movementMap.get(0) ?? [] }];

  const applyMovements = (movements) => {
    movements.forEach((movement) => {
      runningCents += Math.round(getMovementCashImpact(movement) * 100);
    });
    return runningCents / 100;
  };

  series[0].balance = applyMovements(movementMap.get(0) ?? []);

  for (let day = 1; day <= state.horizon; day += 1) {
    const dayMovements = movementMap.get(day) ?? [];
    series.push({
      day,
      date: addDays(today, day),
      balance: applyMovements(dayMovements),
      movements: dayMovements,
    });
  }

  return series;
}

function setMode(mode, options = {}) {
  cancelImportDraft();
  [els.scenarioNameDialog, els.scenarioDeleteDialog, els.scenarioApplyDialog].forEach((dialog) => { if (dialog.open) dialog.close(); });
  if (els.movementEditDialog.open) els.movementEditDialog.close();
  if (els.bankRetireDialog.open) els.bankRetireDialog.close();
  state.mode = mode;
  state.selectedMovementIds.clear();
  state.movementFilters = createMovementFilters();
  syncMovementFilterControls();
  els.movementFeedback.textContent = "";
  const isCustom = mode === "custom";

  els.demoModeButton.classList.toggle("is-active", !isCustom);
  els.customModeButton.classList.toggle("is-active", isCustom);
  els.builderSection.classList.toggle("is-hidden", !isCustom);

  if (isCustom) {
    els.heroEyebrow.textContent = "TU PROYECCIÓN";
    els.heroTitlePrimary.textContent = "Empieza con tu posición actual.";
    els.heroTitleAccent.textContent = "Anticipa lo que viene.";
    els.heroCopy.textContent =
      "Agrega tus bancos, registra cobros y pagos y revisa cómo evoluciona tu liquidez desde hoy.";
    els.heroPrimaryAction.textContent = "Configurar mis saldos";
    els.dataPillText.textContent = "Datos guardados solo en tu navegador";
    els.dashboardKicker.textContent = "TU ESCENARIO";
    els.dashboardTitle.textContent = "Tu proyección de caja, actualizada al momento";
  } else {
    els.heroEyebrow.textContent = "EJEMPLO INTERACTIVO";
    els.heroTitlePrimary.textContent = "Liquidez bajo control.";
    els.heroTitleAccent.textContent = "Decisiones a tiempo.";
    els.heroCopy.textContent =
      "Explora una proyección demostrativa y revisa cómo cambian los saldos al considerar cobros, pagos y movimientos por confirmar.";
    els.heroPrimaryAction.textContent = "Crear mi proyección";
    els.dataPillText.textContent = "Datos 100% simulados";
    els.dashboardKicker.textContent = "ESCENARIO DE EJEMPLO";
    els.dashboardTitle.textContent = "Tu posición de caja, en una sola vista";
  }

  renderBuilder();
  renderDashboard();
  renderUndoToasts();

  if (options.scrollToBuilder && isCustom) {
    requestAnimationFrame(() => {
      els.builderSection.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}

function syncBankCount(newCount) {
  const safeCount = Math.min(10, Math.max(1, Math.trunc(toSafeNumber(newCount) || 1)));
  const currentAccounts = [...state.custom.accounts];

  if (safeCount > currentAccounts.length) {
    for (let index = currentAccounts.length; index < safeCount; index += 1) {
      currentAccounts.push({
        id: createId("bank"),
        name: `Banco ${index + 1}`,
        balance: 0,
      });
    }
  } else if (safeCount < currentAccounts.length) {
    throw new Error("Usa Retirar en el banco que quieras quitar para revisar sus movimientos vinculados.");
  }

  persistCustomCandidate({ ...state.custom, accounts: currentAccounts });
  els.bankCount.value = String(safeCount);
  renderBuilder();
  renderDashboard();
}

function getBankRemovalImpact(bankId) {
  const accounts = state.custom.accounts.filter((account) => account.id === bankId);
  if (accounts.length !== 1) throw new Error("No se puede identificar este banco de forma única.");
  const transfers = state.custom.movements.filter((movement) => movement.type === "transfer"
    && [movement.fromBankId, movement.toBankId].includes(bankId));
  return {
    account: accounts[0],
    paymentCount: state.custom.movements.filter((movement) => movement.type === "outflow" && getMovementBankId(movement) === bankId).length,
    transferCount: transfers.length,
    transferAmount: transfers.reduce((sum, movement) => sum + movement.amount, 0),
  };
}

function commitBankRemoval(bankId) {
  if (state.mode !== "custom") throw new Error("Solo puedes retirar bancos de tu proyección.");
  const impact = getBankRemovalImpact(bankId);
  if (state.custom.accounts.length <= 1) throw new Error("Conserva al menos un banco en tu proyección.");
  if (impact.transferCount) throw new Error("Reasigna o elimina los traspasos vinculados antes de retirar este banco.");
  persistCustomCandidate({ ...state.custom, accounts: state.custom.accounts.filter((account) => account.id !== bankId) });
  return impact;
}

function openBankRetirement(bankId, opener = document.activeElement) {
  try {
    const impact = getBankRemovalImpact(bankId);
    state.bankRetirement = { bankId, opener };
    els.bankRetireTitle.textContent = `Retirar ${impact.account.name}`;
    els.bankRetireDescription.textContent = "Revisa el saldo y todos los movimientos vinculados antes de retirar el banco.";
    els.bankRetireImpact.innerHTML = `<dl class="bank-retire-impact-list">
      <div><dt>Saldo inicial</dt><dd>${detailCurrency.format(impact.account.balance)}</dd></div>
      <div><dt>Traspasos vinculados</dt><dd>${impact.transferCount} · ${detailCurrency.format(impact.transferAmount)}</dd></div>
      <div><dt>Pagos asignados</dt><dd>${impact.paymentCount}</dd></div></dl>
      <p>Los pagos se conservarán como Banco no disponible y podrás reasignarlos.</p>`;
    els.bankRetireError.textContent = state.custom.accounts.length <= 1 ? "Conserva al menos un banco en tu proyección."
      : impact.transferCount ? "Reasigna o elimina los traspasos vinculados antes de retirar este banco." : "";
    els.confirmBankRetire.disabled = Boolean(els.bankRetireError.textContent);
    els.bankRetireDialog.showModal();
    els.cancelBankRetire.focus();
  } catch (error) {
    els.captureFeedback.textContent = error.message;
  }
}

function submitBankRetirement() {
  if (!state.bankRetirement) return;
  try {
    const impact = commitBankRemoval(state.bankRetirement.bankId);
    els.bankRetireDialog.close();
    renderBuilder();
    renderDashboard();
    els.captureFeedback.textContent = `${impact.account.name} retirado. Sus pagos se conservaron.`;
    els.addBankButton.focus();
  } catch (error) {
    els.bankRetireError.textContent = error.message;
  }
}

function renderBanksEditor() {
  els.bankCount.value = String(state.custom.accounts.length);
  els.addBankButton.disabled = state.custom.accounts.length >= 10;
  els.banksEditor.innerHTML = state.custom.accounts
    .map(
      (account, index) => `
        <div class="bank-row" data-bank-id="${escapeHTML(account.id)}">
          <span class="bank-row-number">BANCO ${index + 1}</span>
          <button class="bank-retire-button" type="button" data-retire-bank="${escapeHTML(account.id)}" aria-label="Retirar ${escapeHTML(account.name)}">Retirar</button>
          <div class="field-group">
            <label for="bank-name-${index}">Nombre</label>
            <input
              id="bank-name-${index}"
              type="text"
              maxlength="50"
              value="${escapeHTML(account.name)}"
              data-field="name"
            />
          </div>
          <div class="field-group">
            <label for="bank-balance-${index}">Saldo (MXN)</label>
            <div class="accounting-input"><span aria-hidden="true">$</span><input
              id="bank-balance-${index}"
              type="text"
              inputmode="decimal"
              autocomplete="off"
              spellcheck="false"
              value="${escapeHTML(TreasuryAccounting.inputValue(account.balance))}"
              data-field="balance"
              data-money-input="balance"
              data-money-error="bank-balance-error-${index}"
              data-scenario-id="${escapeHTML(state.activeScenarioId)}"
              aria-describedby="bank-balance-help bank-balance-error-${index}"
            /></div>
            <p class="money-input-error" id="bank-balance-error-${index}" role="alert" hidden></p>
          </div>
        </div>
      `,
    )
    .join("");

  els.initialTotal.textContent = detailCurrency.format(getAvailableBalance(state.custom.accounts));
}

function renderCaptureList() {
  const movements = [...state.custom.movements].sort((a, b) => parseISODate(a.date) - parseISODate(b.date));
  els.capturedMovementCount.textContent = `${movements.length} ${movements.length === 1 ? "movimiento" : "movimientos"}`;

  if (movements.length === 0) {
    els.captureList.innerHTML = '<div class="capture-empty">Aún no has agregado cobros ni pagos.</div>';
    return;
  }

  els.captureList.innerHTML = movements
    .map((movement) => {
      const isInflow = movement.type === "inflow";
      const isTransfer = movement.type === "transfer";
      const typeLabel = getMovementTypeLabel(movement);
      const statusLabel = movement.status === "pending" ? "Por confirmar" : "Confirmado";
      const accountLabel = getMovementAccountLabel(movement, state.custom.accounts);
      const categoryLabel = movement.type === "outflow" ? getMovementCategoryLabel(movement) : "";
      return `
        <div class="capture-item" data-movement-id="${escapeHTML(movement.id)}">
          <div>
            <strong>${escapeHTML(movement.concept)}</strong>
            <small>${shortDate.format(parseISODate(movement.date))} · ${typeLabel} · ${statusLabel}${accountLabel ? ` · ${escapeHTML(accountLabel)}` : ""}${categoryLabel ? ` · ${categoryLabel}` : ""}</small>
          </div>
          <span class="capture-amount ${isTransfer ? "amount-transfer" : isInflow ? "amount-in" : "amount-out"}">
            ${isTransfer ? "↔ " : ""}${detailCurrency.format(isInflow || isTransfer ? movement.amount : -movement.amount)}
          </span>
          <div class="capture-item-actions">
            <button class="capture-edit-button" type="button"
              aria-label="Editar ${escapeHTML(movement.concept)}"
              data-edit-movement="${escapeHTML(movement.id)}">Editar</button>
            <button class="movement-duplicate-button" type="button" aria-label="Duplicar ${escapeHTML(movement.concept)}"
              data-duplicate-movement="${escapeHTML(movement.id)}">Duplicar</button>
            <button
              class="icon-button"
              type="button"
              aria-label="Eliminar ${escapeHTML(movement.concept)}"
              data-delete-movement="${escapeHTML(movement.id)}"
            >×</button>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderBuilder() {
  if (state.mode !== "custom") {
    return;
  }
  renderBanksEditor();
  renderCaptureBank();
  renderCaptureList();
  renderSavedScenarios();
}

function renderAccounts(accounts, movements = getFilteredMovements()) {
  const total = getAvailableBalance(accounts);

  if (accounts.length === 0) {
    els.accountsTableBody.innerHTML = `
      <tr class="empty-state">
        <td colspan="5">No hay bancos registrados.</td>
      </tr>
    `;
    return;
  }

  els.accountsTableBody.innerHTML = accounts
    .map((account) => {
      const share = total > 0 ? account.balance / total : 0;
      const transferNet = getAccountTransferNet(account.id, movements);
      const afterTransfers = account.balance + transferNet;
      return `
        <tr role="row">
          <td role="cell" data-label="Banco"><span class="account-name">${escapeHTML(account.name)}</span></td>
          <td role="cell" data-label="Saldo inicial" class="align-right amount">${detailCurrency.format(account.balance)}</td>
          <td role="cell" data-label="Participación" class="align-right account-share">${new Intl.NumberFormat("es-MX", {
            style: "percent",
            maximumFractionDigits: 1,
          }).format(share)}</td>
          <td role="cell" data-label="Traspasos netos" class="align-right amount">${detailCurrency.format(transferNet)}</td>
          <td role="cell" data-label="Saldo tras traspasos" class="align-right amount ${afterTransfers < 0 ? "amount-out" : ""}">${detailCurrency.format(afterTransfers)}</td>
        </tr>
      `;
    })
    .join("");
}

function renderKpis(accounts, filteredMovements, totals, forecastSeries) {
  const availableBalance = getAvailableBalance(accounts);
  const projectedBalance = forecastSeries.at(-1)?.balance ?? availableBalance;
  const delta = projectedBalance - availableBalance;

  els.availableBalance.textContent = currency.format(availableBalance);
  els.accountCountLabel.textContent = `${accounts.length} ${accounts.length === 1 ? "banco registrado" : "bancos registrados"}`;
  els.periodInflows.textContent = currency.format(totals.inflows);
  els.periodOutflows.textContent = currency.format(totals.outflows);
  els.projectedBalance.textContent = currency.format(projectedBalance);
  els.inflowCount.textContent = `${totals.inflowCount} ${totals.inflowCount === 1 ? "cobro considerado" : "cobros considerados"}`;
  els.outflowCount.textContent = `${totals.outflowCount} ${totals.outflowCount === 1 ? "pago considerado" : "pagos considerados"}`;
  els.projectedDelta.textContent = `${currency.format(delta)} frente al saldo actual`;

  const pendingIncluded = filteredMovements.filter((movement) => movement.status === "pending");
  const pendingNet = pendingIncluded.reduce(
    (sum, movement) => sum + getMovementCashImpact(movement),
    0,
  );

  els.pendingCount.textContent = state.includePending ? `${pendingIncluded.length} incluidos` : "No incluidos";
  els.pendingAmount.textContent = state.includePending
    ? `Efecto neto de ${currency.format(pendingNet)}`
    : "Activa el interruptor para simularlos";
}

function renderInsights(filteredMovements, forecastSeries) {
  const minimumPoint = forecastSeries.reduce((minimum, point) =>
    point.balance < minimum.balance ? point : minimum,
  );

  const outflows = filteredMovements.filter((movement) => movement.type === "outflow");
  const largestOutflow = outflows.reduce(
    (largest, movement) => (!largest || movement.amount > largest.amount ? movement : largest),
    null,
  );

  els.minimumBalance.textContent = currency.format(minimumPoint.balance);
  els.minimumBalanceDate.textContent =
    minimumPoint.day === 0 ? "Saldo al inicio del escenario" : `Estimado para el ${longDate.format(minimumPoint.date)}`;

  if (largestOutflow) {
    els.largestOutflow.textContent = currency.format(largestOutflow.amount);
    els.largestOutflowLabel.textContent = `${largestOutflow.concept} · ${longDate.format(parseISODate(largestOutflow.date))}`;
  } else {
    els.largestOutflow.textContent = "Sin pagos";
    els.largestOutflowLabel.textContent = "No hay salidas dentro del periodo";
  }
}

function renderMovements() {
  renderMovementFilterOptions();
  const filteredMovements = getVisibleMovements();
  renderPaymentGroups();
  els.movementFilterFeedback.textContent = getMovementFilterError();
  els.movementTableHint.textContent = "Haz doble clic en una fila o usa Editar. Los filtros afectan solo esta tabla; los indicadores mantienen la proyección actual. "
    + (state.mode === "demo" ? "Los cambios del ejemplo son temporales y se restablecen al recargar." : "Tus cambios se guardan solo en este navegador.");
  els.movementSummary.textContent = `${filteredMovements.length} de ${getActiveMovements().length} movimientos`;
  if (filteredMovements.length === 0) {
    els.movementsTableBody.innerHTML = `
      <tr class="empty-state">
        <td colspan="7">No hay movimientos con estos filtros. Prueba Todos los movimientos o limpia los filtros.</td>
      </tr>
    `;
    updateMovementSelection();
    return;
  }

  els.movementsTableBody.innerHTML = filteredMovements
    .map((movement) => {
      const isInflow = movement.type === "inflow";
      const isTransfer = movement.type === "transfer";
      const amountSign = isTransfer ? "↔ " : "";
      const statusLabel = movement.status === "confirmed" ? "Confirmado" : "Por confirmar";
      const statusClass = movement.status === "confirmed" ? "status-confirmed" : "status-pending";

      return `
        <tr role="row" data-movement-id="${escapeHTML(movement.id)}" title="Doble clic para editar movimiento">
          <td role="cell" class="movement-selection-cell"><input class="movement-checkbox" type="checkbox"
            data-select-movement="${escapeHTML(movement.id)}"
            aria-label="Seleccionar ${escapeHTML(movement.concept)} del ${escapeHTML(movement.date)}" /></td>
          <td role="cell" data-label="Fecha">${shortDate.format(parseISODate(movement.date))}</td>
          <td role="cell" data-label="Concepto" class="movement-concept-cell"><span class="movement-concept">${escapeHTML(movement.concept)}</span>${isInflow ? "" : `<small class="movement-bank">${escapeHTML(getMovementAccountLabel(movement))}</small>`}${movement.type === "outflow" ? `<small class="movement-category">${getMovementCategoryLabel(movement)}</small>` : ""}</td>
          <td role="cell" data-label="Tipo">${getMovementTypeLabel(movement)}</td>
          <td role="cell" data-label="Estatus"><span class="status ${statusClass}">${statusLabel}</span></td>
          <td role="cell" data-label="Importe" class="align-right amount ${isTransfer ? "amount-transfer" : isInflow ? "amount-in" : "amount-out"}">
            ${amountSign}${detailCurrency.format(isInflow || isTransfer ? movement.amount : -movement.amount)}
          </td>
          <td role="cell" data-label="Acciones" class="movement-row-actions"><button type="button" class="movement-edit-button"
            data-edit-movement="${escapeHTML(movement.id)}"
            aria-label="Editar ${escapeHTML(movement.concept)}">Editar</button>${state.mode === "custom" ? `<button type="button" class="movement-duplicate-button" data-duplicate-movement="${escapeHTML(movement.id)}" aria-label="Duplicar ${escapeHTML(movement.concept)}">Duplicar</button><button type="button" class="movement-delete-button" data-delete-movement="${escapeHTML(movement.id)}" aria-label="Eliminar ${escapeHTML(movement.concept)}">Eliminar</button>` : ""}</td>
        </tr>
      `;
    })
    .join("");

  updateMovementSelection();
}

function niceCeiling(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }

  const exponent = Math.floor(Math.log10(value));
  const magnitude = 10 ** exponent;
  const fraction = value / magnitude;
  let niceFraction;

  if (fraction <= 1) {
    niceFraction = 1;
  } else if (fraction <= 2) {
    niceFraction = 2;
  } else if (fraction <= 2.5) {
    niceFraction = 2.5;
  } else if (fraction <= 5) {
    niceFraction = 5;
  } else {
    niceFraction = 10;
  }

  return niceFraction * magnitude;
}

function nextNiceStep(step) {
  return niceCeiling(step * 1.0000001);
}

function roundTickValue(value, step) {
  const exponent = Math.floor(Math.log10(Math.abs(step) || 1));
  const precision = Math.max(0, Math.min(10, -exponent + 4));
  const rounded = Number(value.toFixed(precision));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function buildTickValues(yMin, yMax, step) {
  const intervalCount = Math.max(1, Math.round((yMax - yMin) / step));
  return Array.from({ length: intervalCount + 1 }, (_, index) =>
    roundTickValue(yMin + index * step, step),
  );
}

function shouldIncludeZero(rawMin, rawMax, rawRange) {
  if (state.chartScaleMode === "zero") {
    return true;
  }

  if (rawMin <= 0 || rawMax <= 0) {
    return true;
  }

  const maxAbsoluteBalance = Math.max(Math.abs(rawMin), Math.abs(rawMax));
  if (maxAbsoluteBalance <= 10000) {
    return true;
  }

  const distanceToZero = Math.min(Math.abs(rawMin), Math.abs(rawMax));
  return distanceToZero <= Math.max(rawRange * 0.25, 1000);
}

function getChartScale(series) {
  const balances = series.map((point) => point.balance).filter(Number.isFinite);
  const rawMin = Math.min(...balances);
  const rawMax = Math.max(...balances);
  const rawRange = rawMax - rawMin;
  const includeZero = shouldIncludeZero(rawMin, rawMax, rawRange);

  let paddedMin;
  let paddedMax;

  if (rawRange === 0) {
    const reference = Math.max(Math.abs(rawMin), 1);
    const halfSpan = Math.max(reference * 0.06, reference <= 10000 ? 500 : 1);
    paddedMin = rawMin - halfSpan;
    paddedMax = rawMax + halfSpan;
  } else {
    const padding = rawRange * 0.12;
    paddedMin = rawMin - padding;
    paddedMax = rawMax + padding;
  }

  if (includeZero) {
    paddedMin = Math.min(paddedMin, 0);
    paddedMax = Math.max(paddedMax, 0);
  }

  const maxAbsoluteBalance = Math.max(Math.abs(rawMin), Math.abs(rawMax));

  if (includeZero && maxAbsoluteBalance <= 10000) {
    const step = 5000;
    let yMin = Math.floor(paddedMin / step) * step;
    let yMax = Math.ceil(paddedMax / step) * step;

    if (rawMin >= 0) {
      yMin = 0;
      yMax = Math.max(10000, yMax);
    } else if (rawMax <= 0) {
      yMax = 0;
      yMin = Math.min(-10000, yMin);
    } else {
      if (yMin === 0) yMin = -step;
      if (yMax === 0) yMax = step;
    }

    const tickValues = buildTickValues(yMin, yMax, step);
    return { yMin, yMax, step, tickValues, includesZero: true };
  }

  const desiredIntervals = 4;
  let step = niceCeiling((paddedMax - paddedMin) / desiredIntervals);

  function calculateBounds(currentStep) {
    let yMin = Math.floor(paddedMin / currentStep) * currentStep;
    let yMax = Math.ceil(paddedMax / currentStep) * currentStep;

    if (includeZero && rawMin >= 0) {
      yMin = 0;
    }
    if (includeZero && rawMax <= 0) {
      yMax = 0;
    }
    if (yMin === yMax) {
      yMin -= currentStep;
      yMax += currentStep;
    }

    return {
      yMin: roundTickValue(yMin, currentStep),
      yMax: roundTickValue(yMax, currentStep),
    };
  }

  let { yMin, yMax } = calculateBounds(step);
  let tickValues = buildTickValues(yMin, yMax, step);

  for (let guard = 0; tickValues.length > 5 && guard < 12; guard += 1) {
    step = nextNiceStep(step);
    ({ yMin, yMax } = calculateBounds(step));
    tickValues = buildTickValues(yMin, yMax, step);
  }

  for (let guard = 0; tickValues.length < 4 && guard < 4; guard += 1) {
    if (includeZero && yMin === 0 && rawMin >= 0) {
      yMax += step;
    } else if (includeZero && yMax === 0 && rawMax <= 0) {
      yMin -= step;
    } else {
      const lowerSpace = rawMin - yMin;
      const upperSpace = yMax - rawMax;
      if (lowerSpace <= upperSpace) {
        yMin -= step;
      } else {
        yMax += step;
      }
    }
    yMin = roundTickValue(yMin, step);
    yMax = roundTickValue(yMax, step);
    tickValues = buildTickValues(yMin, yMax, step);
  }

  return { yMin, yMax, step, tickValues, includesZero: yMin <= 0 && yMax >= 0 };
}

function formatChartAxisValue(value) {
  const normalized = Math.abs(value) < 0.000001 ? 0 : value;

  if (Math.abs(normalized) >= 1000000) {
    const label = compactCurrency.format(Math.abs(normalized));
    return normalized < 0 ? `(${label})` : label;
  }
  return currency.format(normalized);
}

function updateChartScaleControls() {
  const automatic = state.chartScaleMode === "auto";
  els.chartScaleAuto.classList.toggle("is-active", automatic);
  els.chartScaleZero.classList.toggle("is-active", !automatic);
  els.chartScaleAuto.setAttribute("aria-pressed", String(automatic));
  els.chartScaleZero.setAttribute("aria-pressed", String(!automatic));
}

function setChartScaleMode(mode) {
  state.chartScaleMode = mode === "zero" ? "zero" : "auto";
  updateChartScaleControls();
  renderDashboard();
}

function renderChart(series, options = {}) {
  updateChartScaleControls();

  if (!options.hasData) {
    els.forecastChart.setAttribute(
      "aria-label",
      "La proyección todavía no contiene saldos ni movimientos.",
    );
    els.forecastChart.innerHTML = `
      <text class="chart-empty-title" x="500" y="148" text-anchor="middle">
        Agrega el saldo de al menos un banco
      </text>
      <text class="chart-empty-copy" x="500" y="180" text-anchor="middle">
        o registra un cobro o pago para generar la proyección.
      </text>
    `;
    return;
  }

  els.forecastChart.setAttribute(
    "aria-label",
    `Gráfica del saldo proyectado con escala ${
      state.chartScaleMode === "auto" ? "automática" : "desde cero"
    }`,
  );

  const width = 1000;
  const height = 340;
  const margin = { top: 24, right: 24, bottom: 48, left: 126 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const { yMin, yMax, tickValues } = getChartScale(series);

  const x = (day) => margin.left + (day / state.horizon) * plotWidth;
  const y = (balance) => margin.top + ((yMax - balance) / (yMax - yMin || 1)) * plotHeight;

  const linePath = series
    .map((point, index) => `${index === 0 ? "M" : "L"} ${x(point.day).toFixed(2)} ${y(point.balance).toFixed(2)}`)
    .join(" ");

  const areaBaselineValue = yMin <= 0 && yMax >= 0 ? 0 : yMin;
  const areaBaselineY = y(areaBaselineValue);
  const areaPath = `${linePath} L ${x(state.horizon)} ${areaBaselineY} L ${x(0)} ${areaBaselineY} Z`;

  const gridLines = tickValues
    .map((value) => {
      const yPosition = y(value);
      const zeroClass = value === 0 ? " chart-zero-line" : "";
      return `
        <line class="chart-grid-line${zeroClass}" x1="${margin.left}" y1="${yPosition}" x2="${width - margin.right}" y2="${yPosition}" />
        <text class="chart-axis-label" x="${margin.left - 12}" y="${yPosition + 4}" text-anchor="end">${formatChartAxisValue(value)}</text>
      `;
    })
    .join("");

  const preferredLabels = state.horizon === 7 ? 7 : state.horizon === 14 ? 7 : 6;
  const xTickStep = Math.max(1, Math.round(state.horizon / preferredLabels));
  const xLabels = series
    .filter((point) => point.day === 0 || point.day === state.horizon || point.day % xTickStep === 0)
    .map(
      (point) => `
        <text class="chart-axis-label" x="${x(point.day)}" y="${height - 16}" text-anchor="middle">
          ${point.day === 0 ? "Hoy" : shortDate.format(point.date)}
        </text>
      `,
    )
    .join("");

  const eventMarkers = series
    .filter((point) => point.movements.length > 0)
    .map((point) => {
      const hasInflow = point.movements.some((movement) => movement.type === "inflow");
      const hasOutflow = point.movements.some((movement) => movement.type === "outflow");
      const markers = [];

      if (hasInflow) {
        markers.push(`<circle class="chart-event-in" cx="${x(point.day)}" cy="${y(point.balance) - 13}" r="5" />`);
      }
      if (hasOutflow) {
        markers.push(`<circle class="chart-event-out" cx="${x(point.day)}" cy="${y(point.balance) + 13}" r="5" />`);
      }
      return markers.join("");
    })
    .join("");

  const points = series
    .filter((point) => point.day === 0 || point.day === state.horizon || point.movements.length > 0)
    .map((point) => `<circle class="chart-point" cx="${x(point.day)}" cy="${y(point.balance)}" r="5" />`)
    .join("");

  els.forecastChart.innerHTML = `
    <defs>
      <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#2463db" stop-opacity="0.20" />
        <stop offset="100%" stop-color="#2463db" stop-opacity="0.02" />
      </linearGradient>
    </defs>
    ${gridLines}
    <line class="chart-today-line" x1="${x(0)}" y1="${margin.top}" x2="${x(0)}" y2="${margin.top + plotHeight}" />
    <path class="chart-area" d="${areaPath}" />
    <path class="chart-line" d="${linePath}" />
    ${points}
    ${eventMarkers}
    ${xLabels}
  `;
}

function renderDashboard({ preserveMovementRows = false } = {}) {
  const accounts = getActiveAccounts();
  const filteredMovements = getFilteredMovements();
  const totals = getPeriodTotals(filteredMovements);
  const startingBalance = getAvailableBalance(accounts);
  const forecastSeries = getForecastSeries(filteredMovements, startingBalance);

  renderAccounts(accounts);
  renderKpis(accounts, filteredMovements, totals, forecastSeries);
  renderInsights(filteredMovements, forecastSeries);
  if (!preserveMovementRows) renderMovements();
  const hasChartData = startingBalance !== 0 || filteredMovements.length > 0;
  renderChart(forecastSeries, { hasData: hasChartData });
  if (state.mode === "custom") renderSavedScenarios();

  els.liveRegion.textContent = `Escenario actualizado a ${state.horizon} días, con movimientos por confirmar ${
    state.includePending ? "incluidos" : "excluidos"
  }.`;
}

function addMovement(event) {
  event.preventDefault();
  if (state.mode !== "custom") return;
  els.captureFeedback.textContent = "";

  const concept = els.movementConcept.value.trim();
  const amount = TreasuryAccounting.parseInput(els.movementAmount.value);
  const date = els.movementDate.value;
  const type = ["outflow", "transfer"].includes(els.movementType.value) ? els.movementType.value : "inflow";
  const bankId = type === "outflow" ? els.movementBank.value : "";
  const categoryId = type === "outflow" ? els.movementCategory.value : "";

  if (!concept || concept.length > 70 || !isValidISODate(date) || !isValidMovementAmount(amount)) {
    els.captureFeedback.textContent = "Completa una fecha válida, un concepto de hasta 70 caracteres y un importe mayor a cero con máximo dos decimales.";
    return;
  }

  if (differenceInDays(parseISODate(date), today) < 0) {
    els.captureFeedback.textContent = "La fecha del movimiento no puede ser anterior a hoy.";
    return;
  }

  if (bankId && state.custom.accounts.filter((account) => account.id === bankId).length !== 1) {
    els.captureFeedback.textContent = "Elige un banco disponible o Sin banco asignado.";
    return;
  }
  if (categoryId && !CATEGORY_OPTIONS.some((category) => category.id === categoryId)) {
    els.captureFeedback.textContent = "Elige una categoría disponible o Sin categoría.";
    return;
  }

  const movement = {
    id: createId("movement"),
    date,
    concept,
    type,
    status: els.movementStatus.value === "pending" ? "pending" : "confirmed",
    amount,
    ...(bankId ? { bankId } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(type === "transfer" ? { fromBankId: els.transferFromBank.value, toBankId: els.transferToBank.value } : {}),
  };
  try {
    if (type === "transfer") validateTransfer(movement, state.custom.accounts);
    persistCustomCandidate({ ...state.custom, movements: [...state.custom.movements, movement] });
  } catch (error) {
    els.captureFeedback.textContent = error.message;
    return;
  }
  els.captureFeedback.textContent = "Movimiento agregado a la proyección.";
  els.movementForm.reset();
  setMoneyInputError(els.movementAmount);
  els.movementDate.value = todayISO;
  els.movementType.value = "inflow";
  els.movementStatus.value = "confirmed";
  els.movementBank.value = "";
  els.movementCategory.value = "";
  els.transferFromBank.value = "";
  els.transferToBank.value = "";
  renderBuilder();
  renderDashboard();
  els.movementConcept.focus();
}

function deleteMovement(id) {
  if (state.mode !== "custom") throw new Error("Solo puedes eliminar movimientos de tu proyección.");
  const matches = state.custom.movements.filter((movement) => movement.id === id);
  if (matches.length !== 1) throw new Error("No se puede identificar este movimiento de forma única.");
  const index = state.custom.movements.findIndex((movement) => movement.id === id);
  const movement = { ...matches[0] };
  const originalRows = state.custom.movements;
  const token = createId("undo");
  // Share a canonical order across overlapping five-second undo windows.
  // Adjacent IDs alone are insufficient when removals happen in reverse order.
  const pending = [...state.undoDeletions.values()].find((entry) => entry.scenarioId === state.activeScenarioId);
  const orderSnapshot = pending?.orderSnapshot ?? originalRows.map((entry) => entry.id);
  if (!orderSnapshot.includes(id)) orderSnapshot.push(id);
  persistCustomCandidate({ ...state.custom, movements: originalRows.filter((entry) => entry.id !== id) });
  const entry = { movement, index, orderSnapshot,
    scenarioId: state.activeScenarioId, expiresAt: Date.now() + 5000 };
  state.undoDeletions.set(token, entry);
  entry.timer = setTimeout(() => expireUndoDeletion(token), 5000);
  state.selectedMovementIds.delete(id);
  renderBuilder();
  renderDashboard();
  renderUndoToasts();
  return token;
}

function renderUndoToasts() {
  const focusedToken = document.activeElement?.dataset?.undoDelete;
  els.undoToasts.innerHTML = [...state.undoDeletions.entries()]
    .filter(([, entry]) => state.mode === "custom" && (entry.scenarioId || "base") === state.activeScenarioId)
    .map(([token, entry]) => `<div class="undo-toast" role="status">
    <div class="undo-toast-copy"><strong>Movimiento eliminado</strong><span>${escapeHTML(entry.movement.concept)}</span><small>Puedes deshacer durante 5 segundos.</small></div>
    <button type="button" data-undo-delete="${escapeHTML(token)}" aria-label="Deshacer eliminación de ${escapeHTML(entry.movement.concept)}">Deshacer</button>
  </div>`).join("");
  if (focusedToken) {
    [...els.undoToasts.querySelectorAll("[data-undo-delete]")]
      .find((button) => button.dataset.undoDelete === focusedToken)?.focus();
  }
}

function expireUndoDeletion(token) {
  const entry = state.undoDeletions.get(token);
  if (!entry) return;
  clearTimeout(entry.timer);
  const wasFocused = document.activeElement?.dataset?.undoDelete === token;
  state.undoDeletions.delete(token);
  renderUndoToasts();
  if (wasFocused) els.movementSearch.focus();
}

function undoDeleteMovement(token, now = Date.now()) {
  const entry = state.undoDeletions.get(token);
  if (!entry) throw new Error("El plazo para deshacer esta eliminación terminó.");
  if (now >= entry.expiresAt) {
    expireUndoDeletion(token);
    throw new Error("El plazo de 5 segundos para deshacer terminó.");
  }
  if (state.mode !== "custom" || (entry.scenarioId || "base") !== state.activeScenarioId) throw new Error("Vuelve al escenario de esta eliminación para deshacerla dentro de su plazo.");
  if (state.custom.movements.some((movement) => movement.id === entry.movement.id)) {
    throw new Error("Ya existe un movimiento con ese identificador. No se restauró otro registro.");
  }
  if (entry.movement.type === "transfer") validateTransfer(entry.movement, state.custom.accounts);
  const movements = [...state.custom.movements];
  const order = entry.orderSnapshot ?? [];
  const restoredPosition = order.indexOf(entry.movement.id);
  let insertion = Math.min(entry.index, movements.length);
  if (restoredPosition >= 0) {
    const positions = new Map(movements.map((item, index) => [item.id, index]));
    const next = order.slice(restoredPosition + 1).find((id) => positions.has(id));
    const previous = [...order.slice(0, restoredPosition)].reverse().find((id) => positions.has(id));
    if (next !== undefined) insertion = positions.get(next);
    else if (previous !== undefined) insertion = positions.get(previous) + 1;
  }
  movements.splice(insertion, 0, entry.movement);
  persistCustomCandidate({ ...state.custom, movements });
  expireUndoDeletion(token);
  renderBuilder();
  renderDashboard();
  els.movementFeedback.textContent = "Movimiento restaurado.";
  return entry.movement;
}

function getExportRows(scope = "visible") {
  const movements = scope === "all" ? getActiveMovements()
    : scope === "selected" ? getVisibleMovements().filter((movement) => state.selectedMovementIds.has(movement.id))
      : getVisibleMovements();
  return [...movements].sort((a, b) => a.date.localeCompare(b.date)).map((movement) => ({
    id: movement.id, date: movement.date, concept: movement.concept,
    type: getMovementTypeLabel(movement), status: movement.status === "pending" ? "Por confirmar" : "Confirmado",
    amount: movement.amount,
    bank: movement.type === "outflow" && getMovementBankId(movement) ? getMovementBankLabel(movement) : "",
    category: movement.type === "outflow" ? getMovementCategoryLabel(movement) : "",
    fromBank: movement.type === "transfer" ? getBankLabel(movement.fromBankId) : "",
    toBank: movement.type === "transfer" ? getBankLabel(movement.toBankId) : "",
    bankId: movement.type === "outflow" ? getMovementBankId(movement) : "",
    fromBankId: movement.type === "transfer" ? movement.fromBankId : "",
    toBankId: movement.type === "transfer" ? movement.toBankId : "",
  }));
}

function exportMovementsToExcel() {
  els.exportFeedback.textContent = "";
  try {
    updateMovementSelection();
    const rows = getExportRows(els.exportScope.value || "visible");
    if (!rows.length) throw new Error("No hay movimientos en el alcance elegido para exportar.");
    const bytes = TreasuryExcel.buildWorkbook(rows);
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `movimientos-tesoreria-${todayISO}.xlsx`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    els.exportFeedback.textContent = `${rows.length} movimientos exportados a Excel.`;
  } catch (error) {
    els.exportFeedback.textContent = error.message || "No se pudo exportar el archivo.";
  }
}

function resetCustomProjection() {
  const confirmed = window.confirm(`¿Quieres vaciar los bancos, saldos y movimientos de ${getScenarioName()}?${state.savedScenarios.length ? " Los demás escenarios se conservarán." : ""}`);
  if (!confirmed) {
    return;
  }

  const resetState = createDefaultCustomState();
  if (state.savedScenarios.length || state.scenarioStorageBlocked) {
    try {
      persistCustomCandidate(resetState);
      clearScenarioUndo(state.activeScenarioId);
      resetScenarioContext();
      renderBuilder();
      renderDashboard();
      els.captureFeedback.textContent = `${getScenarioName()} volvió a cero. Los demás escenarios se conservaron.`;
    } catch (error) { els.captureFeedback.textContent = error.message; }
    return;
  }
  try {
    if (localStorage.getItem(STORAGE_KEY) !== lastPersistedSnapshot) {
      throw new Error("Otra pestaña modificó la proyección. Recarga antes de restablecerla.");
    }
    localStorage.removeItem(STORAGE_KEY);
    lastPersistedSnapshot = null;
  } catch (error) {
    if (error.message?.includes("Otra pestaña")) {
      els.captureFeedback.textContent = error.message;
      return;
    }
    els.captureFeedback.textContent = "No se pudo restablecer la proyección en este navegador. Tus datos no se modificaron. Revisa los permisos de almacenamiento e intenta de nuevo.";
    return;
  }
  state.custom = resetState;
  state.scenarioBase = resetState;
  state.selectedMovementIds.clear();
  [...state.undoDeletions.keys()].forEach(expireUndoDeletion);
  els.captureFeedback.textContent = "La proyección volvió a cero.";
  renderBuilder();
  renderDashboard();
}

const IMPORT_FIELDS = [
  ["date", "Fecha *"], ["concept", "Concepto *"], ["amount", "Importe *"],
  ["type", "Tipo"], ["status", "Estatus"], ["bank", "Banco del pago"],
  ["category", "Categoría del pago"], ["fromBank", "Cuenta de origen"],
  ["toBank", "Cuenta de destino"], ["sourceId", "ID del origen (opcional)"],
];

function openImportDialog() {
  try {
    requirePersonalScenario();
    if (state.scenarioStorageBlocked) throw new Error(state.scenarioLoadError);
    cancelImportDraft();
    state.importDraft = {
      scenarioId: state.activeScenarioId, fingerprint: JSON.stringify(state.custom),
      sourceDocument: null, sheetIndex: 0, mapping: {}, report: null,
      selectedRows: new Set(), reviewPage: 0, step: "source", busy: false,
      abortController: new AbortController(), opener: document.activeElement,
    };
    els.importTargetScenario.textContent = getScenarioName();
    els.importSource.value = "file";
    els.importFile.value = "";
    els.importPaste.value = "";
    els.importFileInfo.textContent = "";
    els.importHeaderRow.value = "1";
    els.importDateOrder.value = "DMY";
    els.importNumberFormat.value = "es-MX";
    els.importDefaultType.value = "outflow";
    els.importDefaultStatus.value = "confirmed";
    els.importAllowPast.checked = false;
    els.importReviewFilter.value = "all";
    els.importError.textContent = "";
    els.importMappingError.textContent = "";
    syncImportSource();
    renderImportStep();
    els.movementImportDialog.showModal();
    els.importSource.focus();
  } catch (error) {
    els.captureFeedback.textContent = error.message;
  }
}

function cancelImportDraft() {
  const draft = state.importDraft;
  state.importDraft = null;
  draft?.abortController.abort();
  if (els.movementImportDialog.open) els.movementImportDialog.close();
  if (draft?.opener?.isConnected) draft.opener.focus();
}

function assertImportContext(draft) {
  if (state.importDraft !== draft || state.mode !== "custom" || state.activeScenarioId !== draft.scenarioId
    || JSON.stringify(state.custom) !== draft.fingerprint) {
    throw new Error("Los datos o el escenario cambiaron. Cancela y vuelve a revisar la importación en el destino elegido.");
  }
}

function syncImportSource() {
  const isPaste = els.importSource.value === "paste";
  els.importPastePanel.hidden = !isPaste;
  els.importFilePanel.hidden = isPaste;
  els.importError.textContent = "";
}

function renderImportStep() {
  const draft = state.importDraft;
  if (!draft) return;
  els.importSourceStep.hidden = draft.step !== "source";
  els.importMappingStep.hidden = draft.step !== "mapping";
  els.importReviewStep.hidden = draft.step !== "review";
  els.importSteps.querySelectorAll("[data-import-step]").forEach((item) => {
    if (item.dataset.importStep === draft.step) item.setAttribute("aria-current", "step");
    else item.removeAttribute("aria-current");
  });
  els.backImport.hidden = draft.step === "source";
  els.backImport.disabled = draft.busy;
  els.nextImport.hidden = draft.step === "review";
  els.nextImport.disabled = draft.busy;
  els.nextImport.textContent = draft.busy ? "Leyendo…" : draft.step === "mapping" ? "Revisar movimientos" : "Continuar";
  els.confirmImport.hidden = draft.step !== "review";
  els.confirmImport.disabled = draft.busy || draft.selectedRows.size === 0;
  els.confirmImport.textContent = `Importar ${draft.selectedRows.size} movimiento${draft.selectedRows.size === 1 ? "" : "s"} seleccionado${draft.selectedRows.size === 1 ? "" : "s"}`;
  [els.importSource, els.importFile, els.importPaste].forEach((control) => { control.disabled = draft.busy; });
  els.movementImportDialog.setAttribute("aria-busy", String(draft.busy));
}

function importCellText(cell) {
  if (cell && typeof cell === "object" && cell.error) return String(cell.error);
  const value = cell && typeof cell === "object" ? cell.dateISO || cell.value : cell;
  return value == null ? "" : String(value);
}

function getImportSheet() {
  return state.importDraft?.sourceDocument?.sheets[state.importDraft.sheetIndex];
}

function readImportHeaderRow(sheet) {
  const headerRow = Number(els.importHeaderRow.value);
  if (els.importHeaderRow.value === "" || !Number.isInteger(headerRow) || headerRow < 0 || headerRow >= sheet.rows.length) {
    throw new Error("Elige una fila de encabezados con datos debajo, o usa 0 si no hay encabezados.");
  }
  return headerRow;
}

function renderImportMapping(reset = false) {
  const draft = state.importDraft;
  const sheet = getImportSheet();
  if (!draft || !sheet) return;
  try {
    els.importMappingError.textContent = "";
    const headerRow = readImportHeaderRow(sheet);
    const width = Math.max(0, ...sheet.rows.map((row) => row.length));
    if (reset) draft.mapping = TreasuryImport.suggestMapping(sheet, { headerRow });
    const headers = headerRow ? sheet.rows[headerRow - 1] : [];
    const columns = Array.from({ length: width }, (_, index) => ({
      index, label: `${index + 1} · ${importCellText(headers[index]).slice(0, 70) || "Sin encabezado"}`,
    }));
    els.importMapping.innerHTML = IMPORT_FIELDS.map(([key, label]) => `<div class="field-group">
      <label for="importMap-${key}">${label}</label>
      <select id="importMap-${key}" data-import-map="${key}">
        <option value="">${["type", "status"].includes(key) ? "Usar predeterminado" : ["date", "concept", "amount"].includes(key) ? "Elige una columna" : "Sin columna"}</option>
        ${columns.map((column) => `<option value="${column.index}" ${draft.mapping[key] === column.index ? "selected" : ""}>${escapeHTML(column.label)}</option>`).join("")}
      </select></div>`).join("");
    const previewStart = Math.max(0, headerRow - 1);
    const previewRows = sheet.rows.slice(previewStart, previewStart + 6);
    els.importSourcePreview.innerHTML = `<table><caption>Primeras ${previewRows.length} filas desde ${headerRow ? "el encabezado" : "el inicio"}</caption>
      <thead><tr><th scope="col">Fila</th>${columns.map((column) => `<th scope="col">Col. ${column.index + 1}</th>`).join("")}</tr></thead>
      <tbody>${previewRows.map((row, index) => `<tr><th scope="row">${previewStart + index + 1}</th>${columns.map((column) => `<td>${escapeHTML(importCellText(row[column.index]).slice(0, 180))}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  } catch (error) {
    els.importMappingError.textContent = error.message;
  }
}

async function nextImportStep() {
  const draft = state.importDraft;
  if (!draft || draft.busy) return;
  els.importError.textContent = "";
  try {
    assertImportContext(draft);
    if (draft.step === "source") {
      if (typeof TreasuryImport === "undefined") throw new Error("No se pudo cargar el importador. Recarga la página e intenta de nuevo.");
      draft.busy = true;
      renderImportStep();
      let documentData;
      if (els.importSource.value === "paste") {
        documentData = TreasuryImport.parseText(els.importPaste.value, { delimiter: "auto" });
      } else {
        const file = els.importFile.files?.[0];
        if (!file) throw new Error("Selecciona un archivo o cambia el origen a Pegar tabla.");
        if (file.size > TreasuryImport.limits.fileBytes) throw new Error("El archivo supera el límite de 10 MiB. Divide la tabla e importa cada parte.");
        const extension = file.name.split(".").pop().toLowerCase();
        if (!["xlsx", "csv", "tsv"].includes(extension)) throw new Error("Elige un archivo .xlsx, .csv o .tsv.");
        els.importFileInfo.textContent = `Leyendo ${file.name}…`;
        const bytes = await file.arrayBuffer();
        if (state.importDraft !== draft) return;
        if (extension === "xlsx") documentData = await TreasuryImport.readXlsx(bytes, { signal: draft.abortController.signal });
        else {
          let source;
          try { source = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
          catch (_) { throw new Error("Guarda el CSV o TSV con codificación UTF-8, o pega sus celdas directamente."); }
          documentData = TreasuryImport.parseText(source, { delimiter: extension === "tsv" ? "\t" : "auto" });
        }
      }
      if (state.importDraft !== draft) return;
      assertImportContext(draft);
      if (!documentData?.sheets?.length) throw new Error("El origen no contiene hojas con datos.");
      draft.sourceDocument = documentData;
      draft.sheetIndex = 0;
      draft.report = null;
      draft.selectedRows.clear();
      els.importSheet.innerHTML = documentData.sheets.map((sheet, index) => `<option value="${index}">${escapeHTML(sheet.name)}</option>`).join("");
      els.importSheet.value = "0";
      els.importSheetField.hidden = documentData.sheets.length === 1;
      draft.step = "mapping";
      renderImportMapping(true);
      els.importHeaderRow.focus();
    } else if (draft.step === "mapping") {
      const sheet = getImportSheet();
      const headerRow = readImportHeaderRow(sheet);
      const report = TreasuryImport.preview(sheet, {
        headerRow, mapping: draft.mapping, dateOrder: els.importDateOrder.value,
        numberFormat: els.importNumberFormat.value,
        defaults: { type: els.importDefaultType.value, status: els.importDefaultStatus.value },
      }, {
        accounts: state.custom.accounts, categories: CATEGORY_OPTIONS, existingMovements: state.custom.movements,
        todayISO, minDate: els.importAllowPast.checked ? null : todayISO,
      });
      if (!report.rows.length) throw new Error("No se encontraron movimientos debajo de los encabezados.");
      draft.report = report;
      draft.allowPast = els.importAllowPast.checked;
      draft.selectedRows = new Set(report.rows.filter((row) => row.movement && !row.errors.length && !row.duplicates.length).map((row) => row.rowNumber));
      draft.reviewPage = 0;
      els.importReviewFilter.value = "all";
      draft.step = "review";
      renderImportReview();
      els.importReviewFilter.focus();
    }
  } catch (error) {
    if (state.importDraft === draft) {
      els.importError.textContent = error.message;
      els.importError.focus();
    }
  } finally {
    if (state.importDraft === draft) {
      draft.busy = false;
      renderImportStep();
    }
  }
}

function renderImportReview() {
  const draft = state.importDraft;
  if (!draft?.report) return;
  const { rows, summary } = draft.report;
  const filter = els.importReviewFilter.value;
  const visible = rows.filter((row) => filter === "all" || (filter === "valid" && !row.errors.length)
    || (filter === "error" && row.errors.length) || (filter === "duplicate" && row.duplicates.length));
  const pages = Math.max(1, Math.ceil(visible.length / 50));
  draft.reviewPage = Math.max(0, Math.min(pages - 1, draft.reviewPage));
  const pageRows = visible.slice(draft.reviewPage * 50, (draft.reviewPage + 1) * 50);
  els.importReviewSummary.innerHTML = `<span><strong>${summary.valid}</strong> válidas</span><span><strong>${summary.invalid}</strong> con errores</span><span><strong>${summary.possibleDuplicates}</strong> posibles duplicados</span><span><strong>${draft.selectedRows.size}</strong> seleccionadas</span>`;
  const packageWarnings = (draft.sourceDocument.warnings || []).map((warning) => typeof warning === "string" ? warning : warning.message).filter(Boolean);
  els.importReviewHelp.textContent = `Las filas con errores no se pueden seleccionar. Los posibles duplicados empiezan desmarcados; puedes seleccionarlos si son movimientos distintos.${draft.allowPast ? " Los históricos se consultan en Todos los movimientos y no afectan la proyección desde hoy." : ""}${packageWarnings.length ? ` Avisos del archivo: ${packageWarnings.join(" ")}` : ""}`;
  els.importReviewBody.innerHTML = pageRows.length ? pageRows.map((row) => {
    const movement = row.movement;
    const sourceRow = getImportSheet()?.rows[row.rowNumber - 1];
    const sourceConcept = importCellText(sourceRow?.[draft.mapping.concept]).trim().slice(0, 70);
    const invalid = row.errors.length > 0 || !movement;
    const selected = draft.selectedRows.has(row.rowNumber);
    const messages = [...row.errors.map((issue) => issue.message), ...row.warnings.map((issue) => issue.message)];
    if (row.duplicates.length) messages.push(`Posible duplicado: ${row.duplicates.map((duplicate) => duplicate.source === "import" ? `fila ${duplicate.rowNumber} de esta importación` : "movimiento ya guardado").filter((value, index, values) => values.indexOf(value) === index).join(", ")}.`);
    const notes = movement ? `${getMovementTypeLabel(movement)} · ${movement.status === "confirmed" ? "Confirmado" : "Por confirmar"}${movement.type === "outflow" ? ` · ${getMovementBankLabel(movement)} · ${getMovementCategoryLabel(movement)}` : movement.type === "transfer" ? ` · ${getMovementAccountLabel(movement)}` : ""}` : "Corrige esta fila en el origen y vuelve a cargarla.";
    return `<tr role="row" class="${selected ? "is-selected" : ""}">
      <td role="cell"><input type="checkbox" class="movement-checkbox" data-import-row="${row.rowNumber}" aria-label="Seleccionar fila ${row.rowNumber}" ${selected ? "checked" : ""} ${invalid ? "disabled" : ""}></td>
      <td role="cell">${row.rowNumber}</td><td role="cell"><strong>${escapeHTML(movement?.concept || sourceConcept || "Fila con errores")}</strong><small>${escapeHTML(notes)}</small></td>
      <td role="cell">${movement ? escapeHTML(movement.date) : "—"}</td><td role="cell" class="align-right">${movement ? detailCurrency.format(movement.amount) : "—"}</td>
      <td role="cell">${invalid ? "Con errores" : row.duplicates.length ? "Posible duplicado" : "Lista para importar"}${messages.map((message) => `<small>${escapeHTML(message)}</small>`).join("")}</td>
    </tr>`;
  }).join("") : '<tr><td colspan="6">No hay filas con este filtro.</td></tr>';
  els.importReviewPrev.disabled = draft.reviewPage === 0;
  els.importReviewNext.disabled = draft.reviewPage >= pages - 1;
  els.importReviewPageLabel.textContent = `Página ${draft.reviewPage + 1} de ${pages} · ${visible.length} filas`;
  renderImportStep();
}

function confirmImportMovements() {
  const draft = state.importDraft;
  if (!draft || draft.step !== "review" || draft.busy) return;
  els.importError.textContent = "";
  try {
    assertImportContext(draft);
    draft.busy = true;
    renderImportStep();
    const added = commitImportedMovements(draft.report, [...draft.selectedRows], draft.scenarioId, draft.allowPast);
    const historical = added.filter((movement) => movement.date < todayISO).length;
    const destination = getScenarioName();
    cancelImportDraft();
    state.selectedMovementIds.clear();
    renderBuilder();
    renderDashboard();
    const message = `Se ${added.length === 1 ? "importó" : "importaron"} ${added.length} movimiento${added.length === 1 ? "" : "s"} en ${destination}.${historical ? ` ${historical} histórico${historical === 1 ? "" : "s"}; puedes consultarlos en Todos los movimientos.` : ""}`;
    els.captureFeedback.textContent = message;
    els.movementFeedback.textContent = message;
    els.openImportButton.focus();
  } catch (error) {
    els.importError.textContent = error.message;
    els.importError.focus();
  } finally {
    if (state.importDraft === draft) { draft.busy = false; renderImportStep(); }
  }
}

function bindImportEvents() {
  els.openImportButton.addEventListener("click", openImportDialog);
  els.cancelImport.addEventListener("click", cancelImportDraft);
  els.movementImportDialog.addEventListener("close", cancelImportDraft);
  els.movementImportDialog.addEventListener("cancel", cancelImportDraft);
  els.importSource.addEventListener("change", syncImportSource);
  els.importFile.addEventListener("change", () => {
    const file = els.importFile.files?.[0];
    els.importFileInfo.textContent = file ? `${file.name} · ${(file.size / 1024).toFixed(1)} KiB` : "";
    els.importError.textContent = "";
  });
  els.nextImport.addEventListener("click", nextImportStep);
  els.backImport.addEventListener("click", () => {
    const draft = state.importDraft;
    if (!draft || draft.busy) return;
    draft.step = draft.step === "review" ? "mapping" : "source";
    els.importError.textContent = "";
    renderImportStep();
    (draft.step === "source" ? els.importSource : els.importHeaderRow).focus();
  });
  els.importSheet.addEventListener("change", () => {
    const draft = state.importDraft;
    if (!draft) return;
    draft.sheetIndex = Number(els.importSheet.value);
    els.importHeaderRow.value = "1";
    renderImportMapping(true);
  });
  els.importHeaderRow.addEventListener("change", () => renderImportMapping(true));
  els.importMapping.addEventListener("change", (event) => {
    const select = event.target.closest("[data-import-map]");
    if (select && state.importDraft) state.importDraft.mapping[select.dataset.importMap] = select.value === "" ? null : Number(select.value);
  });
  els.importReviewFilter.addEventListener("change", () => {
    if (state.importDraft) state.importDraft.reviewPage = 0;
    renderImportReview();
  });
  els.importReviewBody.addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-import-row]");
    const draft = state.importDraft;
    if (!checkbox || !draft?.report) return;
    const number = Number(checkbox.dataset.importRow);
    const row = draft.report.rows.find((item) => item.rowNumber === number);
    if (!row || row.errors.length || !row.movement) return;
    if (checkbox.checked) draft.selectedRows.add(number);
    else draft.selectedRows.delete(number);
    renderImportReview();
    els.importReviewBody.querySelector(`[data-import-row="${number}"]`)?.focus();
  });
  els.importSelectValid.addEventListener("click", () => {
    const draft = state.importDraft;
    if (!draft?.report) return;
    draft.selectedRows = new Set(draft.report.rows.filter((row) => row.movement && !row.errors.length && !row.duplicates.length).map((row) => row.rowNumber));
    renderImportReview();
  });
  els.importClearSelection.addEventListener("click", () => { state.importDraft?.selectedRows.clear(); renderImportReview(); });
  [[els.importReviewPrev, -1], [els.importReviewNext, 1]].forEach(([button, delta]) => button.addEventListener("click", () => {
    if (state.importDraft) state.importDraft.reviewPage += delta;
    renderImportReview();
  }));
  els.confirmImport.addEventListener("click", confirmImportMovements);
}

function renderSavedScenarios() {
  els.savedScenariosPanel.hidden = state.mode !== "custom";
  if (state.mode !== "custom") return;
  els.dashboardKicker.textContent = `TU ESCENARIO · ${getScenarioName()}`;
  els.resetProjection.textContent = "Vaciar escenario";

  const scenarios = [{ id: "base", name: "Base personal" }, ...state.savedScenarios];
  const isBase = state.activeScenarioId === "base";
  const blocked = state.scenarioStorageBlocked;
  const atCapacity = state.savedScenarios.length >= 10;
  els.scenarioSelect.innerHTML = scenarios.map((scenario) =>
    `<option value="${escapeHTML(scenario.id)}"${scenario.id === state.activeScenarioId ? " selected" : ""}>${escapeHTML(scenario.name)}</option>`).join("");
  els.scenarioSelect.value = state.activeScenarioId;
  els.scenarioSelect.disabled = blocked;
  els.createScenarioButton.disabled = blocked || atCapacity;
  els.duplicateScenarioButton.disabled = blocked || atCapacity;
  els.renameScenarioButton.disabled = blocked || isBase;
  els.deleteScenarioButton.disabled = blocked || isBase;
  els.applyScenarioButton.disabled = blocked || isBase;
  els.returnToBaseButton.disabled = blocked || isBase;
  const capacityMessage = "Ya hay 10 escenarios guardados. Elimina uno para crear otro.";
  els.createScenarioButton.title = atCapacity ? capacityMessage : "";
  els.duplicateScenarioButton.title = atCapacity ? capacityMessage : "";
  els.applyScenarioButton.title = atCapacity ? "Libera un lugar para guardar la copia automática de Base." : "";
  if (blocked) els.scenarioFeedback.textContent = state.scenarioLoadError;

  const metrics = scenarios.map((scenario) => ({ ...scenario, metrics: getScenarioMetrics(getScenarioProjection(scenario.id)) }));
  const base = metrics[0].metrics;
  const dateFormatter = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" });
  const dateLabel = (value) => dateFormatter.format(parseISODate(value));
  const deltaLabel = (value) => {
    const rounded = Math.round(value * 100) / 100;
    return rounded === 0 ? `${detailCurrency.format(0)} · sin cambio frente a Base`
      : `${detailCurrency.format(rounded)} frente a Base`;
  };
  els.scenarioComparisonHelp.textContent = `Del ${dateLabel(todayISO)} al ${dateLabel(toISODate(addDays(today, state.horizon)))}. `
    + `Movimientos por confirmar ${state.includePending ? "incluidos" : "excluidos"} en todos los escenarios. Los filtros de movimientos no cambian esta comparación.`;
  els.scenarioComparisonBody.innerHTML = metrics.map(({ id, name, metrics: item }) => {
    const active = id === state.activeScenarioId;
    const shortfall = item.firstShortfallDate ? dateLabel(item.firstShortfallDate) : "Sin faltante en el período";
    const baseShortfall = base.firstShortfallDate ? dateLabel(base.firstShortfallDate) : "sin faltante en el período";
    return `<tr role="row"${active ? ' class="is-active" aria-current="true"' : ""}>
      <td role="cell" data-label="Escenario"><strong>${escapeHTML(name)}</strong>${active ? '<small>Escenario activo</small>' : ""}<small>Saldo inicial: ${detailCurrency.format(item.initialBalance)}</small></td>
      <td role="cell" data-label="Saldo mínimo y fecha"><strong>${detailCurrency.format(item.minimumBalance)}</strong><small>${escapeHTML(dateLabel(item.minimumDate))}</small><span class="scenario-delta">${escapeHTML(deltaLabel(item.minimumBalance - base.minimumBalance))}</span></td>
      <td role="cell" data-label="Saldo final"><strong>${detailCurrency.format(item.finalBalance)}</strong><span class="scenario-delta">${escapeHTML(deltaLabel(item.finalBalance - base.finalBalance))}</span></td>
      <td role="cell" data-label="Primer faltante"><strong>${escapeHTML(shortfall)}</strong>${id === "base" ? "" : `<small>${item.firstShortfallDate === base.firstShortfallDate ? "Igual que Base" : `Base: ${escapeHTML(baseShortfall)}`}</small>`}</td>
    </tr>`;
  }).join("");
}

function getScenarioUIFingerprints() {
  return {
    active: JSON.stringify(state.custom),
    base: JSON.stringify(getBaseProjection()),
    collection: JSON.stringify(state.savedScenarios),
  };
}

function captureScenarioUIAction(kind) {
  requirePersonalScenario();
  if (state.scenarioStorageBlocked) throw new Error(state.scenarioLoadError);
  return { kind, id: state.activeScenarioId, expectedActiveId: state.activeScenarioId,
    fingerprints: getScenarioUIFingerprints(), opener: document.activeElement };
}

function assertScenarioUIContext(kinds) {
  requirePersonalScenario();
  const action = state.scenarioAction;
  if (!action || !kinds.includes(action.kind)) throw new Error("Abre otra vez la acción del escenario.");
  const current = getScenarioUIFingerprints();
  if (state.activeScenarioId !== action.expectedActiveId
    || Object.keys(current).some((key) => current[key] !== action.fingerprints[key])) {
    throw new Error("Los datos o el escenario cambiaron. Cierra este diálogo y vuelve a revisarlo antes de guardar.");
  }
  if (state.scenarioStorageBlocked) throw new Error(state.scenarioLoadError);
  getScenarioProjection(action.id);
  return action;
}

function confirmScenarioCaptureDiscard() {
  return !(els.movementConcept.value.trim() || els.movementAmount.value)
    || window.confirm("Hay una captura sin guardar. ¿Quieres descartarla y continuar con esta acción del escenario?");
}

function suggestScenarioCopyName(id) {
  const name = getScenarioName(id);
  let counter = 1;
  let candidate;
  do {
    const suffix = counter === 1 ? " · copia" : ` · copia ${counter}`;
    candidate = `${name.slice(0, 60 - suffix.length).trimEnd()}${suffix}`;
    counter += 1;
  } while (state.savedScenarios.some((scenario) => scenario.name.toLocaleLowerCase("es") === candidate.toLocaleLowerCase("es")));
  return candidate;
}

function closeScenarioUIDialog(dialog, restoreFocus = true) {
  const action = state.scenarioAction;
  state.scenarioAction = null;
  if (dialog.open) dialog.close();
  if (restoreFocus && state.mode === "custom") {
    const target = action?.opener?.isConnected && !action.opener.disabled ? action.opener : els.scenarioSelect;
    target.focus();
  }
}

function openScenarioName(kind) {
  try {
    if (!["create", "duplicate", "rename"].includes(kind)) throw new Error("Elige una acción de escenario válida.");
    const action = captureScenarioUIAction(kind);
    if (kind === "rename" && action.id === "base") throw new Error("Base personal conserva su nombre.");
    if (kind !== "rename" && state.savedScenarios.length >= 10) throw new Error("Puedes guardar hasta 10 escenarios. Elimina uno antes de crear otro.");
    state.scenarioAction = action;
    els.scenarioNameForm.reset();
    els.scenarioNameTitle.textContent = kind === "rename" ? "Renombrar escenario" : kind === "duplicate" ? "Duplicar escenario" : "Crear escenario";
    els.saveScenarioName.textContent = kind === "rename" ? "Guardar nombre" : kind === "duplicate" ? "Crear copia" : "Crear escenario";
    els.scenarioNameInput.value = kind === "rename" ? getScenarioName(action.id) : kind === "duplicate" ? suggestScenarioCopyName(action.id) : "";
    els.scenarioNameInput.removeAttribute("aria-invalid");
    els.scenarioSourceField.hidden = kind !== "create";
    els.scenarioSource.disabled = kind !== "create";
    els.scenarioSource.value = "base";
    els.scenarioSource.querySelector('option[value="current"]').textContent = `Desde el escenario actual: ${getScenarioName(action.id)}`;
    els.scenarioNameError.textContent = "";
    els.saveScenarioName.disabled = false;
    els.scenarioNameDialog.showModal();
    els.scenarioNameInput.focus();
    els.scenarioNameInput.select();
  } catch (error) {
    els.scenarioFeedback.textContent = error.message;
  }
}

function submitScenarioName(event) {
  event.preventDefault();
  try {
    const action = assertScenarioUIContext(["create", "duplicate", "rename"]);
    const name = validateScenarioName(els.scenarioNameInput.value, action.kind === "rename" ? action.id : "");
    if (action.kind === "create" && !["base", "current"].includes(els.scenarioSource.value)) throw new Error("Elige de qué escenario se creará la copia.");
    if (action.kind !== "rename" && state.savedScenarios.length >= 10) throw new Error("Puedes guardar hasta 10 escenarios. Elimina uno antes de crear otro.");
    if (action.kind !== "rename" && !confirmScenarioCaptureDiscard()) return;
    // A confirmation may yield control to the browser: check the captured context again.
    assertScenarioUIContext([action.kind]);
    els.saveScenarioName.disabled = true;
    if (action.kind === "rename") renameSavedScenario(action.id, name);
    else createSavedScenario(name, action.kind === "duplicate" || els.scenarioSource.value === "current" ? action.id : "base");
    closeScenarioUIDialog(els.scenarioNameDialog, false);
    renderBuilder();
    renderDashboard();
    els.scenarioFeedback.textContent = action.kind === "rename" ? `Escenario renombrado: ${name}.` : `Escenario creado y activo: ${name}.`;
    els.scenarioSelect.focus();
  } catch (error) {
    els.scenarioNameError.textContent = error.message;
    els.saveScenarioName.disabled = false;
  }
}

function openScenarioDelete() {
  try {
    const action = captureScenarioUIAction("delete");
    if (action.id === "base") throw new Error("Base personal no se puede eliminar.");
    const projection = getScenarioProjection(action.id);
    state.scenarioAction = action;
    els.scenarioDeleteTitle.textContent = `Eliminar ${getScenarioName(action.id)}`;
    els.scenarioDeleteDescription.textContent = "Se eliminarán los bancos y movimientos de este escenario y volverás a Base personal. Esta eliminación no se puede deshacer.";
    els.scenarioDeleteImpact.innerHTML = `<dl>
      <div><dt>Bancos del escenario</dt><dd>${projection.accounts.length}</dd></div>
      <div><dt>Movimientos del escenario</dt><dd>${projection.movements.length}</dd></div>
      <div><dt>Saldo inicial</dt><dd>${detailCurrency.format(getAvailableBalance(projection.accounts))}</dd></div>
      </dl><p>Base personal y los demás escenarios se conservarán.</p>`;
    els.scenarioDeleteError.textContent = "";
    els.confirmScenarioDelete.disabled = false;
    els.scenarioDeleteDialog.showModal();
    els.cancelScenarioDelete.focus();
  } catch (error) {
    els.scenarioFeedback.textContent = error.message;
  }
}

function submitScenarioDelete() {
  try {
    const action = assertScenarioUIContext(["delete"]);
    const name = getScenarioName(action.id);
    if (!confirmScenarioCaptureDiscard()) return;
    assertScenarioUIContext(["delete"]);
    els.confirmScenarioDelete.disabled = true;
    deleteSavedScenario(action.id);
    closeScenarioUIDialog(els.scenarioDeleteDialog, false);
    renderBuilder();
    renderDashboard();
    els.scenarioFeedback.textContent = `Escenario eliminado: ${name}. Base personal está activa.`;
    els.scenarioSelect.focus();
  } catch (error) {
    els.scenarioDeleteError.textContent = error.message;
    els.confirmScenarioDelete.disabled = false;
  }
}

function openScenarioApply() {
  try {
    const action = captureScenarioUIAction("apply");
    if (action.id === "base") throw new Error("Elige una simulación para usarla como Base.");
    const source = getScenarioProjection(action.id);
    const base = getScenarioProjection("base");
    state.scenarioAction = action;
    els.scenarioApplyTitle.textContent = "Usar este escenario como Base";
    els.scenarioApplyDescription.textContent = `Los bancos y movimientos de «${getScenarioName(action.id)}» reemplazarán a los de Base personal. Antes se guardará automáticamente una copia de la Base actual.`;
    els.scenarioApplyImpact.innerHTML = `<dl>
      <div><dt>Base que se respaldará</dt><dd>${base.accounts.length} bancos · ${base.movements.length} movimientos</dd></div>
      <div><dt>Contenido de la nueva Base</dt><dd>${source.accounts.length} bancos · ${source.movements.length} movimientos</dd></div>
      <div><dt>Saldo inicial de la nueva Base</dt><dd>${detailCurrency.format(getAvailableBalance(source.accounts))}</dd></div>
      </dl><p>El escenario original se conservará y Base personal quedará activa.</p><p>La copia automática ocupa un lugar de escenario y se guarda en este navegador.</p>`;
    els.scenarioApplyError.textContent = state.savedScenarios.length >= 10 ? "Libera un lugar de escenario para conservar una copia de la Base anterior." : "";
    els.confirmScenarioApply.disabled = state.savedScenarios.length >= 10;
    els.scenarioApplyDialog.showModal();
    els.cancelScenarioApply.focus();
  } catch (error) {
    els.scenarioFeedback.textContent = error.message;
  }
}

function submitScenarioApply() {
  try {
    const action = assertScenarioUIContext(["apply"]);
    if (state.savedScenarios.length >= 10) throw new Error("Libera un lugar de escenario para conservar una copia de la Base anterior.");
    const name = getScenarioName(action.id);
    if (!confirmScenarioCaptureDiscard()) return;
    assertScenarioUIContext(["apply"]);
    els.confirmScenarioApply.disabled = true;
    const backupId = applySavedScenarioToBase(action.id);
    const backupName = getScenarioName(backupId);
    closeScenarioUIDialog(els.scenarioApplyDialog, false);
    renderBuilder();
    renderDashboard();
    els.scenarioFeedback.textContent = `Base personal usa los datos de ${name}. La Base anterior se conservó como «${backupName}».`;
    els.scenarioSelect.focus();
  } catch (error) {
    els.scenarioApplyError.textContent = error.message;
    els.confirmScenarioApply.disabled = state.savedScenarios.length >= 10;
  }
}

function bindScenarioEvents() {
  const switchScenario = (id) => {
    try {
      if (!switchSavedScenario(id)) return;
      renderBuilder();
      renderDashboard();
      els.scenarioFeedback.textContent = `Escenario activo: ${getScenarioName()}.`;
      els.scenarioSelect.focus();
    } catch (error) {
      els.scenarioSelect.value = state.activeScenarioId;
      els.scenarioFeedback.textContent = error.message;
    }
  };
  els.scenarioSelect.addEventListener("change", () => switchScenario(els.scenarioSelect.value));
  els.returnToBaseButton.addEventListener("click", () => switchScenario("base"));
  els.createScenarioButton.addEventListener("click", () => openScenarioName("create"));
  els.duplicateScenarioButton.addEventListener("click", () => openScenarioName("duplicate"));
  els.renameScenarioButton.addEventListener("click", () => openScenarioName("rename"));
  els.scenarioNameForm.addEventListener("submit", submitScenarioName);
  els.scenarioNameInput.addEventListener("input", () => { els.scenarioNameError.textContent = ""; });
  els.deleteScenarioButton.addEventListener("click", openScenarioDelete);
  els.confirmScenarioDelete.addEventListener("click", submitScenarioDelete);
  els.applyScenarioButton.addEventListener("click", openScenarioApply);
  els.confirmScenarioApply.addEventListener("click", submitScenarioApply);
  [
    [els.scenarioNameDialog, els.cancelScenarioName, ["create", "duplicate", "rename"]],
    [els.scenarioDeleteDialog, els.cancelScenarioDelete, ["delete"]],
    [els.scenarioApplyDialog, els.cancelScenarioApply, ["apply"]],
  ].forEach(([dialog, cancelButton, kinds]) => {
    cancelButton.addEventListener("click", () => closeScenarioUIDialog(dialog));
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeScenarioUIDialog(dialog);
    });
    dialog.addEventListener("close", () => {
      if (!dialog.open && kinds.includes(state.scenarioAction?.kind)) state.scenarioAction = null;
    });
  });
}


function bindEvents() {
  bindMoneyInputs();
  bindImportEvents();
  bindScenarioEvents();
  els.demoModeButton.addEventListener("click", () => setMode("demo"));
  els.customModeButton.addEventListener("click", () => setMode("custom", { scrollToBuilder: true }));

  els.heroPrimaryAction.addEventListener("click", () => {
    if (state.mode === "demo") {
      setMode("custom", { scrollToBuilder: true });
    } else {
      els.builderSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });

  els.horizon.addEventListener("change", (event) => {
    state.horizon = Number(event.target.value);
    state.selectedMovementIds.clear();
    renderDashboard();
  });

  els.includePending.addEventListener("change", (event) => {
    state.includePending = event.target.checked;
    state.selectedMovementIds.clear();
    renderDashboard();
  });

  els.chartScaleAuto.addEventListener("click", () => setChartScaleMode("auto"));
  els.chartScaleZero.addEventListener("click", () => setChartScaleMode("zero"));

  els.bankCount.addEventListener("change", (event) => syncBankCount(event.target.value));
  els.addBankButton.addEventListener("click", () => {
    try { syncBankCount(state.custom.accounts.length + 1); }
    catch (error) { els.captureFeedback.textContent = error.message; }
  });
  els.banksEditor.addEventListener("click", (event) => {
    const button = event.target.closest("[data-retire-bank]");
    if (button) openBankRetirement(button.dataset.retireBank, button);
  });
  els.cancelBankRetire.addEventListener("click", () => els.bankRetireDialog.close());
  els.confirmBankRetire.addEventListener("click", submitBankRetirement);
  els.bankRetireDialog.addEventListener("close", () => {
    const opener = state.bankRetirement?.opener;
    state.bankRetirement = null;
    if (opener?.isConnected) opener.focus();
  });

  els.banksEditor.addEventListener("input", (event) => {
    const row = event.target.closest("[data-bank-id]");
    const field = event.target.dataset.field;
    if (!row || !field) {
      return;
    }

    const account = state.custom.accounts.find((item) => item.id === row.dataset.bankId);
    if (!account) {
      return;
    }

    if (field !== "name") return;
    const value = event.target.value.slice(0, 50) || "Banco";
    try {
      persistCustomCandidate({ ...state.custom, accounts: state.custom.accounts.map((item) => item.id === account.id ? { ...item, [field]: value } : item) });
      els.captureFeedback.textContent = "";
    } catch (error) {
      els.captureFeedback.textContent = error.message;
      return;
    }
    els.initialTotal.textContent = detailCurrency.format(getAvailableBalance(state.custom.accounts));
    if (field === "name") {
      renderCaptureBank();
      renderCaptureList();
    }
    renderDashboard();
  });

  els.movementForm.addEventListener("submit", addMovement);
  els.movementForm.addEventListener("keydown", handleCaptureKeydown);
  els.movementType.addEventListener("change", renderCaptureBank);

  const filterControls = [
    [els.movementSearch, "query", "input"],
    [els.movementTypeFilter, "type", "change"],
    [els.movementStatusFilter, "status", "change"],
    [els.movementBankFilter, "bank", "change"],
    [els.movementCategoryFilter, "category", "change"],
    [els.movementScopeFilter, "scope", "change"],
    [els.movementFromFilter, "from", "change"],
    [els.movementToFilter, "to", "change"],
  ];
  filterControls.forEach(([control, key, eventName]) => {
    control.addEventListener(eventName, () => {
      state.movementFilters[key] = control.value;
      state.selectedMovementIds.clear();
      els.movementFeedback.textContent = "";
      renderMovements();
    });
  });
  els.clearMovementFilters.addEventListener("click", () => {
    state.movementFilters = createMovementFilters();
    state.selectedMovementIds.clear();
    els.movementFeedback.textContent = "";
    syncMovementFilterControls();
    renderMovements();
  });
  els.selectAllMovements.addEventListener("change", () => {
    state.selectedMovementIds = els.selectAllMovements.checked
      ? new Set(getVisibleMovements().map((movement) => movement.id)) : new Set();
    updateMovementSelection();
  });
  els.clearMovementSelection.addEventListener("click", clearMovementSelection);
  els.movementsTableBody.addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-select-movement]");
    if (!checkbox) return;
    if (checkbox.checked) state.selectedMovementIds.add(checkbox.dataset.selectMovement);
    else state.selectedMovementIds.delete(checkbox.dataset.selectMovement);
    updateMovementSelection();
  });
  els.editSelectedMovements.addEventListener("click", () => {
    updateMovementSelection();
    openMovementEditor([...state.selectedMovementIds], els.editSelectedMovements);
  });
  [els.movementsTableBody, els.captureList].forEach((container) => {
    container.addEventListener("click", (event) => {
      const button = event.target.closest("[data-edit-movement]");
      if (button) openMovementEditor([button.dataset.editMovement], button);
      const duplicate = event.target.closest("[data-duplicate-movement]");
      if (duplicate) openMovementEditor([duplicate.dataset.duplicateMovement], duplicate, "duplicate");
    });
    container.addEventListener("dblclick", (event) => {
      if (event.target.closest("button, input, select, label, a")) return;
      const row = event.target.closest("[data-movement-id]");
      if (row) openMovementEditor([row.dataset.movementId], row.querySelector("[data-edit-movement]"));
    });
  });
  els.movementEditForm.addEventListener("submit", submitMovementEdit);
  [els.editDateEnabled, els.editStatusEnabled, els.editMovementStatus, els.editBankEnabled, els.editMovementBank,
    els.editCategoryEnabled, els.editMovementCategory, els.editTransferFromBank, els.editTransferToBank].forEach((control) => {
    control.addEventListener("change", updateMovementEditPreview);
  });
  els.editMovementDate.addEventListener("input", updateMovementEditPreview);
  els.editMovementDate.addEventListener("change", updateMovementEditPreview);
  [els.editMovementConcept, els.editMovementAmount].forEach((control) => control.addEventListener("input", updateMovementEditPreview));
  els.cancelMovementEdit.addEventListener("click", () => els.movementEditDialog.close());
  els.movementEditDialog.addEventListener("close", finishMovementEditor);

  [els.captureList, els.movementsTableBody].forEach((container) => container.addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-movement]");
    if (!button) return;
    try { deleteMovement(button.dataset.deleteMovement); }
    catch (error) { els.movementFeedback.textContent = error.message; els.captureFeedback.textContent = error.message; }
  }));
  els.undoToasts.addEventListener("click", (event) => {
    const button = event.target.closest("[data-undo-delete]");
    if (!button) return;
    try { undoDeleteMovement(button.dataset.undoDelete); }
    catch (error) { els.movementFeedback.textContent = error.message; els.captureFeedback.textContent = error.message; }
  });
  els.exportMovements.addEventListener("click", exportMovementsToExcel);

  els.resetProjection.addEventListener("click", resetCustomProjection);
}

// Inform the user about an external change, even before the next save attempt.
window.addEventListener?.("storage", (event) => {
  if (event.key !== STORAGE_KEY || event.newValue === lastPersistedSnapshot) return;
  els.captureFeedback.textContent = "Otra pestaña actualizó la proyección. Recarga para ver sus cambios; no se sobrescribirán.";
  if (els.scenarioFeedback) els.scenarioFeedback.textContent = "Hay cambios externos. Recarga antes de guardar.";
});

// The app may stay open overnight or resume after a suspended browser tab.
let midnightRefreshTimer = null;
function refreshTodayIfNeeded() {
  const nextToday = startOfDay(new Date());
  const nextISO = toISODate(nextToday);
  if (nextISO === todayISO) return false;
  const previousISO = todayISO;
  today = nextToday;
  todayISO = nextISO;
  els.projectionStart.value = nextISO;
  els.lastUpdate.textContent = `Fecha inicial: ${longDate.format(today)}`;
  els.movementDate.min = nextISO;
  if (!els.movementConcept.value.trim() && !els.movementAmount.value && els.movementDate.value === previousISO) {
    els.movementDate.value = nextISO;
  }
  state.selectedMovementIds.clear();
  renderDashboard();
  return true;
}

function scheduleMidnightRefresh() {
  if (midnightRefreshTimer !== null) clearTimeout(midnightRefreshTimer);
  const now = new Date();
  const tomorrow = startOfDay(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  midnightRefreshTimer = setTimeout(() => {
    refreshTodayIfNeeded();
    scheduleMidnightRefresh();
  }, Math.max(100, tomorrow.getTime() - now.getTime() + 100));
}

window.addEventListener?.("focus", refreshTodayIfNeeded);
document.addEventListener?.("visibilitychange", () => {
  if (document.visibilityState === "visible") refreshTodayIfNeeded();
});

function initialize() {
  els.projectionStart.value = todayISO;
  els.movementDate.value = todayISO;
  els.movementDate.min = todayISO;
  els.lastUpdate.textContent = `Fecha inicial: ${longDate.format(today)}`;
  els.horizon.value = String(state.horizon);
  els.includePending.checked = state.includePending;

  bindEvents();
  setMode("demo");
  scheduleMidnightRefresh();
}

initialize();


