/**
 * MediStock AI - Demand Analysis Page Controller
 * Calculates Month-over-Month (MoM) growth, consumption velocity, and seasonal peaks.
 */

let demandChartInstance = null;

document.addEventListener("DOMContentLoaded", async () => {
  if (window.medistockApi && window.medistockApi.isUsingBackend()) {
    try {
      await window.medistockApi.getInventory();
    } catch (e) {}
  }
  renderDemandAnalysis();
  renderDemandTrendChart();

  // Subscribe to central store updates for automatic reactivity
  if (window.inventoryData && typeof window.inventoryData.subscribe === "function") {
    window.inventoryData.subscribe(() => {
      renderDemandAnalysis();
      renderDemandTrendChart();
    });
  }
});

function renderDemandAnalysis() {
  const tbody = document.getElementById("demandTableBody");
  if (!tbody) return;

  const items = window.inventoryData ? window.inventoryData.getItems() : window.medistockData.getEnrichedMedicines();
  tbody.innerHTML = "";

  items.forEach(item => {
    const momChange = Math.round(((item.apr - item.mar) / (item.mar || 1)) * 100);
    const avgMonthly = Math.round((item.jan + item.feb + item.mar + item.apr) / 4);
    
    let trendBadge = "";
    if (momChange > 15) {
      trendBadge = `<span class="badge badge-danger">Surging (+${momChange}%)</span>`;
    } else if (momChange > 0) {
      trendBadge = `<span class="badge badge-primary">Growing (+${momChange}%)</span>`;
    } else if (momChange === 0) {
      trendBadge = `<span class="badge badge-neutral">Stable (0%)</span>`;
    } else {
      trendBadge = `<span class="badge badge-warning">Declining (${momChange}%)</span>`;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${item.medicine}</strong></td>
      <td>${item.jan.toLocaleString('en-IN')}</td>
      <td>${item.feb.toLocaleString('en-IN')}</td>
      <td>${item.mar.toLocaleString('en-IN')}</td>
      <td><strong>${item.apr.toLocaleString('en-IN')}</strong></td>
      <td>${avgMonthly.toLocaleString('en-IN')} /mo</td>
      <td>${trendBadge}</td>
      <td>
        <span style="font-weight: 700; color: var(--secondary);">${item.predictedDemand.toLocaleString('en-IN')} units</span>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderDemandTrendChart() {
  const canvas = document.getElementById("demandTrendChart");
  if (!canvas) return;

  if (demandChartInstance) {
    try {
      demandChartInstance.destroy();
    } catch (e) {}
    demandChartInstance = null;
  }

  const allItems = window.inventoryData ? window.inventoryData.getItems() : (window.medistockData ? window.medistockData.getEnrichedMedicines() : []);
  const items = allItems.slice(0, 5);
  const datasets = items.map((item, idx) => {
    const palette = ["#0284c7", "#0d9488", "#ef4444", "#f59e0b", "#8b5cf6"];
    return {
      label: item.medicine.split(" ")[0],
      data: [item.jan, item.feb, item.mar, item.apr],
      borderColor: palette[idx % palette.length],
      backgroundColor: palette[idx % palette.length],
      tension: 0.3,
      borderWidth: 2.5
    };
  });

  demandChartInstance = new Chart(canvas, {
    type: "line",
    data: {
      labels: ["Jan", "Feb", "Mar", "Apr"],
      datasets: datasets
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
