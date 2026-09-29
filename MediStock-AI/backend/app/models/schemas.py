"""Pydantic schemas for MediStock AI REST APIs."""

from typing import List, Optional, Any, Dict
from pydantic import BaseModel, ConfigDict, Field


class MedicineBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    medicine: str
    category: str = "General Hospital Stock"
    unit_price: float = Field(default=2.50, alias="unitPrice")
    jan: int = 0
    feb: int = 0
    mar: int = 0
    apr: int = 0
    current_stock: int = Field(alias="currentStock")
    lead_time_days: int = Field(default=5, alias="leadTimeDays")
    supplier: str = "PharmaCore Labs"


class MedicineRecord(MedicineBase):
    id: str
    predicted_demand: int = Field(alias="predictedDemand")
    risk_level: str = Field(alias="riskLevel")
    risk_icon: str = Field(default="🟢", alias="riskIcon")
    risk_badge_class: str = Field(default="badge-success", alias="riskBadgeClass")
    recommended_reorder: int = Field(alias="recommendedReorder")
    explanation: str
    stock_value: float = Field(alias="stockValue")
    reorder_cost: float = Field(alias="reorderCost")


class UploadPreviewItem(BaseModel):
    medicine: str
    jan: int
    feb: int
    mar: int
    apr: int
    current_stock: int
    is_valid: bool = True


class UploadSummaryResponse(BaseModel):
    status: str
    file_name: str
    record_count: int
    validation_passed: bool
    validation_message: str
    preview: List[Dict[str, Any]]


class ForecastRequest(BaseModel):
    model: str = "xgboost"
    horizon_months: int = 2


class ForecastPredictionItem(BaseModel):
    medicine: str
    april_actual: int
    may_forecast: int
    june_forecast: int
    confidence_interval: List[int]
    confidence_pct: int
    stock_status: str


class ForecastResponse(BaseModel):
    model_used: str
    metrics: Dict[str, Any]
    predictions: List[ForecastPredictionItem]


class PurchaseOrderDispatch(BaseModel):
    medicine: str
    quantity: int
    supplier: Optional[str] = "PharmaCore Labs"
    estimated_cost: Optional[float] = 0.0


class PurchaseOrderResponse(BaseModel):
    status: str
    po_number: str
    medicine: str
    quantity: int
    estimated_cost: float
    timestamp: str


class DashboardKPIsResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    total_medicines: int = Field(alias="totalMedicines")
    low_stock: int = Field(alias="lowStock")
    stable_stock: int = Field(alias="stableStock")
    overstock: int = Field(alias="overstock")
    total_predicted_demand: int = Field(alias="totalPredictedDemand")
    total_inventory_value: int = Field(alias="totalInventoryValue")
    total_reorder_needed: int = Field(alias="totalReorderNeeded")


class RationaleResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    medicine_id: str
    medicine: str
    current_stock: int = Field(alias="currentStock")
    predicted_demand: int = Field(alias="predictedDemand")
    recommended_reorder: int = Field(alias="recommendedReorder")
    risk_level: str = Field(alias="riskLevel")
    explanation: str


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    timestamp: str
    inventory_count: int
