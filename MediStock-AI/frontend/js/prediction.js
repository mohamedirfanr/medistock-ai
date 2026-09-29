/**
 * MediStock AI - AI Forecasting & Prediction Engine Controller
 * Simulates ML demand projections for May & June, model metrics (MAPE, RMSE),
 * confidence intervals, and algorithm comparisons.
 */

let selectedModel = "xgboost";
let forecastChartInstance = null;

document.addEventListener("DOMContentLoaded", async () => {
  if (window.medistockApi && window.medistockApi.isUsingBackend()) {
    try {
      await window.medistockApi.getInventory();
    } catch (e) {}
  }
  initModelSelector();
  renderPredictionTable();
  renderForecastChart();

  // Subscribe to central store updates for automatic reactivity
  if (window.inventoryData && typeof window.inventoryData.subscribe === "function") {
    window.inventoryData.subscribe(() => {
      renderPredictionTable();
      renderForecastChart();
    });
  }
});

function initModelSelector() {
  const modelSelect = document.getElementById("forecastModelSelect");
  if (modelSelect) {
    modelSelect.addEventListener("change", (e) => {
      selectedModel = e.target.value;
      updateModelMetrics(selectedModel);
      renderPredictionTable();
      showToast(`Re-calculated demand forecast using ${e.target.options[e.target.selectedIndex].text}`, "primary");
    });
  }
}

function updateModelMetrics(modelKey) {
  const mapeEl = document.getElementById("metricMAPE");
  const rmseEl = document.getElementById("metricRMSE");
  const r2El = document.getElementById("metricR2");

  if (modelKey === "xgboost") {
    if (mapeEl) mapeEl.textContent = "3.8%";
    if (rmseEl) rmseEl.textContent = "14.2 units";
    if (r2El) r2El.textContent = "0.96";
  } else if (modelKey === "prophet") {
    if (mapeEl) mapeEl.textContent = "4.5%";
    if (rmseEl) rmseEl.textContent = "18.1 units";
    if (r2El) r2El.textContent = "0.93";
  } else if (modelKey === "arima") {
    if (mapeEl) mapeEl.textContent = "6.1%";
    if (rmseEl) rmseEl.textContent = "22.7 units";
    if (r2El) r2El.textContent = "0.89";
  } else {
    if (mapeEl) mapeEl.textContent = "3.2%";
    if (rmseEl) rmseEl.textContent = "12.0 units";
    if (r2El) r2El.textContent = "0.98";
  }
}

function renderPredictionTable() {
  const tbody = document.getElementById("predictionTableBody");
  if (!tbody) return;

  const items = window.inventoryData ? window.inventoryData.getItems() : window.medistockData.getEnrichedMedicines();
  tbody.innerHTML = "";

  items.forEach(item => {
    const mayPred = item.predictedDemand;
    // June forecast estimation
    const growth = (item.apr - item.jan) / 3;
    const junePred = Math.round(mayPred + growth * 0.85);
    const confidencePct = Math.min(99, Math.max(88, 97 - Math.floor(Math.random() * 5)));

    const lowerBound = Math.round(mayPred * 0.94);
    const upperBound = Math.round(mayPred * 1.06);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${item.medicine}</strong></td>
      <td><span class="badge badge-neutral">${item.apr.toLocaleString('en-IN')}</span></td>
      <td>
        <strong style="color: var(--primary); font-size: 1rem;">${mayPred.toLocaleString('en-IN')} units</strong>
        <div style="font-size: 0.72rem; color: var(--text-muted);">95% CI: [${lowerBound.toLocaleString('en-IN')} - ${upperBound.toLocaleString('en-IN')}]</div>
      </td>
      <td>
        <strong style="color: var(--secondary); font-size: 1rem;">${junePred.toLocaleString('en-IN')} units</strong>
      </td>
      <td>
        <div class="confidence-meter">
          <div class="progress-bar-bg" style="width: 80px;">
            <div class="progress-bar-fill" style="width: ${confidencePct}%;"></div>
          </div>
          <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-secondary);">${confidencePct}%</span>
        </div>
      </td>
      <td>
        ${mayPred > item.currentStock 
          ? `<span class="badge badge-danger">🔴 Stockout in May</span>` 
          : `<span class="badge badge-success">🟢 Sufficient Stock</span>`}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderForecastChart() {
  const canvas = document.getElementById("forecastChartCanvas");
  if (!canvas) return;

  if (forecastChartInstance) {
    try {
      forecastChartInstance.destroy();
    } catch (e) {}
    forecastChartInstance = null;
  }

  const medicines = window.inventoryData ? window.inventoryData.getItems() : (window.medistockData ? window.medistockData.getEnrichedMedicines() : []);
  let totJan = 0, totFeb = 0, totMar = 0, totApr = 0, totMay = 0, totJun = 0;

  medicines.forEach(m => {
    totJan += (Number(m.jan) || 0);
    totFeb += (Number(m.feb) || 0);
    totMar += (Number(m.mar) || 0);
    totApr += (Number(m.apr) || 0);
    totMay += (Number(m.predictedDemand) || 0);
    totJun += Math.round((Number(m.predictedDemand) || 0) * 1.08);
  });

  forecastChartInstance = new Chart(canvas, {
    type: "line",
    data: {
      labels: ["Jan", "Feb", "Mar", "Apr (Actual)", "May (AI Forecast)", "Jun (AI Forecast)"],
      datasets: [
        {
          label: "Historical Realized Demand",
          data: [totJan, totFeb, totMar, totApr, null, null],
          borderColor: "#0284c7",
          backgroundColor: "rgba(2, 132, 199, 0.1)",
          fill: true,
          tension: 0.3,
          borderWidth: 3
        },
        {
          label: "AI Neural Forecast",
          data: [null, null, null, totApr, totMay, totJun],
          borderColor: "#0d9488",
          backgroundColor: "rgba(13, 148, 136, 0.15)",
          borderDash: [6, 6],
          fill: true,
          tension: 0.3,
          borderWidth: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top" }
      }
    }
  });
}
