/**
 * MediStock AI - Risk & Vulnerability Analysis Controller
 * Computes Stockout Probability, Days of Inventory (DOI), and Lead Time Vulnerability.
 */

document.addEventListener("DOMContentLoaded", async () => {
  if (window.medistockApi && window.medistockApi.isUsingBackend()) {
    try {
      await window.medistockApi.getInventory();
    } catch (e) {}
  }
  renderRiskAnalysisTable();
  renderRiskMatrixSummary();

  // Subscribe to central store updates for automatic reactivity
  if (window.inventoryData && typeof window.inventoryData.subscribe === "function") {
    window.inventoryData.subscribe(() => {
      renderRiskAnalysisTable();
      renderRiskMatrixSummary();
    });
  }
});

function renderRiskAnalysisTable() {
  const tbody = document.getElementById("riskTableBody");
  if (!tbody) return;

  const items = window.inventoryData ? window.inventoryData.getItems() : window.medistockData.getEnrichedMedicines();
  tbody.innerHTML = "";

  items.forEach(item => {
    const dailyBurnRate = (item.predictedDemand / 30);
    const daysOfInventory = Math.round((item.currentStock / (dailyBurnRate || 1)) * 10) / 10;
    const leadTime = item.leadTimeDays || 5;

    let stockoutProb = 0;
    let severityTag = "";
    let alertAction = "";

    if (item.currentStock === 0) {
      stockoutProb = 100;
      severityTag = `<span class="badge badge-danger">Critical (100%)</span>`;
      alertAction = `<span style="color: var(--danger); font-weight: 700;">Immediate Stockout</span>`;
    } else if (daysOfInventory <= leadTime) {
      stockoutProb = 95;
      severityTag = `<span class="badge badge-danger">High Risk (95%)</span>`;
      alertAction = `<span style="color: var(--danger); font-weight: 700;">Stockout before delivery</span>`;
    } else if (item.currentStock < item.predictedDemand) {
      stockoutProb = 75;
      severityTag = `<span class="badge badge-danger">Moderate (${stockoutProb}%)</span>`;
      alertAction = `<span style="color: #ea580c; font-weight: 600;">Depletion in ~${daysOfInventory} days</span>`;
    } else if (item.currentStock > item.predictedDemand * 1.35) {
      stockoutProb = 5;
      severityTag = `<span class="badge badge-warning">Overstock Risk</span>`;
      alertAction = `<span style="color: var(--warning-text);">Excess Capital Lockup</span>`;
    } else {
      stockoutProb = 10;
      severityTag = `<span class="badge badge-success">Minimal (10%)</span>`;
      alertAction = `<span style="color: var(--success); font-weight: 600;">Safe Buffer</span>`;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${item.medicine}</strong></td>
      <td><strong>${item.currentStock.toLocaleString('en-IN')} units</strong></td>
      <td>${dailyBurnRate.toFixed(1)} /day</td>
      <td>
        <span style="font-weight: 700; ${daysOfInventory < 10 ? 'color: var(--danger);' : ''}">${daysOfInventory} days</span>
      </td>
      <td>${leadTime} days</td>
      <td>${severityTag}</td>
      <td>${alertAction}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderRiskMatrixSummary() {
  const items = window.inventoryData ? window.inventoryData.getItems() : window.medistockData.getEnrichedMedicines();
  let criticalCount = 0;
  let capitalOverstock = 0;

  items.forEach(item => {
    const dailyBurn = item.predictedDemand / 30;
    const days = item.currentStock / (dailyBurn || 1);
    if (days <= (item.leadTimeDays || 5)) criticalCount++;
    if (item.riskLevel === "Overstock") {
      capitalOverstock += (item.currentStock - item.predictedDemand) * (item.unitPrice || 2.5);
    }
  });

  const critEl = document.getElementById("riskCriticalCount");
  if (critEl) critEl.textContent = criticalCount;

  const capEl = document.getElementById("riskCapitalExcess");
  if (capEl) {
    capEl.textContent = window.inventoryData ? window.inventoryData.formatIndianCurrency(capitalOverstock) : `₹${Math.round(capitalOverstock).toLocaleString('en-IN')}`;
  }
}
