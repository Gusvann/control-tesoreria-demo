"use strict";

const STORAGE_KEY = "ivanTreasuryProjectionV2";

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

const today = startOfDay(new Date());
const todayISO = toISODate(today);

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
};

const els = {
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
  movementScopeFilter: document.querySelector("#movementScopeFilter"),
  movementFromFilter: document.querySelector("#movementFromFilter"),
  movementToFilter: document.querySelector("#movementToFilter"),
  clearMovementFilters: document.querySelector("#clearMovementFilters"),
  selectAllMovements: document.querySelector("#selectAllMovements"),
  selectionSummary: document.querySelector("#selectionSummary"),
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

const currency = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

const compactCurrency = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  notation: "compact",
  maximumFractionDigits: 1,
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
          type: movement.type === "outflow" ? "outflow" : "inflow",
          status: movement.status === "pending" ? "pending" : "confirmed",
          amount: toSafeNumber(movement.amount),
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.custom));
  } catch (error) {
    console.warn("No fue posible guardar la proyección en este navegador.", error);
  }
}

function persistCustomCandidate(candidate) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(candidate));
  } catch (error) {
    throw new Error("No se pudo guardar en este navegador. Los datos no se modificaron. Revisa el espacio o los permisos de almacenamiento e intenta de nuevo.");
  }
  state.custom = candidate;
}

function getActiveAccounts() {
  return state.mode === "demo" ? demoAccounts : state.custom.accounts;
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
  return accounts.reduce((sum, account) => sum + toSafeNumber(account.balance), 0);
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
  return { query: "", type: "all", status: "all", from: "", to: "", scope: "projection" };
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
  els.editSelectedMovements.disabled = count === 0;
  els.clearMovementSelection.disabled = count === 0;
  els.movementsTableBody.querySelectorAll("[data-select-movement]").forEach((checkbox) => {
    checkbox.checked = state.selectedMovementIds.has(checkbox.dataset.selectMovement);
    checkbox.closest("tr").classList.toggle("is-selected", checkbox.checked);
  });
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
}

