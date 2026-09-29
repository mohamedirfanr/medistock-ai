/**
 * MediStock AI - Global Application Shell & UI Controller
 * Manages navigation, sidebar toggles, mobile drawers, modal dialogs, live badges,
 * API connection health indicator, and global search.
 */

document.addEventListener("DOMContentLoaded", async () => {
  initAppNavigation();
  initMobileMenu();
  initHeaderStatus();
  updateLiveBadges();
  initNotificationCenter();
  initGlobalSearch();
  initGlobalHotkeys();

  // Subscribe to live data updates from central store
  if (window.inventoryData) {
    window.inventoryData.subscribe(() => {
      updateLiveBadges();
      initHeaderStatus();
    });
  }

  // Attempt background sync with live FastAPI if enabled
  if (window.medistockApi && window.medistockApi.isUsingBackend()) {
    try {
      await window.medistockApi.syncStore();
    } catch (e) {
      console.warn("Background API sync notice:", e.message);
    }
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }
});

/**
 * Initializes and updates the live API connection badge & synchronization timestamp
 */
function initHeaderStatus() {
  const statusBadges = document.querySelectorAll(".api-status-badge");
  const syncTimeEls = document.querySelectorAll(".sync-timestamp-text");
  if (!window.inventoryData) return;

  const status = window.inventoryData.getLiveSyncStatus();

  statusBadges.forEach(badge => {
    if (status.connected) {
      badge.classList.remove("offline");
      badge.innerHTML = `<span class="status-pulse-dot"></span><span>${status.statusText}</span>`;
    } else {
      badge.classList.add("offline");
      badge.innerHTML = `<span class="status-pulse-dot"></span><span>${status.statusText}</span>`;
    }
  });

  syncTimeEls.forEach(el => {
    el.textContent = status.timeFormatted;
  });
}

/**
 * Automatically highlights current navigation link and workflow stepper
 */
function initAppNavigation() {
  const currentPath = window.location.pathname.split("/").pop() || "dashboard.html";
  const navLinks = document.querySelectorAll(".sidebar-nav .nav-item");

  navLinks.forEach(link => {
    const href = link.getAttribute("href");
    if (href === currentPath || (currentPath === "index.html" && href === "dashboard.html")) {
      link.classList.add("active");
    } else {
      link.classList.remove("active");
    }
  });

  // Highlight workflow stepper cleanly based on the 7-step sequence:
  // 1. Dashboard, 2. Upload CSV, 3. Analyse, 4. Predict, 5. Detect Risk, 6. Recommend, 7. Report
  const pageToWorkflowStep = {
    "dashboard.html": 1,
    "index.html": 1,
    "upload.html": 2,
    "demand-analysis.html": 3,
    "ai-prediction.html": 4,
    "risk-analysis.html": 5,
    "inventory.html": 5,
    "recommendations.html": 6,
    "reports.html": 7
  };

  const targetStepNumber = pageToWorkflowStep[currentPath];
  if (targetStepNumber) {
    const workflowSteps = document.querySelectorAll(".workflow-step");
    workflowSteps.forEach(step => {
      const numSpan = step.querySelector(".step-number");
      if (numSpan && parseInt(numSpan.textContent) === targetStepNumber) {
        step.classList.add("active");
      } else {
        step.classList.remove("active");
      }
    });
  }
}

/**
 * Mobile drawer sidebar toggle
 */
function initMobileMenu() {
  const toggleBtn = document.querySelector(".mobile-menu-btn");
  const sidebar = document.querySelector(".sidebar");
  let backdrop = document.querySelector(".sidebar-backdrop");

  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.className = "sidebar-backdrop";
    document.body.appendChild(backdrop);
  }

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("mobile-open");
      backdrop.classList.toggle("active");
    });

    backdrop.addEventListener("click", () => {
      sidebar.classList.remove("mobile-open");
      backdrop.classList.remove("active");
    });
  }
}

/**
 * Dynamic badge counters from central single store
 */
function updateLiveBadges() {
  if (!window.inventoryData) return;
  const kpis = window.inventoryData.getKPIs();
  
  // Icon button badges (numeric only)
  const iconBadges = document.querySelectorAll(".icon-badge.shortage-badge-count");
  iconBadges.forEach(badge => {
    badge.textContent = `${kpis.lowStock}`;
    badge.style.display = kpis.lowStock === 0 ? "none" : "flex";
  });

  // Sidebar text pill badges ("X alerts")
  const sidebarBadges = document.querySelectorAll(".nav-badge.shortage-badge-count");
  sidebarBadges.forEach(badge => {
    badge.textContent = `${kpis.lowStock} alerts`;
    badge.style.display = kpis.lowStock === 0 ? "none" : "inline-flex";
  });

  // Total medicines count badge on Inventory nav item
  const totalMedicinesBadges = document.querySelectorAll(".total-medicines-count");
  totalMedicinesBadges.forEach(badge => {
    badge.textContent = `${kpis.totalMedicines}`;
  });

  // Recommendations badge count
  const reorderBadges = document.querySelectorAll(".reorder-badge-count");
  reorderBadges.forEach(badge => {
    badge.textContent = `${kpis.lowStock} orders`;
    badge.style.display = kpis.lowStock === 0 ? "none" : "inline-flex";
  });
}

