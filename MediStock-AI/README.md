# MediStock AI - Hospital Medicine Inventory Management System

**MediStock AI** is an enterprise-grade AI-powered hospital medicine inventory management platform designed for hospital pharmacies, ICU procurement officers, and healthcare supply chain directors.

---

## 🔄 End-to-End Workflow

```
Upload ➔ Analyse ➔ Predict ➔ Compare ➔ Detect ➔ Recommend ➔ Explain
```

1. **Upload**: Drag-and-drop ingestion of hospital dispensing logs (`Medicine, Jan, Feb, Mar, Apr, Current_Stock`).
2. **Analyse**: Historical 4-month consumption velocity, surge metrics, and Month-over-Month (MoM) growth rates.
3. **Predict**: Machine learning forecasting models (XGBoost, Prophet, ARIMA) projecting demand for May & June.
4. **Compare**: Side-by-side evaluation of on-hand inventory vs. forecasted requirements.
5. **Detect**: Automated classification into **🔴 Shortage**, **🟢 Stable**, or **🟡 Overstock** with lead-time vulnerability checks.
6. **Recommend**: Automated Economic Order Quantity (EOQ) purchase order generation with urgency tiers.
7. **Explain**: AI clinical rationales detailing why specific reorders are needed.

---

## 📁 Project Directory Structure

```
MediStock-AI/
├── frontend/                   # Responsive Frontend Application (HTML/CSS/JS)
│   ├── index.html              # Entry point redirecting to dashboard
│   ├── login.html              # 1. Login (Healthcare Role Selector)
│   ├── signup.html             # 2. Sign Up (Hospital Facility Registration)
│   ├── dashboard.html          # 3. Main Dashboard (6 KPIs + 4 Chart.js Charts)
│   ├── upload.html             # 4. Upload CSV (Drag-and-drop & live preview)
│   ├── inventory.html          # 5. Inventory Table (Status 🔴🟢🟡 & AI Explain)
│   ├── demand-analysis.html    # 6. Demand Analysis (MoM trends & velocity)
│   ├── ai-prediction.html      # 7. AI Prediction (Forecasting May/June & MAPE)
│   ├── risk-analysis.html      # 8. Risk Analysis (DOI & Stockout Probability)
│   ├── recommendations.html    # 9. AI Recommendations (Automated PO generation)
│   ├── reports.html            # 10. Reports (Executive audit & CSV/Print)
│   ├── css/
│   │   ├── main.css            # Design tokens, Blue & Teal theme, buttons, modals
│   │   ├── auth.css            # Split-screen authentication layouts
│   │   ├── dashboard.css       # KPI widgets & chart containers
│   │   └── responsive.css      # Off-canvas mobile navigation & media queries
│   ├── js/
│   │   ├── data.js             # Central hospital formulary store & simulation
│   │   ├── app.js              # Global navigation, mobile drawer & modals
│   │   ├── charts.js           # Chart.js initialization & responsive palettes
│   │   ├── upload.js           # CSV parser, validation & local storage sync
│   │   ├── inventory.js        # Search, risk filters & AI explanation popup
│   │   ├── demand.js           # Demand trajectory calculations
│   │   ├── prediction.js       # ML model selector & confidence intervals
│   │   ├── risk.js             # Days-of-Inventory (DOI) & lead-time checks
│   │   ├── recommendations.js  # Smart Purchase Orders & EOQ calculations
│   │   └── reports.js          # Audit summaries, print stylesheet & export
│   └── assets/
│       └── sample_medicines.csv # Ready-to-test CSV matching required schema
├── backend/                    # Python FastAPI Architecture Specification
│   └── README.md               # API endpoints, Pydantic schemas, ML pipeline guide
└── README.md                   # This project guide
```

---

## 🚀 How to Run the Frontend

No build tools or Node.js packages required! The project uses pure standard HTML, CSS, and modern JavaScript.

### Method 1: Direct File Opening
Double-click `frontend/dashboard.html` or `frontend/login.html` in your file explorer to open it directly in any modern browser (Chrome, Edge, Firefox, Safari).

### Method 2: Local HTTP Server (Recommended)
From the project root:

```bash
# Using Python
cd frontend
python -m http.server 8000
```

Then visit: `http://localhost:8000/dashboard.html`

---

## 📊 Core Features & UI Highlights

- **Dashboard**:
  - 6 Key Stat Cards: Total Medicines, Low Stock, Stable Stock, Overstock, Predicted Demand, Inventory Value.
  - 4 Interactive Charts:
    - Monthly Medicine Demand (Historical + Dotted AI projection)
    - Current Stock vs Predicted Demand (Bar comparison)
    - Risk Distribution (Doughnut chart)
    - Top Medicines by Demand (Horizontal bar chart)
- **CSV Ingestion**:
  - Drag-and-drop or file upload supporting `Medicine, Jan, Feb, Mar, Apr, Current_Stock`.
  - Live summary: File name, item count, validation status, and 10-row preview table.
  - 1-Click "Synchronize Into Inventory Table" to update the live system with your uploaded data.
- **Inventory & Clinical Explain**:
  - Columns: `Medicine | Current Stock | Predicted Demand | Risk | Recommended Reorder | Actions`.
  - Risk Badges: 🔴 Shortage, 🟢 Stable, 🟡 Overstock.
  - Verified example:
    - **Paracetamol 500mg**: Predicted Demand = 800 | Current Stock = 300 | Recommended Reorder = 500 | Risk = 🔴 Shortage.
    - AI Explanation: *"Demand has increased continuously over the previous months, while current stock is insufficient to meet the predicted requirement."*
- **Theme**:
  - Professional Blue (`#0284c7`) and Healthcare Teal (`#0d9488`).
  - Crisp light background (`#f8fafc`).
  - Inter & Plus Jakarta Sans typography.
  - Lucide icons for medical symbols.
  - Full mobile and tablet responsiveness with collapsible drawer.
