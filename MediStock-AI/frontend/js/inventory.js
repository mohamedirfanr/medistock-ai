/**
 * MediStock AI - Inventory Table Controller
 * Manages the main medicine inventory grid, risk badges (🔴 Shortage, 🟢 Stable, 🟡 Overstock),
 * AI explanation modals, live search, and reorder dispatch.
 * 
 * Synchronized with central InventoryDataStore as single source of truth.
 */

let activeFilter = "all";
let searchQuery = "";
let currentPage = 1;
let pageSize = 50; // Options: 25, 50, 100, "all"

document.addEventListener("DOMContentLoaded", async () => {
  initTableControls();
  await renderInventoryTable();

  // Subscribe to central store updates for automatic reactivity
  if (window.inventoryData && typeof window.inventoryData.subscribe === "function") {
    window.inventoryData.subscribe(() => {
      renderInventoryTable();
    });
  }
});

function initTableControls() {
  const searchInput = document.getElementById("inventorySearch");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      currentPage = 1;
      renderInventoryTable();
    });
  }

  const filterChips = document.querySelectorAll(".filter-chip");
  filterChips.forEach(chip => {
    chip.addEventListener("click", () => {
      filterChips.forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      activeFilter = chip.getAttribute("data-filter");
      currentPage = 1;
      renderInventoryTable();
    });
  });

  const resetBtn = document.getElementById("resetInventoryBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      if (confirm("Reset inventory to hospital default dataset?")) {
        if (window.medistockApi) {
          await window.medistockApi.resetToDefault();
        }
        await renderInventoryTable();
        showToast("Inventory reset to default catalogue.", "primary");
      }
    });
  }

  // Event delegation for explain buttons inside the table
  const tbody = document.getElementById("inventoryTableBody");
  if (tbody) {
    tbody.addEventListener("click", (e) => {
      const explainBtn = e.target.closest(".btn-explain-action");
      if (explainBtn) {
        const medName = decodeURIComponent(explainBtn.getAttribute("data-medicine"));
        showAIExplanationModal(medName);
      }
    });
  }
}

/**
 * Updates the Featured Clinical AI Diagnostic banner at the top of the inventory page
 * Uses the exact same single-source-of-truth object rendered in the comparison table!
 */
function updateFeaturedDiagnosticCard(allItems) {
  const store = window.inventoryData;
  if (!store) return;

  // Prioritize Paracetamol 500mg, or fallback to the top active shortage
  const paracetamol = store.getMedicine("Paracetamol") || 
                      allItems.find(m => m.riskLevel === "Shortage") || 
                      allItems[0];

  if (!paracetamol) return;

  const titleEl = document.getElementById("featuredMedTitle");
  if (titleEl) titleEl.innerHTML = `Featured Clinical AI Diagnostic &bull; ${paracetamol.medicine}`;

  const expEl = document.getElementById("featuredExplanation");
  if (expEl) expEl.innerHTML = `<strong>AI Explanation:</strong> "${paracetamol.explanation}"`;

  const predEl = document.getElementById("featuredPredDemand");
  if (predEl) predEl.textContent = store.formatUnits(paracetamol.predictedDemand);

  const stockEl = document.getElementById("featuredStock");
  if (stockEl) stockEl.textContent = store.formatUnits(paracetamol.currentStock);

  const reorderEl = document.getElementById("featuredReorder");
  if (reorderEl) reorderEl.textContent = `+${store.formatUnits(paracetamol.recommendedReorder)}`;

  const badgeEl = document.getElementById("featuredRiskBadge");
  if (badgeEl) {
    badgeEl.className = `badge ${paracetamol.riskBadgeClass}`;
    badgeEl.textContent = `${paracetamol.riskIcon} ${paracetamol.riskLevel}`;
  }

  const btnEl = document.getElementById("featuredDiagnosticBtn");
  if (btnEl) {
    btnEl.setAttribute("onclick", `showAIExplanationModal('${encodeURIComponent(paracetamol.medicine)}')`);
  }
}

