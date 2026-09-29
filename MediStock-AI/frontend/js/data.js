/**
 * MediStock AI - Central Inventory Data Store & State Engine
 * 
 * Single source of truth for all MediStock AI components.
 * Normalizes live FastAPI backend data and provides unified accessors,
 * Indian currency formatting (₹), dynamic risk evaluation, and subscriber notifications.
 */

const DEFAULT_MEDICINES = [
  {
    medicine: "Paracetamol 500mg",
    category: "Analgesics & Antipyretic",
    unitPrice: 1.25,
    jan: 450,
    feb: 520,
    mar: 610,
    apr: 720,
    currentStock: 300,
    manualPredicted: 800,
    leadTimeDays: 4,
    supplier: "PharmaCore Labs"
  },
  {
    medicine: "Amoxicillin 250mg",
    category: "Antibiotics",
    unitPrice: 3.50,
    jan: 320,
    feb: 310,
    mar: 290,
    apr: 280,
    currentStock: 650,
    manualPredicted: 270,
    leadTimeDays: 7,
    supplier: "BioMed Global"
  },
  {
    medicine: "Remdesivir 100mg",
    category: "Antivirals (ICU Critical)",
    unitPrice: 42.00,
    jan: 120,
    feb: 180,
    mar: 250,
    apr: 380,
    currentStock: 95,
    manualPredicted: 450,
    leadTimeDays: 10,
    supplier: "Apex Therapeutics"
  },
  {
    medicine: "Insulin Glargine",
    category: "Endocrinology",
    unitPrice: 28.50,
    jan: 410,
    feb: 430,
    mar: 425,
    apr: 440,
    currentStock: 430,
    manualPredicted: 445,
    leadTimeDays: 5,
    supplier: "NovoHealth Inc"
  },
  {
    medicine: "Propofol 1%",
    category: "Anesthesia (OR Supply)",
    unitPrice: 18.00,
    jan: 180,
    feb: 210,
    mar: 240,
    apr: 290,
    currentStock: 110,
    manualPredicted: 320,
    leadTimeDays: 3,
    supplier: "SurgiCare Pharma"
  },
  {
    medicine: "Azithromycin 500mg",
    category: "Antibiotics",
    unitPrice: 4.80,
    jan: 290,
    feb: 340,
    mar: 380,
    apr: 450,
    currentStock: 180,
    manualPredicted: 490,
    leadTimeDays: 6,
    supplier: "PharmaCore Labs"
  },
  {
    medicine: "Meropenem 1g",
    category: "Critical Care Antibiotics",
    unitPrice: 34.00,
    jan: 85,
    feb: 90,
    mar: 110,
    apr: 135,
    currentStock: 45,
    manualPredicted: 150,
    leadTimeDays: 8,
    supplier: "Apex Therapeutics"
  },
  {
    medicine: "Metformin 500mg",
    category: "Antidiabetic",
    unitPrice: 0.85,
    jan: 600,
    feb: 610,
    mar: 605,
    apr: 620,
    currentStock: 950,
    manualPredicted: 625,
    leadTimeDays: 4,
    supplier: "BioMed Global"
  },
  {
    medicine: "Atorvastatin 20mg",
    category: "Cardiovascular",
    unitPrice: 2.10,
    jan: 510,
    feb: 490,
    mar: 530,
    apr: 520,
    currentStock: 510,
    manualPredicted: 525,
    leadTimeDays: 5,
    supplier: "NovoHealth Inc"
  },
  {
    medicine: "Salbutamol Inhaler",
    category: "Respiratory",
    unitPrice: 8.50,
    jan: 220,
    feb: 280,
    mar: 350,
    apr: 420,
    currentStock: 130,
    manualPredicted: 480,
    leadTimeDays: 6,
    supplier: "AeroMed Healthcare"
  },
  {
    medicine: "Ceftriaxone 1g",
    category: "Antibiotics",
    unitPrice: 6.20,
    jan: 190,
    feb: 210,
    mar: 230,
    apr: 260,
    currentStock: 250,
    manualPredicted: 280,
    leadTimeDays: 5,
    supplier: "PharmaCore Labs"
  },
  {
    medicine: "Dexamethasone 4mg",
    category: "Corticosteroids",
    unitPrice: 2.80,
    jan: 310,
    feb: 360,
    mar: 420,
    apr: 510,
    currentStock: 140,
    manualPredicted: 560,
    leadTimeDays: 4,
    supplier: "BioMed Global"
  },
  {
    medicine: "Pantoprazole 40mg",
    category: "Gastroenterology",
    unitPrice: 1.95,
    jan: 550,
    feb: 540,
    mar: 560,
    apr: 570,
    currentStock: 880,
    manualPredicted: 580,
    leadTimeDays: 3,
    supplier: "PharmaCore Labs"
  },
  {
    medicine: "Enoxaparin 40mg",
    category: "Anticoagulants",
    unitPrice: 15.50,
    jan: 140,
    feb: 165,
    mar: 190,
    apr: 230,
    currentStock: 70,
    manualPredicted: 260,
    leadTimeDays: 7,
    supplier: "Apex Therapeutics"
  },
  {
    medicine: "Ondansetron 4mg",
    category: "Antiemetic",
    unitPrice: 3.10,
    jan: 240,
    feb: 250,
    mar: 245,
    apr: 260,
    currentStock: 450,
    manualPredicted: 265,
    leadTimeDays: 5,
    supplier: "SurgiCare Pharma"
  }
];

