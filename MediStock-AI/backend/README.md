# MediStock AI - Backend Architecture (Python FastAPI)

This directory is prepared for connecting the **MediStock AI** frontend to a high-performance Python FastAPI backend and AI/ML time-series demand forecasting models.

---

## Proposed Backend Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI application entry point & CORS configuration
│   ├── config.py               # Application settings, database URLs, ML parameters
│   ├── api/
│   │   ├── __init__.py
│   │   ├── auth.py             # Hospital JWT authentication & role-based access
│   │   ├── upload.py           # Ingestion endpoint for CSV file parsing & validation
│   │   ├── inventory.py        # Real-time stock CRUD and formulary database
│   │   ├── forecast.py         # AI prediction endpoints (ARIMA, Prophet, XGBoost)
│   │   └── recommendations.py  # Automated purchase order (PO) generation
│   ├── models/
│   │   ├── schemas.py          # Pydantic schemas (MedicineRecord, DemandForecast, RiskAssessment)
│   │   └── database.py         # SQLAlchemy or MongoDB models
│   ├── ml/
│   │   ├── __init__.py
│   │   ├── forecaster.py       # ML Pipeline for time-series forecasting
│   │   ├── risk_engine.py      # Stockout probability & days of inventory calculation
│   │   └── trained_models/     # Serialized model artifacts (.pkl or .onnx)
│   └── utils/
│       └── csv_validator.py    # Schema verification for Medicine, Jan, Feb, Mar, Apr, Current_Stock
├── requirements.txt            # Python dependencies
└── Dockerfile                  # Containerized deployment
```

---

## Planned API Endpoints Contract

### 1. Ingestion & Validation
- `POST /api/upload/csv`
  - Accepts: Multipart `file` (.csv)
  - Required headers: `Medicine, Jan, Feb, Mar, Apr, Current_Stock`
  - Returns: Record count, parsed items, schema validation status.

### 2. Inventory & Stock Status
- `GET /api/inventory`
  - Returns: List of all medicines with current stock, predicted demand, risk level (`Shortage`, `Stable`, `Overstock`), and recommended reorder quantity.

### 3. AI Predictive Modeling
- `POST /api/forecast/predict`
  - Body: `{ "model": "xgboost", "horizon_months": 2 }`
  - Returns: Projected demand for May and June, MAPE score, RMSE, and 95% Confidence Intervals.

### 4. AI Clinical Rationale
- `GET /api/inventory/{medicine_id}/rationale`
  - Returns: Dynamic explanation:
    *"Demand has increased continuously over the previous months, while current stock is insufficient to meet the predicted requirement."*

### 5. Automated Purchase Orders
- `GET /api/recommendations/purchase-orders`
  - Returns: Actionable purchase order recommendations with Economic Order Quantity (EOQ).
- `POST /api/recommendations/dispatch-po`
  - Body: `{ "order_ids": [...] }`
  - Dispatches orders to hospital ERP/distributors.

---

## Requirements (`requirements.txt`)

```text
fastapi>=0.110.0
uvicorn[standard]>=0.28.0
pydantic>=2.6.0
pandas>=2.2.0
numpy>=1.26.0
scikit-learn>=1.4.0
xgboost>=2.0.0
prophet>=1.1.5
python-multipart>=0.0.9
```