async function renderInventoryTable() {
  const tbody = document.getElementById("inventoryTableBody");
  if (!tbody) return;

  let allItems = [];
  if (window.medistockApi) {
    allItems = await window.medistockApi.getInventory();
  } else if (window.inventoryData) {
    allItems = window.inventoryData.getItems();
  }

  // Update Featured Diagnostic Banner from identical items
  updateFeaturedDiagnosticCard(allItems);
  
  // Filter logic
  const filtered = allItems.filter(item => {
    const matchesSearch = item.medicine.toLowerCase().includes(searchQuery) ||
                          (item.category && item.category.toLowerCase().includes(searchQuery));
    
    if (!matchesSearch) return false;
    if (activeFilter === "all") return true;
    return item.riskLevel.toLowerCase() === activeFilter.toLowerCase();
  });

  // Update counts
  const totalCountEl = document.getElementById("filteredCount");
  if (totalCountEl) totalCountEl.textContent = `${filtered.length} of ${allItems.length} medicines`;

  tbody.innerHTML = "";
  const paginationContainer = document.getElementById("inventoryPagination");

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 3rem; color: var(--text-muted);">
          <i data-lucide="package-search" style="width: 36px; height: 36px; margin: 0 auto 0.5rem; display: block;"></i>
          No medicines found matching your criteria.
        </td>
      </tr>
    `;
    if (paginationContainer) paginationContainer.innerHTML = "";
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  // Pagination calculations
  const totalItems = filtered.length;
  const effectivePageSize = pageSize === "all" ? totalItems : parseInt(pageSize, 10);
  const totalPages = Math.max(1, Math.ceil(totalItems / effectivePageSize));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const startIdx = pageSize === "all" ? 0 : (currentPage - 1) * effectivePageSize;
  const endIdx = pageSize === "all" ? totalItems : Math.min(startIdx + effectivePageSize, totalItems);
  const pageItems = filtered.slice(startIdx, endIdx);

  pageItems.forEach(item => {
    const tr = document.createElement("tr");

    // Risk badge styling
    let riskBadge = `<span class="badge ${item.riskBadgeClass}">${item.riskIcon} ${item.riskLevel}</span>`;

    // Recommended Reorder formatting (strictly max(predicted_demand - current_stock, 0))
    const reorderBadge = item.recommendedReorder > 0
      ? `<span style="font-weight: 700; color: var(--danger);">+${item.recommendedReorder.toLocaleString('en-IN')} units</span>`
      : `<span style="color: var(--text-muted);">0 (Adequate)</span>`;

    tr.innerHTML = `
      <td>
        <div style="display: flex; flex-direction: column;">
          <strong style="color: var(--text-main); font-size: 0.92rem;">${item.medicine}</strong>
          <span style="font-size: 0.75rem; color: var(--text-muted);">${item.category}</span>
        </div>
      </td>
      <td>
        <strong>${item.currentStock.toLocaleString('en-IN')}</strong>
        <span style="font-size: 0.75rem; color: var(--text-muted);"> units</span>
      </td>
      <td>
        <strong style="color: var(--primary);">${item.predictedDemand.toLocaleString('en-IN')}</strong>
        <span style="font-size: 0.75rem; color: var(--text-muted);"> units</span>
      </td>
      <td>${riskBadge}</td>
      <td>${reorderBadge}</td>
      <td>
        <div style="display: flex; gap: 0.4rem; align-items: center;">
          <button class="btn btn-outline btn-sm btn-explain-action" data-medicine="${encodeURIComponent(item.medicine)}">
            <i data-lucide="sparkles" style="width: 14px; height: 14px; color: var(--secondary);"></i> Explain
          </button>
          ${item.recommendedReorder > 0 ? `
            <a href="recommendations.html" class="btn btn-primary btn-sm">
              <i data-lucide="shopping-cart" style="width: 14px; height: 14px;"></i> Reorder
            </a>
          ` : `
            <button class="btn btn-outline btn-sm" disabled style="opacity: 0.5; cursor: default;">
              Optimal
            </button>
          `}
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });

  renderPaginationControls(paginationContainer, totalItems, startIdx, endIdx, totalPages);

  if (window.lucide) window.lucide.createIcons();
}

function renderPaginationControls(container, totalItems, startIdx, endIdx, totalPages) {
  if (!container) return;

  let pageButtonsHtml = "";
  const maxButtons = 5;
  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
  if (endPage - startPage < maxButtons - 1) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  for (let p = startPage; p <= endPage; p++) {
    pageButtonsHtml += `
      <button class="btn btn-sm ${p === currentPage ? 'btn-primary' : 'btn-outline'} pagination-page-btn" data-page="${p}" style="min-width: 32px; padding: 0.25rem 0.5rem; font-weight: ${p === currentPage ? '700' : '500'};">
        ${p}
      </button>
    `;
  }

  container.innerHTML = `
    <div style="display: flex; align-items: center; gap: 0.5rem;">
      <span>Showing <strong>${startIdx + 1}</strong>–<strong>${endIdx}</strong> of <strong>${totalItems}</strong> medicines</span>
    </div>
    <div style="display: flex; align-items: center; gap: 0.35rem;">
      <button class="btn btn-outline btn-sm" id="prevPageBtn" ${currentPage <= 1 ? 'disabled style="opacity: 0.5; cursor: default;"' : ''}>
        &laquo; Prev
      </button>
      ${startPage > 1 ? '<span style="padding: 0 0.25rem;">...</span>' : ''}
      ${pageButtonsHtml}
      ${endPage < totalPages ? '<span style="padding: 0 0.25rem;">...</span>' : ''}
      <button class="btn btn-outline btn-sm" id="nextPageBtn" ${currentPage >= totalPages ? 'disabled style="opacity: 0.5; cursor: default;"' : ''}>
        Next &raquo;
      </button>
    </div>
    <div style="display: flex; align-items: center; gap: 0.5rem;">
      <label for="pageSizeSelect" style="font-size: 0.82rem; color: var(--text-secondary); margin: 0;">Show:</label>
      <select id="pageSizeSelect" style="padding: 0.25rem 0.5rem; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 0.82rem; background: #fff; color: var(--text-main);">
        <option value="25" ${pageSize == 25 ? 'selected' : ''}>25</option>
        <option value="50" ${pageSize == 50 ? 'selected' : ''}>50</option>
        <option value="100" ${pageSize == 100 ? 'selected' : ''}>100</option>
        <option value="all" ${pageSize === 'all' ? 'selected' : ''}>All (${totalItems})</option>
      </select>
    </div>
  `;

  // Attach event handlers
  const prevBtn = document.getElementById("prevPageBtn");
  if (prevBtn && currentPage > 1) {
    prevBtn.addEventListener("click", () => {
      currentPage--;
      renderInventoryTable();
    });
  }

  const nextBtn = document.getElementById("nextPageBtn");
  if (nextBtn && currentPage < totalPages) {
    nextBtn.addEventListener("click", () => {
      currentPage++;
      renderInventoryTable();
    });
  }

  const pageBtns = container.querySelectorAll(".pagination-page-btn");
  pageBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      const p = parseInt(e.currentTarget.getAttribute("data-page"), 10);
      if (p !== currentPage) {
        currentPage = p;
        renderInventoryTable();
      }
    });
  });

  const select = document.getElementById("pageSizeSelect");
  if (select) {
    select.addEventListener("change", (e) => {
      pageSize = e.target.value === "all" ? "all" : parseInt(e.target.value, 10);
      currentPage = 1;
      renderInventoryTable();
    });
  }
}