const STORAGE_KEY = "medistock_inventory_data";
const LAST_UPLOAD_INFO_KEY = "medistock_last_upload";
const LAST_SYNC_KEY = "medistock_last_sync_timestamp";

class InventoryDataStore {
  constructor() {
    this.subscribers = [];
    this.isLiveConnected = false;
    this.lastSyncTime = localStorage.getItem(LAST_SYNC_KEY) ? new Date(localStorage.getItem(LAST_SYNC_KEY)) : null;
    this.medicines = this.loadData();
    this.kpisCache = null;
  }

  /**
   * Load cached or default records and normalize
   */
  loadData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(item => this._normalizeItem(item));
        }
      } catch (e) {
        console.error("Failed to parse cached inventory data, resetting to default.", e);
      }
    }
    return DEFAULT_MEDICINES.map(item => this._normalizeItem(item));
  }

  /**
   * Strict medicine object normalization
   * Guarantees:
   * 1. Dual camelCase and snake_case support
   * 2. recommended_reorder = max(predicted_demand - current_stock, 0)
   * 3. Consistent risk assessment & clinical rationale
   */
  _normalizeItem(raw) {
    const medicine = raw.medicine || "Unnamed Formulary";
    const jan = Number(raw.jan) || 0;
    const feb = Number(raw.feb) || 0;
    const mar = Number(raw.mar) || 0;
    const apr = Number(raw.apr) || 0;
    const currentStock = Math.max(0, Number(raw.current_stock ?? raw.currentStock) || 0);

    // Calculate or preserve demand prediction
    let predictedDemand;
    if (raw.predicted_demand !== undefined && raw.predicted_demand !== null) {
      predictedDemand = Number(raw.predicted_demand);
    } else if (raw.predictedDemand !== undefined && raw.predictedDemand !== null) {
      predictedDemand = Number(raw.predictedDemand);
    } else if (raw.manual_predicted !== undefined && raw.manual_predicted !== null) {
      predictedDemand = Number(raw.manual_predicted);
    } else if (raw.manualPredicted !== undefined && raw.manualPredicted !== null) {
      predictedDemand = Number(raw.manualPredicted);
    } else {
      // 4-month velocity projection
      const slope = ((apr - jan) / 3.0) * 0.7 + (apr - mar) * 0.3;
      predictedDemand = Math.max(10, Math.round(apr + slope));
    }

    // STRICT SINGLE SOURCE OF TRUTH: recommended_reorder = max(predicted_demand - current_stock, 0)
    const recommendedReorder = Math.max(0, predictedDemand - currentStock);

    // Evaluate Risk Profile
    let riskLevel = "Stable";
    let riskIcon = "🟢";
    let riskBadgeClass = "badge-success";
    let riskColor = "#10b981";

    if (currentStock < predictedDemand) {
      riskLevel = "Shortage";
      riskIcon = "🔴";
      riskBadgeClass = "badge-danger";
      riskColor = "#ef4444";
    } else if (currentStock > 2 * predictedDemand) {
      riskLevel = "Overstock";
      riskIcon = "🟡";
      riskBadgeClass = "badge-warning";
      riskColor = "#f59e0b";
    } else {
      riskLevel = "Stable";
      riskIcon = "🟢";
      riskBadgeClass = "badge-success";
      riskColor = "#10b981";
    }

    const unitPrice = Number(raw.unit_price ?? raw.unitPrice) || 2.50;
    const stockValue = Math.round(currentStock * unitPrice * 100) / 100;
    const reorderCost = Math.round(recommendedReorder * unitPrice * 100) / 100;
    const leadTimeDays = Number(raw.lead_time_days ?? raw.leadTimeDays) || 5;
    const supplier = raw.supplier || "PharmaCore Labs";
    const category = raw.category || "General Hospital Stock";

    // Rich AI Clinical Explanation
    let explanation = raw.explanation;
    if (!explanation) {
      const dailyBurnRate = predictedDemand / 30.0;
      const daysCover = Math.round((currentStock / (dailyBurnRate || 1)) * 10) / 10;
      const momGrowth = Math.round(((apr - mar) / (mar || 1)) * 100);

      if (riskLevel === "Shortage") {
        if (medicine.toLowerCase().includes("paracetamol 500mg")) {
          explanation = "Demand has increased continuously over the previous months, while current stock is insufficient to meet the predicted requirement.";
        } else if (apr > mar && mar > feb && feb > jan) {
          explanation = `Demand has increased continuously over previous months (+${momGrowth}% Apr vs Mar), while current stock covers only ~${daysCover} days. Critical shortage expected without an immediate reorder of ${recommendedReorder} units.`;
        } else {
          explanation = `Predicted requirement of ${predictedDemand} units exceeds on-hand stock (${currentStock} units). Potential stockout projected within ${daysCover} days based on current burn rate.`;
        }
      } else if (riskLevel === "Overstock") {
        explanation = `Current stock of ${currentStock} units provides ~${daysCover} days of supply against a projected demand of ${predictedDemand} units. High risk of capital lock-in and shelf-life expiration; reorders should be placed on hold.`;
      } else {
        explanation = `Inventory levels are currently well-balanced. Stock of ${currentStock} units aligns with projected monthly demand of ${predictedDemand} units, providing an optimal ${daysCover}-day safety buffer.`;
      }
    }

    return {
      medicine,
      id: raw.id || medicine.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      jan,
      feb,
      mar,
      apr,
      currentStock,
      current_stock: currentStock,
      predictedDemand,
      predicted_demand: predictedDemand,
      recommendedReorder,
      recommended_reorder: recommendedReorder,
      riskLevel,
      risk_level: riskLevel,
      riskIcon,
      risk_icon: riskIcon,
      riskBadgeClass,
      risk_badge_class: riskBadgeClass,
      riskColor,
      unitPrice,
      unit_price: unitPrice,
      stockValue,
      stock_value: stockValue,
      reorderCost,
      reorder_cost: reorderCost,
      leadTimeDays,
      lead_time_days: leadTimeDays,
      supplier,
      category,
      explanation
    };
  }

  /**
   * Save and synchronize active medicine records
   */
  saveData(data, kpis = null) {
    if (!Array.isArray(data)) return;
    this.medicines = data.map(item => this._normalizeItem(item));
    this.kpisCache = kpis ? this._normalizeKPIs(kpis) : this._calculateKPIs();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.medicines));
    } catch (e) {
      console.warn("Could not save to localStorage:", e);
    }
    this.notifySubscribers();
  }

  /**
   * Return single authoritative medicine object matching query
   */
  getMedicine(query) {
    if (!query) return null;
    const q = query.toLowerCase().trim();
    return this.medicines.find(m => 
      m.medicine.toLowerCase().includes(q) || 
      m.id.toLowerCase() === q
    ) || null;
  }

  /**
   * Return all enriched medicine items
   */
  getItems() {
    return this.medicines;
  }

  // Alias for backward compatibility
  getEnrichedMedicines() {
    return this.getItems();
  }

  /**
   * Aggregate KPI metrics
   */
  _calculateKPIs() {
    const list = this.medicines;
    let lowStock = 0;
    let stableStock = 0;
    let overstock = 0;
    let totalPredictedDemand = 0;
    let totalInventoryValue = 0;
    let totalReorderNeeded = 0;

    list.forEach(item => {
      if (item.riskLevel === "Shortage") lowStock++;
      else if (item.riskLevel === "Stable") stableStock++;
      else if (item.riskLevel === "Overstock") overstock++;

      totalPredictedDemand += item.predictedDemand;
      totalInventoryValue += item.stockValue;
      totalReorderNeeded += item.recommendedReorder;
    });

    return {
      totalMedicines: list.length,
      total_medicines: list.length,
      lowStock,
      low_stock: lowStock,
      stableStock,
      stable_stock: stableStock,
      overstock,
      totalPredictedDemand,
      total_predicted_demand: totalPredictedDemand,
      totalInventoryValue: Math.round(totalInventoryValue),
      total_inventory_value: Math.round(totalInventoryValue),
      totalReorderNeeded,
      total_reorder_needed: totalReorderNeeded
    };
  }

  _normalizeKPIs(k) {
    const totalMedicines = Number(k.totalMedicines ?? k.total_medicines) || this.medicines.length;
    const lowStock = Number(k.lowStock ?? k.low_stock) || 0;
    const stableStock = Number(k.stableStock ?? k.stable_stock) || 0;
    const overstock = Number(k.overstock) || 0;
    const totalPredictedDemand = Number(k.totalPredictedDemand ?? k.total_predicted_demand) || 0;
    const totalInventoryValue = Number(k.totalInventoryValue ?? k.total_inventory_value) || 0;
    const totalReorderNeeded = Number(k.totalReorderNeeded ?? k.total_reorder_needed) || 0;

    return {
      totalMedicines,
      total_medicines: totalMedicines,
      lowStock,
      low_stock: lowStock,
      stableStock,
      stable_stock: stableStock,
      overstock,
      totalPredictedDemand,
      total_predicted_demand: totalPredictedDemand,
      totalInventoryValue,
      total_inventory_value: totalInventoryValue,
      totalReorderNeeded,
      total_reorder_needed: totalReorderNeeded
    };
  }

  getKPIs() {
    if (!this.kpisCache) {
      this.kpisCache = this._calculateKPIs();
    }
    return this.kpisCache;
  }

  // Alias for backward compatibility
  getDashboardKPIs() {
    return this.getKPIs();
  }

  /**
   * Currency & Unit Formatters
   */
  formatIndianCurrency(amount) {
    const val = Number(amount) || 0;
    if (val >= 10000000) {
      return `₹${(val / 10000000).toFixed(2)} Cr`;
    }
    if (val >= 100000) {
      return `₹${(val / 100000).toFixed(1)} Lakhs`;
    }
    return `₹${Math.round(val).toLocaleString("en-IN")}`;
  }

  formatUnits(val) {
    return `${Number(val || 0).toLocaleString("en-IN")} units`;
  }

  /**
   * Connection status and sync time
   */
  setLiveConnected(connected, timestamp = new Date()) {
    this.isLiveConnected = !!connected;
    if (timestamp) {
      this.lastSyncTime = timestamp instanceof Date ? timestamp : new Date(timestamp);
      try {
        localStorage.setItem(LAST_SYNC_KEY, this.lastSyncTime.toISOString());
      } catch (e) {}
    }
    this.notifySubscribers();
  }

  getLiveSyncStatus() {
    if (!this.isLiveConnected) {
      return {
        connected: false,
        statusText: "Offline Simulation",
        timeFormatted: this.lastSyncTime ? `Last Cached: ${this.lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "Using Local Cache"
      };
    }

    let timeFormatted = "Live Sync: Just now";
    if (this.lastSyncTime) {
      timeFormatted = `Live Sync: ${this.lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    }

    return {
      connected: true,
      statusText: "API Connected",
      timeFormatted
    };
  }

  invalidateCache() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LAST_UPLOAD_INFO_KEY);
      this.kpisCache = null;
    } catch (e) {}
  }

  resetToDefault() {
    this.medicines = DEFAULT_MEDICINES.map(item => this._normalizeItem(item));
    this.kpisCache = this._calculateKPIs();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.medicines));
      localStorage.removeItem(LAST_UPLOAD_INFO_KEY);
    } catch (e) {}
    this.notifySubscribers();
    return this.medicines;
  }

  setUploadInfo(info) {
    try {
      localStorage.setItem(LAST_UPLOAD_INFO_KEY, JSON.stringify(info));
    } catch (e) {}
  }

  getUploadInfo() {
    try {
      const raw = localStorage.getItem(LAST_UPLOAD_INFO_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  subscribe(callback) {
    if (typeof callback === "function") {
      this.subscribers.push(callback);
    }
  }

  notifySubscribers() {
    this.subscribers.forEach(cb => {
      try {
        cb(this.medicines, this.getKPIs());
      } catch (e) {
        console.error("Store subscriber error:", e);
      }
    });
  }
}

// Global Single Instance exposed under both names
window.inventoryData = new InventoryDataStore();
window.medistockData = window.inventoryData;
