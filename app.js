"use strict";

const accounts = [
  {
    institution: "Banco Horizonte",
    account: "Cuenta operativa",
    code: "•••• 4821",
    balance: 2450000,
    use: "Operación",
  },
  {
    institution: "Banco Vértice",
    account: "Cuenta de nómina",
    code: "•••• 1937",
    balance: 980000,
    use: "Nómina",
  },
  {
    institution: "Banco Nexo",
    account: "Cuenta de reserva",
    code: "•••• 8054",
    balance: 1390000,
    use: "Reserva",
  },
];

const movements = [
  { offsetDays: 1, concept: "Cobro Proyecto Atlas", type: "inflow", amount: 580000, status: "confirmed" },
  { offsetDays: 2, concept: "Pago a proveedores", type: "outflow", amount: 420000, status: "confirmed" },
  { offsetDays: 3, concept: "Impuestos mensuales", type: "outflow", amount: 310000, status: "confirmed" },
  { offsetDays: 4, concept: "Cobro servicio empresarial", type: "inflow", amount: 750000, status: "pending" },
  { offsetDays: 5, concept: "Nómina quincenal", type: "outflow", amount: 840000, status: "confirmed" },
  { offsetDays: 7, concept: "Renta y servicios", type: "outflow", amount: 135000, status: "confirmed" },
  { offsetDays: 9, concept: "Cobro Proyecto Lumen", type: "inflow", amount: 465000, status: "pending" },
  { offsetDays: 12, concept: "Pago de infraestructura", type: "outflow", amount: 225000, status: "pending" },
  { offsetDays: 15, concept: "Cobro de anualidades", type: "inflow", amount: 890000, status: "confirmed" },
  { offsetDays: 18, concept: "Nómina quincenal", type: "outflow", amount: 840000, status: "confirmed" },
  { offsetDays: 21, concept: "Pago a proveedores", type: "outflow", amount: 510000, status: "pending" },
  { offsetDays: 25, concept: "Cobro Proyecto Norte", type: "inflow", amount: 630000, status: "pending" },
  { offsetDays: 28, concept: "Impuestos provisionales", type: "outflow", amount: 340000, status: "confirmed" },
];

const state = {
  horizon: 14,
  includePending: true,
  baseDate: startOfDay(new Date()),
};

const els = {
  horizon: document.querySelector("#horizon"),
  includePending: document.querySelector("#includePending"),
  availableBalance: document.querySelector("#availableBalance"),
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
  forecastChart: document.querySelector("#forecastChart"),
  lastUpdate: document.querySelector("#lastUpdate"),
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
  return result;
}

function getAvailableBalance() {
  return accounts.reduce((sum, account) => sum + account.balance, 0);
}

function isMovementIncluded(movement) {
  const isInsideHorizon = movement.offsetDays >= 0 && movement.offsetDays <= state.horizon;
  const statusAllowed = state.includePending || movement.status === "confirmed";
  return isInsideHorizon && statusAllowed;
}