/**
 * Renders interactive AI explanation modal using single central object
 */
function showAIExplanationModal(encodedOrRawName) {
  const medicineName = decodeURIComponent(encodedOrRawName);
  const store = window.inventoryData;
  const item = store ? store.getMedicine(medicineName) : null;
  if (!item) return;

  const content = `
    <div style="display: flex; flex-direction: column; gap: 1.25rem;">
      <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-subtle); padding: 1rem; border-radius: var(--radius-md);">
        <div>
          <h4 style="margin: 0; font-size: 1.1rem; color: var(--text-main);">${item.medicine}</h4>
          <span style="font-size: 0.8rem; color: var(--text-muted);">${item.category} &bull; Supplier: ${item.supplier || "PharmaCore Labs"}</span>
        </div>
        <div>
          <span class="badge ${item.riskBadgeClass}">${item.riskIcon} ${item.riskLevel}</span>
        </div>
      </div>

      <div class="ai-insight-box" style="margin-bottom: 0;">
        <div class="ai-icon-circle">
          <i data-lucide="bot" style="width: 22px; height: 22px;"></i>
        </div>
        <div class="ai-content">
          <h4>AI Clinical Forecast Rationale</h4>
          <p style="font-size: 0.95rem; font-weight: 500; color: #1e293b; line-height: 1.5;">
            "${item.explanation}"
          </p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; text-align: center;">
        <div style="background: #f8fafc; border: 1px solid var(--border); border-radius: var(--radius-md); padding: 0.85rem;">
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Current Stock</div>
          <div style="font-size: 1.35rem; font-weight: 800; color: var(--text-main); margin-top: 0.25rem;">${item.currentStock.toLocaleString('en-IN')}</div>
        </div>
        <div style="background: #f8fafc; border: 1px solid var(--border); border-radius: var(--radius-md); padding: 0.85rem;">
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Predicted Demand</div>
          <div style="font-size: 1.35rem; font-weight: 800; color: var(--primary); margin-top: 0.25rem;">${item.predictedDemand.toLocaleString('en-IN')}</div>
        </div>
        <div style="background: #f8fafc; border: 1px solid var(--border); border-radius: var(--radius-md); padding: 0.85rem;">
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Recommended Reorder</div>
          <div style="font-size: 1.35rem; font-weight: 800; color: ${item.recommendedReorder > 0 ? 'var(--danger)' : 'var(--success)'}; margin-top: 0.25rem;">
            ${item.recommendedReorder > 0 ? '+' : ''}${item.recommendedReorder.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      <div style="background: #fff; border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1rem;">
        <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 0.5rem;">Historical 4-Month Trend:</div>
        <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
          <span>Jan: <strong>${item.jan.toLocaleString('en-IN')}</strong></span>
          <span>Feb: <strong>${item.feb.toLocaleString('en-IN')}</strong></span>
          <span>Mar: <strong>${item.mar.toLocaleString('en-IN')}</strong></span>
          <span>Apr: <strong>${item.apr.toLocaleString('en-IN')}</strong></span>
          <span style="color: var(--secondary); font-weight: 700;">Forecast: <strong>${item.predictedDemand.toLocaleString('en-IN')}</strong></span>
        </div>
      </div>
    </div>
  `;

  const footerAction = item.recommendedReorder > 0
    ? `<a href="recommendations.html" class="btn btn-primary btn-sm">Proceed to Reorder (+${item.recommendedReorder.toLocaleString('en-IN')} units)</a>`
    : ``;

  openModal("AI Demand & Stock Diagnostic", content, footerAction);
}

window.showAIExplanationModal = showAIExplanationModal;