function prepareMovementEdit(movements, ids, patch) {
  if (!Array.isArray(ids) || ids.length === 0 || new Set(ids).size !== ids.length) {
    throw new Error("Selecciona movimientos únicos antes de editar.");
  }
  const fields = patch && typeof patch === "object" ? Object.keys(patch) : [];
  if (fields.length === 0 || fields.some((field) => field !== "date" && field !== "status")) {
    throw new Error("Elige cambiar fecha, estatus o ambos.");
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
  let changedCount = 0;
  const updated = movements.map((movement) => {
    if (!selected.has(movement.id) || !fields.some((field) => movement[field] !== patch[field])) return movement;
    changedCount += 1;
    return { ...movement, ...patch };
  });
  return { movements: updated, changedCount };
}

function commitMovementEdit(ids, patch, mode) {
  if (mode !== state.mode || !["demo", "custom"].includes(mode)) {
    throw new Error("La vista cambió. Cierra el editor y selecciona de nuevo los movimientos.");
  }
  const result = prepareMovementEdit(getActiveMovements(), ids, patch);
  if (result.changedCount === 0) return 0;
  if (mode === "custom") {
    persistCustomCandidate({ ...state.custom, movements: result.movements });
  } else {
    const selected = new Set(ids);
    result.movements.forEach((movement) => {
      if (selected.has(movement.id)) {
        state.demoEdits.set(movement.id, { date: movement.date, status: movement.status });
      }
    });
  }
  return result.changedCount;
}

function getMovementEditPatch() {
  const edit = state.movementEdit;
  const patch = {};
  if (els.editDateEnabled.checked) patch.date = els.editMovementDate.value;
  if (els.editStatusEnabled.checked) patch.status = els.editMovementStatus.value;
  // An unchanged historical date must not block an individual status edit.
  if (edit && edit.ids.length === 1) {
    Object.keys(patch).forEach((field) => {
      if (patch[field] === edit.original[0][field]) delete patch[field];
    });
  }
  return patch;
}

function updateMovementEditPreview() {
  els.editMovementDate.disabled = !els.editDateEnabled.checked;
  els.editMovementStatus.disabled = !els.editStatusEnabled.checked;
  els.editMovementError.textContent = "";
  els.saveMovementEdit.disabled = true;
  if (!state.movementEdit) return;
  const patch = getMovementEditPatch();
  if (Object.keys(patch).length === 0) {
    els.editMovementPreview.textContent = "Elige los campos y los nuevos valores que quieres aplicar.";
    return;
  }
  try {
    const result = prepareMovementEdit(getActiveMovements(), state.movementEdit.ids, patch);
    const fields = Object.keys(patch).map((field) => field === "date" ? "fecha" : "estatus").join(" y ");
    els.editMovementPreview.textContent = result.changedCount
      ? `Se aplicarán los cambios de ${fields} a ${result.changedCount} de ${state.movementEdit.ids.length} movimientos seleccionados.`
      : "Los movimientos ya tienen los valores indicados.";
    els.saveMovementEdit.disabled = result.changedCount === 0;
  } catch (error) {
    els.editMovementPreview.textContent = "No se aplicarán cambios hasta corregir los datos.";
    els.editMovementError.textContent = error.message;
  }
}

function openMovementEditor(ids, opener = document.activeElement) {
  const active = getActiveMovements();
  const originals = ids.map((id) => active.filter((movement) => movement.id === id));
  if (ids.length === 0 || new Set(ids).size !== ids.length || originals.some((matches) => matches.length !== 1)) {
    els.movementFeedback.textContent = "No se puede editar esta selección: hay movimientos ausentes o identificadores duplicados.";
    return;
  }
  const movements = originals.map(([movement]) => ({ ...movement }));
  state.movementEdit = {
    ids: [...ids], mode: state.mode, original: movements, opener,
    openerId: opener?.dataset?.editMovement,
    openerInCapture: Boolean(opener?.closest?.("#captureList")),
  };
  const single = ids.length === 1;
  const first = movements[0];
  els.movementEditTitle.textContent = single ? "Editar movimiento" : `Editar ${ids.length} movimientos`;
  els.movementEditDescription.textContent = single
    ? `${first.concept} · ${currency.format(first.amount)}. Cambia su fecha o estatus.`
    : `Los nuevos valores se aplicarán a los ${ids.length} movimientos seleccionados.`;
  els.editDateEnabled.checked = single;
  els.editStatusEnabled.checked = single;
  els.editMovementDate.min = todayISO;
  els.editMovementDate.value = movements.every((movement) => movement.date === first.date) ? first.date : todayISO;
  els.editMovementStatus.value = movements.every((movement) => movement.status === first.status) ? first.status : "confirmed";
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
    const replacement = [...container.querySelectorAll("[data-edit-movement]")]
      .find((button) => button.dataset.editMovement === edit.openerId);
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
    const count = commitMovementEdit(edit.ids, getMovementEditPatch(), edit.mode);
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
      } else {
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

  let runningBalance = startingBalance;
  const series = [{ day: 0, date: today, balance: runningBalance, movements: movementMap.get(0) ?? [] }];

  const dayZeroMovements = movementMap.get(0) ?? [];
  dayZeroMovements.forEach((movement) => {
    runningBalance += movement.type === "inflow" ? movement.amount : -movement.amount;
  });
  series[0].balance = runningBalance;

  for (let day = 1; day <= state.horizon; day += 1) {
    const dayMovements = movementMap.get(day) ?? [];
    dayMovements.forEach((movement) => {
      runningBalance += movement.type === "inflow" ? movement.amount : -movement.amount;
    });

    series.push({
      day,
      date: addDays(today, day),
      balance: runningBalance,
      movements: dayMovements,
    });
  }

  return series;
}

function setMode(mode, options = {}) {
  if (els.movementEditDialog.open) els.movementEditDialog.close();
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
    currentAccounts.length = safeCount;
  }

  state.custom.accounts = currentAccounts;
  els.bankCount.value = String(safeCount);
  saveCustomState();
  renderBuilder();
  renderDashboard();
}

