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

function getActiveAccounts() {
  return state.mode === "demo" ? demoAccounts : state.custom.accounts;
}

function getActiveMovements() {
  if (state.mode === "demo") {
    return demoMovements.map((movement) => ({
      ...movement,
      date: toISODate(addDays(today, movement.offsetDays)),
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
  state.mode = mode;
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
        <div class="capture-item">
          <div>
            <strong>${escapeHTML(movement.concept)}</strong>
            <small>${shortDate.format(parseISODate(movement.date))} · ${typeLabel} · ${statusLabel}</small>
          </div>
          <span class="capture-amount ${isInflow ? "amount-in" : "amount-out"}">
            ${isInflow ? "+" : "−"}${currency.format(movement.amount)}
          </span>
          <button
            class="icon-button"
            type="button"
            aria-label="Eliminar ${escapeHTML(movement.concept)}"
            data-delete-movement="${escapeHTML(movement.id)}"
          >×</button>
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

function renderMovements(filteredMovements) {
  if (filteredMovements.length === 0) {
    els.movementsTableBody.innerHTML = `
      <tr class="empty-state">
        <td colspan="5">No hay movimientos para el escenario seleccionado.</td>
      </tr>
    `;
    els.movementSummary.textContent = "0 movimientos";
    return;
  }

  els.movementsTableBody.innerHTML = filteredMovements
    .map((movement) => {
      const isInflow = movement.type === "inflow";
      const amountSign = isInflow ? "+" : "−";
      const statusLabel = movement.status === "confirmed" ? "Confirmado" : "Por confirmar";
      const statusClass = movement.status === "confirmed" ? "status-confirmed" : "status-pending";

      return `
        <tr>
          <td>${shortDate.format(parseISODate(movement.date))}</td>
          <td><span class="movement-concept">${escapeHTML(movement.concept)}</span></td>
          <td>${isInflow ? "Cobro" : "Pago"}</td>
          <td><span class="status ${statusClass}">${statusLabel}</span></td>
          <td class="align-right amount ${isInflow ? "amount-in" : "amount-out"}">
            ${amountSign}${currency.format(movement.amount)}
          </td>
        </tr>
      `;
    })
    .join("");

  els.movementSummary.textContent = `${filteredMovements.length} ${
    filteredMovements.length === 1 ? "movimiento" : "movimientos"
  }`;
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
  renderMovements(filteredMovements);
  const hasChartData = startingBalance !== 0 || filteredMovements.length > 0;
  renderChart(forecastSeries, { hasData: hasChartData });

  els.liveRegion.textContent = `Escenario actualizado a ${state.horizon} días, con movimientos por confirmar ${
    state.includePending ? "incluidos" : "excluidos"
  }.`;
}

function addMovement(event) {
  event.preventDefault();
  els.captureFeedback.textContent = "";

  const concept = els.movementConcept.value.trim();
  const amount = Number(els.movementAmount.value);
  const date = els.movementDate.value;

  if (!concept || !date || !Number.isFinite(amount) || amount <= 0) {
    els.captureFeedback.textContent = "Completa la fecha, el concepto y un importe mayor a cero.";
    return;
  }

  if (differenceInDays(parseISODate(date), today) < 0) {
    els.captureFeedback.textContent = "La fecha del movimiento no puede ser anterior a hoy.";
    return;
  }

  state.custom.movements.push({
    id: createId("movement"),
    date,
    concept,
    type: els.movementType.value === "outflow" ? "outflow" : "inflow",
    status: els.movementStatus.value === "pending" ? "pending" : "confirmed",
    amount,
  });

  saveCustomState();
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
    renderDashboard();
  });

  els.includePending.addEventListener("change", (event) => {
    state.includePending = event.target.checked;
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
