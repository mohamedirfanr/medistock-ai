"""AI Time-Series Demand Forecasting Endpoints."""

from typing import Dict, Any, Optional
from fastapi import APIRouter, Query
from pydantic import BaseModel
from app.ml.forecaster import forecaster
from app.models.database import db

router = APIRouter(prefix="/forecast", tags=["AI Forecasting"])


class ForecastPayload(BaseModel):
    model: str = "xgboost"
    horizon_months: int = 2


@router.post("/predict")
def predict_demand_post(payload: ForecastPayload) -> Dict[str, Any]:
    """Generates demand forecasts using ML models (XGBoost, Prophet, ARIMA, LSTM)."""
    return _generate_forecast(payload.model, payload.horizon_months)


@router.get("/predict")
def predict_demand_get(
    model: str = Query(default="xgboost", description="ML model identifier"),
    horizon_months: int = Query(default=2, description="Projection horizon in months"),
) -> Dict[str, Any]:
    """GET endpoint variant for quick inspection and browser evaluation."""
    return _generate_forecast(model, horizon_months)


def _generate_forecast(model: str, horizon_months: int) -> Dict[str, Any]:
    items = db.get_all()
    predictions = [
        forecaster.forecast_horizon(item, model=model, horizon_months=horizon_months)
        for item in items
    ]
    metrics = forecaster.get_model_metrics(model)

    return {
        "status": "success",
        "model_used": model,
        "metrics": metrics,
        "horizon_months": horizon_months,
        "total_items": len(predictions),
        "predictions": predictions,
    }
