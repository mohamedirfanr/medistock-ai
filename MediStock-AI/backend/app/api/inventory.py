"""Hospital Medicine Inventory & Clinical Rationale Endpoints."""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Query, status
from app.models.database import db

router = APIRouter(tags=["Inventory"])


@router.get("/inventory")
def get_inventory(
    search: Optional[str] = Query(default=None, description="Search by medicine name or category"),
    risk: Optional[str] = Query(default=None, description="Filter by risk (Shortage, Stable, Overstock)"),
) -> List[Dict[str, Any]]:
    """
    Returns full medicine inventory table:
    Medicine | Current Stock | Predicted Demand | Risk | Recommended Reorder
    """
    items = db.get_all()

    if search:
        q = search.lower().strip()
        items = [
            m for m in items
            if q in m["medicine"].lower() or q in m.get("category", "").lower()
        ]

    if risk:
        r = risk.lower().strip()
        items = [m for m in items if m["risk_level"].lower() == r]

    return items


@router.get("/inventory/{medicine_id}/rationale")
def get_medicine_rationale(medicine_id: str) -> Dict[str, Any]:
    """
    Returns specific AI clinical explanation and diagnostic for a medicine.
    Example: Paracetamol 500mg returns:
    "Demand has increased continuously over the previous months, while current stock is insufficient to meet the predicted requirement."
    """
    item = db.get_by_id(medicine_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Medicine '{medicine_id}' not found in hospital inventory.",
        )

    return {
        "medicine_id": item["id"],
        "medicine": item["medicine"],
        "category": item["category"],
        "current_stock": item["current_stock"],
        "currentStock": item["current_stock"],
        "predicted_demand": item["predicted_demand"],
        "predictedDemand": item["predicted_demand"],
        "risk_level": item["risk_level"],
        "riskLevel": item["risk_level"],
        "risk_icon": item["risk_icon"],
        "recommended_reorder": item["recommended_reorder"],
        "recommendedReorder": item["recommended_reorder"],
        "explanation": item["explanation"],
        "lead_time_days": item.get("lead_time_days", 5),
        "supplier": item.get("supplier", "PharmaCore Labs"),
    }


@router.get("/dashboard/kpis")
def get_dashboard_kpis() -> Dict[str, Any]:
    """
    Returns the 6 primary hospital inventory KPIs:
    Total Medicines, Low Stock, Stable Stock, Overstock, Predicted Demand, Inventory Value.
    """
    return db.get_kpis()
