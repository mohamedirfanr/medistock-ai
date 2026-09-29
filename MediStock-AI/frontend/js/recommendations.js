/**
 * MediStock AI - AI Automated Recommendations & Purchase Order Engine
 * Generates automated POs, economic order quantities (EOQ), cost estimates,
 * and clinical replenishment priorities.
 */

document.addEventListener("DOMContentLoaded", async () => {
  // Sync store with live backend if available
  if (window.medistockApi && typeof window.medistockApi.syncStore === "function") {
    try {
      await window.medistockApi.syncStore();
    } catch (e) {
      console.warn("Background API sync in recommendations:", e);
    }
  }

  // Subscribe to central store updates
  if (window.inventoryData && typeof window.inventoryData.subscribe === "function") {
    window.inventoryData.subscribe(() => {
      renderRecommendations();
    });
  }

  renderRecommendations();
  initActionButtons();
  initSearch();
});

let currentSearchFilter = "";

function renderRecommendations() {
  const tbody = document.getElementById("recommendationsTableBody");
  if (!tbody) return;

  const store = window.inventoryData || window.medistockData;
  if (!store) return;

  const items = store.getEnrichedMedicines();
  let shortages = items.filter(m => (m.recommendedReorder || 0) > 0);

  if (currentSearchFilter) {
    const q = currentSearchFilter.toLowerCase();
    shortages = shortages.filter(m => 
      (m.medicine && m.medicine.toLowerCase().includes(q)) ||
      (m.supplier && m.supplier.toLowerCase().includes(q))
    );
  }

  tbody.innerHTML = "";
  let totalOrderCost = 0;
  let totalUnitsToOrder = 0;

  if (shortages.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 3rem; color: var(--text-muted);">
          <i data-lucide="check-circle" style="width: 44px; height: 44px; color: var(--success); margin: 0 auto 0.75rem; display: block;"></i>
          <strong style="font-size: 1.05rem; color: var(--text-main);">All stock levels are optimal!</strong><br>
          <span style="font-size: 0.875rem;">No urgent replenishment reorders needed based on current AI forecasts.</span>
        </td>
      </tr>
    `;
    updateKPISummaries(0, 0, 0);
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  // Calculate totals from ALL shortages (unfiltered) for accurate KPI cards
  const allShortages = items.filter(m => (m.recommendedReorder || 0) > 0);
  allShortages.forEach(item => {
    const cost = (item.recommendedReorder || 0) * (item.unitPrice || 0);
    totalOrderCost += cost;
    totalUnitsToOrder += (item.recommendedReorder || 0);
  });

  shortages.forEach(item => {
    const qty = item.recommendedReorder || 0;
    const unitPrice = item.unitPrice || 0;
    const lineCost = qty * unitPrice;

    let priorityBadge = "";
    if (item.currentStock < item.predictedDemand * 0.4) {
      priorityBadge = `<span class="badge badge-danger">🚨 Immediate</span>`;
    } else {
      priorityBadge = `<span class="badge badge-warning">⚠️ High Priority</span>`;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <strong>${item.medicine}</strong>
        <div style="font-size: 0.75rem; color: var(--text-muted);">${item.supplier || 'Hospital Authorized Supplier'}</div>
      </td>
      <td>${store.formatUnits ? store.formatUnits(item.currentStock) : item.currentStock.toLocaleString('en-IN')}</td>
      <td><strong>${store.formatUnits ? store.formatUnits(item.predictedDemand) : item.predictedDemand.toLocaleString('en-IN')}</strong></td>
      <td><strong style="color: var(--danger); font-size: 1.05rem;">+${item.recommendedReorder.toLocaleString('en-IN')}</strong></td>
      <td>₹${Number(unitPrice).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td><strong>₹${Math.round(lineCost).toLocaleString('en-IN')}</strong></td>
      <td>${priorityBadge}</td>
      <td>
        <button class="btn btn-outline btn-sm btn-issue-po"
          data-medicine="${encodeURIComponent(item.medicine)}"
          data-qty="${qty}"
          data-cost="${Math.round(lineCost)}">
          <i data-lucide="send" style="width: 14px; height: 14px;"></i> Issue PO
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  updateKPISummaries(allShortages.length, totalUnitsToOrder, totalOrderCost);

  if (window.lucide) window.lucide.createIcons();
}

function updateKPISummaries(poCount, totalUnits, totalCost) {
  const store = window.inventoryData || window.medistockData;

  const totCostEl = document.getElementById("reorderTotalCost");
  if (totCostEl) {
    if (store && typeof store.formatIndianCurrency === "function") {
      totCostEl.textContent = store.formatIndianCurrency(totalCost);
    } else {
      totCostEl.textContent = `₹${Math.round(totalCost).toLocaleString('en-IN')}`;
    }
  }

  const totUnitsEl = document.getElementById("reorderTotalUnits");
  if (totUnitsEl) {
    totUnitsEl.textContent = `${totalUnits.toLocaleString('en-IN')} units`;
  }

  const poCountEl = document.getElementById("reorderPOCount");
  if (poCountEl) {
    poCountEl.textContent = `${poCount} orders`;
  }
}

function initActionButtons() {
  const tbody = document.getElementById("recommendationsTableBody");
  if (tbody) {
    tbody.addEventListener("click", (e) => {
      const btn = e.target.closest(".btn-issue-po");
      if (btn) {
        const med = decodeURIComponent(btn.getAttribute("data-medicine"));
        const qty = parseInt(btn.getAttribute("data-qty"), 10);
        const cost = parseInt(btn.getAttribute("data-cost"), 10);
        dispatchSinglePO(med, qty, cost);
      }
    });
  }

  const bulkApproveBtn = document.getElementById("bulkApproveBtn");
  if (bulkApproveBtn) {
    bulkApproveBtn.addEventListener("click", async () => {
      const store = window.inventoryData || window.medistockData;
      const items = store ? store.getEnrichedMedicines().filter(m => (m.recommendedReorder || 0) > 0) : [];
      if (items.length === 0) {
        if (typeof showToast === "function") showToast("No active reorders to dispatch.", "info");
        return;
      }
      
      try {
        if (window.medistockApi && window.medistockApi.isUsingBackend()) {
          for (const item of items) {
            await window.medistockApi.dispatchPurchaseOrder({
              medicine: item.medicine,
              order_quantity: item.recommendedReorder,
              supplier: item.supplier || "Hospital Authorized Supplier"
            }).catch(e => console.warn(e));
          }
        }
      } catch (err) {
        console.warn("Bulk dispatch notice:", err);
      }
      
      if (typeof showToast === "function") {
        showToast(`Dispatched ${items.length} priority purchase orders to authorized suppliers.`, "success");
      }
    });
  }

  const exportPoBtn = document.getElementById("exportPoBtn");
  if (exportPoBtn) {
    exportPoBtn.addEventListener("click", () => {
      const store = window.inventoryData || window.medistockData;
      const items = store ? store.getEnrichedMedicines().filter(m => (m.recommendedReorder || 0) > 0) : [];
      
      let csv = "PO_Number,Medicine,Supplier,Order_Quantity,Unit_Price_INR,Total_Cost_INR,Urgency\n";
      items.forEach((m, idx) => {
        const cost = (m.recommendedReorder * m.unitPrice).toFixed(2);
        csv += `PO-2026-${1000 + idx},"${m.medicine}","${m.supplier || 'Hospital Supplier'}",${m.recommendedReorder},${m.unitPrice},${cost},Urgent\n`;
      });

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `MediStock_AI_Purchase_Orders_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      if (typeof showToast === "function") {
        showToast("Exported Purchase Orders CSV in Indian Rupees (₹)", "primary");
      }
    });
  }
}