/**
 * Global Search in Topbar
 */
function initGlobalSearch() {
  const searchInputs = document.querySelectorAll(".quick-search input");
  const currentPath = window.location.pathname.split("/").pop() || "dashboard.html";

  // Check if there is a query in the URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const searchParam = urlParams.get("search");

  if (currentPath === "inventory.html" && searchParam) {
    const invInput = document.getElementById("inventorySearch");
    if (invInput) {
      invInput.value = decodeURIComponent(searchParam);
      invInput.dispatchEvent(new Event("input"));
    }
  }

  searchInputs.forEach(input => {
    if (currentPath === "inventory.html" && searchParam) {
      input.value = decodeURIComponent(searchParam);
    }

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const query = input.value.trim();
        if (currentPath === "inventory.html") {
          const invInput = document.getElementById("inventorySearch");
          if (invInput) {
            invInput.value = query;
            invInput.dispatchEvent(new Event("input"));
          }
        } else {
          window.location.href = `inventory.html?search=${encodeURIComponent(query)}`;
        }
      }
    });
  });
}

/**
 * Hotkeys for quick productivity (Ctrl+K for search, Esc to close modal)
 */
function initGlobalHotkeys() {
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      const search = document.querySelector(".quick-search input");
      if (search) search.focus();
    }
  });
}

/**
 * Global Toast Alert System
 */
function showToast(message, type = "primary", duration = 3500) {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  let iconName = "info";
  if (type === "success") iconName = "check-circle";
  if (type === "danger") iconName = "alert-circle";
  if (type === "warning") iconName = "alert-triangle";

  toast.innerHTML = `
    <i data-lucide="${iconName}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  if (window.lucide) window.lucide.createIcons();

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Notifications popover / modal
 */
function initNotificationCenter() {
  const notifBtn = document.getElementById("notifBtn");
  if (!notifBtn) return;

  notifBtn.addEventListener("click", () => {
    if (!window.inventoryData) return;
    const kpis = window.inventoryData.getKPIs();
    const shortages = window.inventoryData.getItems().filter(m => m.riskLevel === "Shortage");

    openModal(
      "Hospital Inventory Alerts",
      `
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <div style="background: var(--danger-light); padding: 0.85rem; border-radius: var(--radius-md); color: var(--danger-text); font-size: 0.85rem;">
          <strong>🔴 ${kpis.lowStock} Critical Stockout Risks Detected</strong><br>
          Immediate procurement attention is required to avoid ward shortages.
        </div>
        <div style="max-height: 250px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem;">
          ${shortages.map(item => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0.85rem; background: var(--bg-subtle); border-radius: var(--radius-sm); font-size: 0.82rem;">
              <div>
                <strong>${item.medicine}</strong>
                <div style="color: var(--text-muted); font-size: 0.75rem;">Current: ${item.currentStock.toLocaleString('en-IN')} | Predicted: ${item.predictedDemand.toLocaleString('en-IN')}</div>
              </div>
              <span class="badge badge-danger">+${item.recommendedReorder.toLocaleString('en-IN')} units</span>
            </div>
          `).join("")}
        </div>
      </div>
      `,
      `<a href="recommendations.html" class="btn btn-primary btn-sm">Review AI Recommendations</a>`
    );
  });
}

/**
 * Global Modal Dialog Helper
 */
function openModal(title, htmlBody, htmlFooterActions = "") {
  let modal = document.getElementById("appGlobalModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "appGlobalModal";
    modal.className = "modal-overlay";
    modal.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h3 id="appModalTitle"></h3>
          <button class="modal-close-btn" onclick="closeModal()">&times;</button>
        </div>
        <div class="modal-body" id="appModalBody"></div>
        <div class="modal-footer" id="appModalFooter"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  document.getElementById("appModalTitle").innerHTML = title;
  document.getElementById("appModalBody").innerHTML = htmlBody;
  
  const footer = document.getElementById("appModalFooter");
  footer.innerHTML = `
    <button class="btn btn-outline btn-sm" onclick="closeModal()">Close</button>
    ${htmlFooterActions}
  `;

  modal.classList.add("active");
  if (window.lucide) window.lucide.createIcons();
}

function closeModal() {
  const modal = document.getElementById("appGlobalModal");
  if (modal) modal.classList.remove("active");
}

window.openModal = openModal;
window.closeModal = closeModal;
window.showToast = showToast;
window.updateLiveBadges = updateLiveBadges;
