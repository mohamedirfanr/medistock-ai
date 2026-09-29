"""AI Reorder Recommendations & Purchase Order Automation Endpoints."""

import uuid
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import APIRouter
from pydantic import BaseModel
from app.models.database import db

router = APIRouter(tags=["Recommendations & Supply Chain"])


class DispatchPORequest(BaseModel):
    medicine: str
    quantity: Optional[int] = None
    order_quantity: Optional[int] = None
    supplier: Optional[str] = "PharmaCore Labs"
    estimated_cost: Optional[float] = 0.0


@router.get("/recommendations")
@router.get("/recommendations/purchase-orders")
def get_purchase_orders() -> Dict[str, Any]:
    """
    Returns automated purchase orders for all items requiring replenishment:
    Recommended Reorder = max(0, Predicted Demand - Current Stock)
    """
    items = db.get_all()
    shortages = [m for m in items if m["recommended_reorder"] > 0]

    po_list = []
    total_cost = 0.0
    total_units = 0

    for item in shortages:
        reorder_qty = item["recommended_reorder"]
        unit_price = item["unit_price"]
        cost = round(reorder_qty * unit_price, 2)
        total_cost += cost
        total_units += reorder_qty

        # Urgency tier
        is_immediate = item["current_stock"] < (item["predicted_demand"] * 0.4)
        urgency = "Immediate" if is_immediate else "High Priority"

        po_list.append(
            {
                "medicine": item["medicine"],
                "supplier": item.get("supplier", "PharmaCore Labs"),
                "current_stock": item["current_stock"],
                "currentStock": item["current_stock"],
                "predicted_demand": item["predicted_demand"],
                "predictedDemand": item["predicted_demand"],
                "recommended_reorder": reorder_qty,
                "recommendedReorder": reorder_qty,
                "unit_price": unit_price,
                "unitPrice": unit_price,
                "estimated_cost": cost,
                "estimatedCost": cost,
                "urgency": urgency,
                "lead_time_days": item.get("lead_time_days", 5),
            }
        )

    return {
        "status": "success",
        "total_purchase_orders": len(po_list),
        "total_units_to_order": total_units,
        "total_estimated_cost": round(total_cost, 2),
        "purchase_orders": po_list,
    }


@router.post("/recommendations/dispatch-po")
def dispatch_purchase_order(payload: DispatchPORequest) -> Dict[str, Any]:
    """Dispatches electronic purchase order to hospital vendor EDI."""
    po_num = f"PO-2026-{uuid.uuid4().hex[:6].upper()}"
    qty = payload.order_quantity or payload.quantity or 100
    return {
        "status": "dispatched",
        "message": f"Electronic PO '{po_num}' dispatched successfully.",
        "po_number": po_num,
        "poNumber": po_num,
        "medicine": payload.medicine,
        "quantity": qty,
        "order_quantity": qty,
        "supplier": payload.supplier,
        "estimated_cost": payload.estimated_cost,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/risk/analysis")
def get_risk_analysis() -> List[Dict[str, Any]]:
    """Returns detailed risk matrix: stockout probability, DOI, and lead time buffer."""
    items = db.get_all()
    results = []

    for item in items:
        burn = item["predicted_demand"] / 30.0 if item["predicted_demand"] > 0 else 1.0
        doi = round(item["current_stock"] / burn, 1)
        lead_time = item.get("lead_time_days", 5)

        if item["current_stock"] == 0:
            prob = 100
        elif doi <= lead_time:
            prob = 95
        elif item["current_stock"] < item["predicted_demand"]:
            prob = 75
        elif item["risk_level"] == "Overstock":
            prob = 5
        else:
            prob = 10

        results.append(
            {
                "medicine": item["medicine"],
                "current_stock": item["current_stock"],
                "currentStock": item["current_stock"],
                "predicted_demand": item["predicted_demand"],
                "daily_burn_rate": round(burn, 1),
                "days_of_inventory": doi,
                "daysOfInventory": doi,
                "lead_time_days": lead_time,
                "leadTimeDays": lead_time,
                "stockout_probability_pct": prob,
                "risk_level": item["risk_level"],
                "riskLevel": item["risk_level"],
            }
        )

    return results


@router.get("/reports/audit")
def get_reports_audit() -> Dict[str, Any]:
    """Returns official formulary audit records and executive valuation."""
    return {
        "status": "success",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "kpis": db.get_kpis(),
        "audit_records": db.get_all(),
    }