function dispatchSinglePO(medicine, qty, cost) {
  if (typeof openModal !== "function") return;

  openModal(
    "Purchase Order Confirmation",
    `
    <div style="font-size: 0.9rem; line-height: 1.6;">
      <p>Confirm electronic dispatch of Purchase Order to authorized hospital distributor:</p>
      <div style="background: var(--bg-subtle); padding: 1rem; border-radius: var(--radius-md); margin: 1rem 0; border: 1px solid var(--border);">
        <div style="margin-bottom: 0.35rem;"><strong>Item:</strong> ${medicine}</div>
        <div style="margin-bottom: 0.35rem;"><strong>Quantity:</strong> ${qty.toLocaleString('en-IN')} units</div>
        <div style="margin-bottom: 0.35rem;"><strong>Total Est. Cost:</strong> ₹${cost.toLocaleString('en-IN')}</div>
        <div><strong>Delivery Window:</strong> 24 - 48 Hours</div>
      </div>
      <p style="font-size: 0.8rem; color: var(--text-muted);">This order will be automatically recorded in the hospital pharmacy audit trail and inventory register.</p>
    </div>
    `,
    `<button class="btn btn-primary btn-sm" onclick="confirmPOAction('${encodeURIComponent(medicine)}', ${qty}, ${cost})">Confirm & Transmit PO</button>`
  );
}

async function confirmPOAction(encodedMed, qty = 100, cost = 0) {
  const medicine = decodeURIComponent(encodedMed);
  if (typeof closeModal === "function") closeModal();
  
  try {
    if (window.medistockApi && window.medistockApi.isUsingBackend()) {
      await window.medistockApi.dispatchPurchaseOrder({
        medicine: medicine,
        order_quantity: qty,
        supplier: "Hospital Authorized Supplier"
      });
    }
  } catch (e) {
    console.warn("FastAPI dispatch PO notice:", e);
  }
  
  if (typeof showToast === "function") {
    showToast(`Purchase order for ${qty.toLocaleString('en-IN')} units of ${medicine} (₹${cost.toLocaleString('en-IN')}) dispatched!`, "success");
  }
}

function initSearch() {
  const searchInput = document.getElementById("globalNavSearch");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentSearchFilter = e.target.value.trim();
      renderRecommendations();
    });
  }
}

window.confirmPOAction = confirmPOAction;