function renderBanksEditor() {
  els.bankCount.value = String(state.custom.accounts.length);
  els.banksEditor.innerHTML = state.custom.accounts
    .map(
      (account, index) => `
        <div class="bank-row" data-bank-id="${escapeHTML(account.id)}">
          <span class="bank-row-number">BANCO ${index + 1}</span>
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
            <label for="bank-balance-${index}">Saldo</label>
            <input
              id="bank-balance-${index}"
              type="number"
              min="0"
              step="0.01"
              value="${account.balance}"
              data-field="balance"
            />
          </div>
        </div>
      `,
    )
    .join("");

  els.initialTotal.textContent = currency.format(getAvailableBalance(state.custom.accounts));
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
      const typeLabel = isInflow ? "Cobro" : "Pago";
      const statusLabel = movement.status === "pending" ? "Por confirmar" : "Confirmado";
      return `
        <div class="capture-item" data-movement-id="${escapeHTML(movement.id)}">
          <div>
            <strong>${escapeHTML(movement.concept)}</strong>
            <small>${shortDate.format(parseISODate(movement.date))} · ${typeLabel} · ${statusLabel}</small>
          </div>
          <span class="capture-amount ${isInflow ? "amount-in" : "amount-out"}">
            ${isInflow ? "+" : "−"}${currency.format(movement.amount)}
          </span>
          <div class="capture-item-actions">
            <button class="capture-edit-button" type="button"
              aria-label="Editar ${escapeHTML(movement.concept)}"
              data-edit-movement="${escapeHTML(movement.id)}">Editar</button>
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
  renderCaptureList();
}

function renderAccounts(accounts) {
  const total = getAvailableBalance(accounts);

  if (accounts.length === 0) {
    els.accountsTableBody.innerHTML = `
      <tr class="empty-state">
        <td colspan="3">No hay bancos registrados.</td>
      </tr>
    `;
    return;
  }

  els.accountsTableBody.innerHTML = accounts
    .map((account) => {
      const share = total > 0 ? account.balance / total : 0;
      return `
        <tr>
          <td><span class="account-name">${escapeHTML(account.name)}</span></td>
          <td class="align-right amount">${currency.format(account.balance)}</td>
          <td class="align-right account-share">${new Intl.NumberFormat("es-MX", {
            style: "percent",
            maximumFractionDigits: 1,
          }).format(share)}</td>
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
  els.projectedDelta.textContent = `${delta >= 0 ? "+" : ""}${currency.format(delta)} frente al saldo actual`;

  const pendingIncluded = filteredMovements.filter((movement) => movement.status === "pending");
  const pendingNet = pendingIncluded.reduce(
    (sum, movement) => sum + (movement.type === "inflow" ? movement.amount : -movement.amount),
    0,
  );

  els.pendingCount.textContent = state.includePending ? `${pendingIncluded.length} incluidos` : "No incluidos";
  els.pendingAmount.textContent = state.includePending
    ? `Efecto neto de ${pendingNet >= 0 ? "+" : ""}${currency.format(pendingNet)}`
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
  const filteredMovements = getVisibleMovements();
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
      const amountSign = isInflow ? "+" : "−";
      const statusLabel = movement.status === "confirmed" ? "Confirmado" : "Por confirmar";
      const statusClass = movement.status === "confirmed" ? "status-confirmed" : "status-pending";

      return `
        <tr data-movement-id="${escapeHTML(movement.id)}" title="Doble clic para editar fecha o estatus">
          <td class="movement-selection-cell"><input class="movement-checkbox" type="checkbox"
            data-select-movement="${escapeHTML(movement.id)}"
            aria-label="Seleccionar ${escapeHTML(movement.concept)} del ${escapeHTML(movement.date)}" /></td>
          <td>${shortDate.format(parseISODate(movement.date))}</td>
          <td><span class="movement-concept">${escapeHTML(movement.concept)}</span></td>
          <td>${isInflow ? "Cobro" : "Pago"}</td>
          <td><span class="status ${statusClass}">${statusLabel}</span></td>
          <td class="align-right amount ${isInflow ? "amount-in" : "amount-out"}">
            ${amountSign}${currency.format(movement.amount)}
          </td>
          <td class="movement-row-actions"><button type="button" class="movement-edit-button"
            data-edit-movement="${escapeHTML(movement.id)}"
            aria-label="Editar ${escapeHTML(movement.concept)}">Editar</button></td>
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
    return compactCurrency.format(normalized);
  }

  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: Math.abs(normalized) < 100 ? 2 : 0,
  }).format(normalized);
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
  const margin = { top: 24, right: 24, bottom: 48, left: 98 };
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

function renderDashboard() {
  const accounts = getActiveAccounts();
  const filteredMovements = getFilteredMovements();
  const totals = getPeriodTotals(filteredMovements);
  const startingBalance = getAvailableBalance(accounts);
  const forecastSeries = getForecastSeries(filteredMovements, startingBalance);

  renderAccounts(accounts);
  renderKpis(accounts, filteredMovements, totals, forecastSeries);
  renderInsights(filteredMovements, forecastSeries);
  renderMovements();
  const hasChartData = startingBalance !== 0 || filteredMovements.length > 0;
  renderChart(forecastSeries, { hasData: hasChartData });

  els.liveRegion.textContent = `Escenario actualizado a ${state.horizon} días, con movimientos por confirmar ${
    state.includePending ? "incluidos" : "excluidos"
  }.`;
}

function addMovement(event) {
  event.preventDefault();
  if (state.mode !== "custom") return;
  els.captureFeedback.textContent = "";

  const concept = els.movementConcept.value.trim();
  const amount = Number(els.movementAmount.value);
  const date = els.movementDate.value;

  if (!concept || !isValidISODate(date) || !Number.isFinite(amount) || amount <= 0) {
    els.captureFeedback.textContent = "Completa la fecha, el concepto y un importe mayor a cero.";
    return;
  }

  if (differenceInDays(parseISODate(date), today) < 0) {
    els.captureFeedback.textContent = "La fecha del movimiento no puede ser anterior a hoy.";
    return;
  }

  const movement = {
    id: createId("movement"),
    date,
    concept,
    type: els.movementType.value === "outflow" ? "outflow" : "inflow",
    status: els.movementStatus.value === "pending" ? "pending" : "confirmed",
    amount,
  };
  try {
    persistCustomCandidate({ ...state.custom, movements: [...state.custom.movements, movement] });
  } catch (error) {
    els.captureFeedback.textContent = error.message;
    return;
  }
  els.captureFeedback.textContent = "Movimiento agregado a la proyección.";
  els.movementForm.reset();
  els.movementDate.value = todayISO;
  els.movementType.value = "inflow";
  els.movementStatus.value = "confirmed";
  renderBuilder();
  renderDashboard();
  els.movementConcept.focus();
}

function deleteMovement(id) {
  state.custom.movements = state.custom.movements.filter((movement) => movement.id !== id);
  saveCustomState();
  renderBuilder();
  renderDashboard();
}

function resetCustomProjection() {
  const confirmed = window.confirm("¿Quieres borrar todos los bancos, saldos y movimientos capturados?");
  if (!confirmed) {
    return;
  }

  state.custom = createDefaultCustomState();
  state.selectedMovementIds.clear();
  localStorage.removeItem(STORAGE_KEY);
  els.captureFeedback.textContent = "La proyección volvió a cero.";
  renderBuilder();
  renderDashboard();
}

function bindEvents() {
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

    if (field === "balance") {
      account.balance = toSafeNumber(event.target.value);
    } else if (field === "name") {
      account.name = event.target.value.slice(0, 50) || "Banco";
    }

    saveCustomState();
    els.initialTotal.textContent = currency.format(getAvailableBalance(state.custom.accounts));
    renderDashboard();
  });

  els.movementForm.addEventListener("submit", addMovement);
  els.movementForm.addEventListener("keydown", handleCaptureKeydown);

  const filterControls = [
    [els.movementSearch, "query", "input"],
    [els.movementTypeFilter, "type", "change"],
    [els.movementStatusFilter, "status", "change"],
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
    });
    container.addEventListener("dblclick", (event) => {
      if (event.target.closest("button, input, select, label, a")) return;
      const row = event.target.closest("[data-movement-id]");
      if (row) openMovementEditor([row.dataset.movementId], row.querySelector("[data-edit-movement]"));
    });
  });
  els.movementEditForm.addEventListener("submit", submitMovementEdit);
  [els.editDateEnabled, els.editStatusEnabled, els.editMovementStatus].forEach((control) => {
    control.addEventListener("change", updateMovementEditPreview);
  });
  els.editMovementDate.addEventListener("input", updateMovementEditPreview);
  els.editMovementDate.addEventListener("change", updateMovementEditPreview);
  els.cancelMovementEdit.addEventListener("click", () => els.movementEditDialog.close());
  els.movementEditDialog.addEventListener("close", finishMovementEditor);

  els.captureList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-movement]");
    if (button) {
      deleteMovement(button.dataset.deleteMovement);
    }
  });

  els.resetProjection.addEventListener("click", resetCustomProjection);
}

function initialize() {
  els.projectionStart.value = todayISO;
  els.movementDate.value = todayISO;
  els.movementDate.min = todayISO;
  els.lastUpdate.textContent = `Fecha inicial: ${longDate.format(today)}`;
  els.horizon.value = String(state.horizon);
  els.includePending.checked = state.includePending;

  bindEvents();
  setMode("demo");
}

initialize();