function getFilteredMovements() {
  return movements.filter(isMovementIncluded).sort((a, b) => a.offsetDays - b.offsetDays);
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

function getForecastSeries(filteredMovements) {
  const movementMap = new Map();

  filteredMovements.forEach((movement) => {
    const existing = movementMap.get(movement.offsetDays) ?? [];
    existing.push(movement);
    movementMap.set(movement.offsetDays, existing);
  });

  let runningBalance = getAvailableBalance();
  const series = [{ day: 0, date: state.baseDate, balance: runningBalance, movements: [] }];

  for (let day = 1; day <= state.horizon; day += 1) {
    const dayMovements = movementMap.get(day) ?? [];
    dayMovements.forEach((movement) => {
      runningBalance += movement.type === "inflow" ? movement.amount : -movement.amount;
    });

    series.push({
      day,
      date: addDays(state.baseDate, day),
      balance: runningBalance,
      movements: dayMovements,
    });
  }

  return series;
}

function renderAccounts() {
  els.accountsTableBody.innerHTML = accounts
    .map(
      (account) => `
        <tr>
          <td><span class="account-name">${account.institution}</span></td>
          <td>
            ${account.account}
            <span class="account-code">${account.code}</span>
          </td>
          <td class="align-right amount">${currency.format(account.balance)}</td>
          <td><span class="account-use">${account.use}</span></td>
        </tr>
      `,
    )
    .join("");
}

function renderKpis(filteredMovements, totals, forecastSeries) {
  const availableBalance = getAvailableBalance();
  const projectedBalance = forecastSeries.at(-1).balance;
  const delta = projectedBalance - availableBalance;

  els.availableBalance.textContent = currency.format(availableBalance);
  els.periodInflows.textContent = currency.format(totals.inflows);
  els.periodOutflows.textContent = currency.format(totals.outflows);
  els.projectedBalance.textContent = currency.format(projectedBalance);
  els.inflowCount.textContent = `${totals.inflowCount} ${totals.inflowCount === 1 ? "cobro" : "cobros"} considerados`;
  els.outflowCount.textContent = `${totals.outflowCount} ${totals.outflowCount === 1 ? "pago" : "pagos"} considerados`;
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
    els.largestOutflowLabel.textContent = `${largestOutflow.concept} · ${longDate.format(
      addDays(state.baseDate, largestOutflow.offsetDays),
    )}`;
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
      const movementDate = addDays(state.baseDate, movement.offsetDays);
      const isInflow = movement.type === "inflow";
      const amountSign = isInflow ? "+" : "−";
      const statusLabel = movement.status === "confirmed" ? "Confirmado" : "Por confirmar";
      const statusClass = movement.status === "confirmed" ? "status-confirmed" : "status-pending";

      return `
        <tr>
          <td>${shortDate.format(movementDate)}</td>
          <td><span class="movement-concept">${movement.concept}</span></td>
          <td>${isInflow ? "Cobro" : "Pago"}</td>
          <td><span class="status ${statusClass}">${statusLabel}</span></td>
          <td class="align-right amount ${isInflow ? "amount-in" : "amount-out"}">
            ${amountSign}${currency.format(movement.amount)}
          </td>
        </tr>
      `;
    })
    .join("");

  els.movementSummary.textContent = `${filteredMovements.length} movimientos`;
}

function renderChart(series) {
  const width = 1000;
  const height = 340;
  const margin = { top: 24, right: 24, bottom: 48, left: 82 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const balances = series.map((point) => point.balance);
  const minBalance = Math.min(...balances);
  const maxBalance = Math.max(...balances);
  const padding = Math.max((maxBalance - minBalance) * 0.18, 250000);
  const yMin = Math.max(0, minBalance - padding);
  const yMax = maxBalance + padding;

  const x = (day) => margin.left + (day / state.horizon) * plotWidth;
  const y = (balance) => margin.top + ((yMax - balance) / (yMax - yMin || 1)) * plotHeight;

  const linePath = series
    .map((point, index) => `${index === 0 ? "M" : "L"} ${x(point.day).toFixed(2)} ${y(point.balance).toFixed(2)}`)
    .join(" ");

  const areaPath = `${linePath} L ${x(state.horizon)} ${margin.top + plotHeight} L ${x(0)} ${
    margin.top + plotHeight
  } Z`;

  const yTicks = 4;
  const gridLines = Array.from({ length: yTicks + 1 }, (_, index) => {
    const ratio = index / yTicks;
    const value = yMax - ratio * (yMax - yMin);
    const yPosition = margin.top + ratio * plotHeight;
    return `
      <line class="chart-grid-line" x1="${margin.left}" y1="${yPosition}" x2="${width - margin.right}" y2="${yPosition}" />
      <text class="chart-axis-label" x="${margin.left - 12}" y="${yPosition + 4}" text-anchor="end">${compactCurrency.format(
        value,
      )}</text>
    `;
  }).join("");

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
    .map(
      (point) => `<circle class="chart-point" cx="${x(point.day)}" cy="${y(point.balance)}" r="5" />`,
    )
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

function render() {
  const filteredMovements = getFilteredMovements();
  const totals = getPeriodTotals(filteredMovements);
  const forecastSeries = getForecastSeries(filteredMovements);

  renderKpis(filteredMovements, totals, forecastSeries);
  renderInsights(filteredMovements, forecastSeries);
  renderMovements(filteredMovements);
  renderChart(forecastSeries);

  els.liveRegion.textContent = `Escenario actualizado a ${state.horizon} días, con movimientos por confirmar ${
    state.includePending ? "incluidos" : "excluidos"
  }.`;
}

function initialize() {
  renderAccounts();
  els.lastUpdate.textContent = `Actualizado: ${longDate.format(state.baseDate)}`;

  els.horizon.addEventListener("change", (event) => {
    state.horizon = Number(event.target.value);
    render();
  });

  els.includePending.addEventListener("change", (event) => {
    state.includePending = event.target.checked;
    render();
  });

  render();
}

initialize();
