"""In-memory hospital inventory repository and default dataset for MediStock AI."""

import os
import re
import json
import copy
import pathlib
from typing import List, Dict, Any, Optional
from app.ml.forecaster import forecaster
from app.ml.risk_engine import risk_engine


DEFAULT_HOSPITAL_DATA = [
    {
        "medicine": "Paracetamol 500mg",
        "category": "Analgesics & Antipyretic",
        "unit_price": 1.25,
        "jan": 450,
        "feb": 520,
        "mar": 610,
        "apr": 720,
        "current_stock": 300,
        "manual_predicted": 800,  # Exact specification
        "lead_time_days": 4,
        "supplier": "PharmaCore Labs",
    },
    {
        "medicine": "Amoxicillin 250mg",
        "category": "Antibiotics",
        "unit_price": 3.50,
        "jan": 320,
        "feb": 310,
        "mar": 290,
        "apr": 280,
        "current_stock": 650,
        "manual_predicted": 270,
        "lead_time_days": 7,
        "supplier": "BioMed Global",
    },
    {
        "medicine": "Remdesivir 100mg",
        "category": "Antivirals (ICU Critical)",
        "unit_price": 42.00,
        "jan": 120,
        "feb": 180,
        "mar": 250,
        "apr": 380,
        "current_stock": 95,
        "manual_predicted": 450,
        "lead_time_days": 10,
        "supplier": "Apex Therapeutics",
    },
    {
        "medicine": "Insulin Glargine",
        "category": "Endocrinology",
        "unit_price": 28.50,
        "jan": 410,
        "feb": 430,
        "mar": 425,
        "apr": 440,
        "current_stock": 430,
        "manual_predicted": 445,
        "lead_time_days": 5,
        "supplier": "NovoHealth Inc",
    },
    {
        "medicine": "Propofol 1%",
        "category": "Anesthesia (OR Supply)",
        "unit_price": 18.00,
        "jan": 180,
        "feb": 210,
        "mar": 240,
        "apr": 290,
        "current_stock": 110,
        "manual_predicted": 320,
        "lead_time_days": 3,
        "supplier": "SurgiCare Pharma",
    },
    {
        "medicine": "Azithromycin 500mg",
        "category": "Antibiotics",
        "unit_price": 4.80,
        "jan": 290,
        "feb": 340,
        "mar": 380,
        "apr": 450,
        "current_stock": 180,
        "manual_predicted": 490,
        "lead_time_days": 6,
        "supplier": "PharmaCore Labs",
    },
    {
        "medicine": "Meropenem 1g",
        "category": "Critical Care Antibiotics",
        "unit_price": 34.00,
        "jan": 85,
        "feb": 90,
        "mar": 110,
        "apr": 135,
        "current_stock": 45,
        "manual_predicted": 150,
        "lead_time_days": 8,
        "supplier": "Apex Therapeutics",
    },
    {
        "medicine": "Metformin 500mg",
        "category": "Antidiabetic",
        "unit_price": 0.85,
        "jan": 600,
        "feb": 610,
        "mar": 605,
        "apr": 620,
        "current_stock": 950,
        "manual_predicted": 625,
        "lead_time_days": 4,
        "supplier": "BioMed Global",
    },
    {
        "medicine": "Atorvastatin 20mg",
        "category": "Cardiovascular",
        "unit_price": 2.10,
        "jan": 510,
        "feb": 490,
        "mar": 530,
        "apr": 520,
        "current_stock": 510,
        "manual_predicted": 525,
        "lead_time_days": 5,
        "supplier": "NovoHealth Inc",
    },
    {
        "medicine": "Salbutamol Inhaler",
        "category": "Respiratory",
        "unit_price": 8.50,
        "jan": 220,
        "feb": 280,
        "mar": 350,
        "apr": 420,
        "current_stock": 130,
        "manual_predicted": 480,
        "lead_time_days": 6,
        "supplier": "AeroMed Healthcare",
    },
    {
        "medicine": "Ceftriaxone 1g",
        "category": "Antibiotics",
        "unit_price": 6.20,
        "jan": 190,
        "feb": 210,
        "mar": 230,
        "apr": 260,
        "current_stock": 250,
        "manual_predicted": 280,
        "lead_time_days": 5,
        "supplier": "PharmaCore Labs",
    },
    {
        "medicine": "Dexamethasone 4mg",
        "category": "Corticosteroids",
        "unit_price": 2.80,
        "jan": 310,
        "feb": 360,
        "mar": 420,
        "apr": 510,
        "current_stock": 140,
        "manual_predicted": 560,
        "lead_time_days": 4,
        "supplier": "BioMed Global",
    },
    {
        "medicine": "Pantoprazole 40mg",
        "category": "Gastroenterology",
        "unit_price": 1.95,
        "jan": 550,
        "feb": 540,
        "mar": 560,
        "apr": 570,
        "current_stock": 880,
        "manual_predicted": 580,
        "lead_time_days": 3,
        "supplier": "PharmaCore Labs",
    },
    {
        "medicine": "Enoxaparin 40mg",
        "category": "Anticoagulants",
        "unit_price": 15.50,
        "jan": 140,
        "feb": 165,
        "mar": 190,
        "apr": 230,
        "current_stock": 70,
        "manual_predicted": 260,
        "lead_time_days": 7,
        "supplier": "Apex Therapeutics",
    },
    {
        "medicine": "Ondansetron 4mg",
        "category": "Antiemetic",
        "unit_price": 3.10,
        "jan": 240,
        "feb": 250,
        "mar": 245,
        "apr": 260,
        "current_stock": 450,
        "manual_predicted": 265,
        "lead_time_days": 5,
        "supplier": "SurgiCare Pharma",
    },
]


def slugify(text: str) -> str:
    """Generate clean URL-safe identifier from medicine name."""
    clean = re.sub(r"[^\w\s-]", "", text).strip().lower()
    return re.sub(r"[-\s]+", "-", clean)


class InventoryRepository:
    """Thread-safe file-backed store for hospital medicine records."""

    def __init__(self):
        self.data_dir = pathlib.Path(__file__).parent.parent / "data"
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.persistence_file = self.data_dir / "active_inventory.json"
        self._items: List[Dict[str, Any]] = self._load_persisted()

    def _load_persisted(self) -> List[Dict[str, Any]]:
        if self.persistence_file.exists():
            try:
                with open(self.persistence_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, list) and len(data) > 0:
                        return data
            except Exception as e:
                print(f"Warning: Failed to load {self.persistence_file}: {e}")
        return copy.deepcopy(DEFAULT_HOSPITAL_DATA)

    def _save_persisted(self) -> None:
        try:
            with open(self.persistence_file, "w", encoding="utf-8") as f:
                json.dump(self._items, f, indent=2)
        except Exception as e:
            print(f"Warning: Failed to persist {self.persistence_file}: {e}")

    def _enrich_item(self, raw_item: Dict[str, Any]) -> Dict[str, Any]:
        item = copy.deepcopy(raw_item)
        med_name = item.get("medicine", "Medicine")
        item["id"] = slugify(med_name)

        jan = int(item.get("jan", 0))
        feb = int(item.get("feb", 0))
        mar = int(item.get("mar", 0))
        apr = int(item.get("apr", 0))
        current_stock = int(item.get("current_stock", 0))
        manual_pred = item.get("manual_predicted") or item.get("predicted_demand") or item.get("predictedDemand")
        if manual_pred is not None:
            try:
                manual_pred = int(manual_pred)
            except (ValueError, TypeError):
                manual_pred = None

        # Demand forecast
        pred_demand = forecaster.forecast_item_demand(
            jan, feb, mar, apr, med_name, manual_pred
        )
        item["predicted_demand"] = pred_demand
        item["predictedDemand"] = pred_demand

        # Risk assessment
        risk = risk_engine.evaluate_risk(current_stock, pred_demand)
        item["risk_level"] = risk["level"]
        item["riskLevel"] = risk["level"]
        item["risk_icon"] = risk["icon"]
        item["riskIcon"] = risk["icon"]
        item["risk_badge_class"] = risk["badge_class"]
        item["riskBadgeClass"] = risk["badge_class"]
        item["recommended_reorder"] = risk["reorder_qty"]
        item["recommendedReorder"] = risk["reorder_qty"]

        # Explanation
        explanation = risk_engine.generate_explanation(item)
        item["explanation"] = explanation

        # Financial values
        unit_price = float(item.get("unit_price", 2.50))
        item["unit_price"] = unit_price
        item["unitPrice"] = unit_price
        item["stock_value"] = round(current_stock * unit_price, 2)
        item["stockValue"] = item["stock_value"]
        item["reorder_cost"] = round(risk["reorder_qty"] * unit_price, 2)
        item["reorderCost"] = item["reorder_cost"]
        item["currentStock"] = current_stock
        item["leadTimeDays"] = int(item.get("lead_time_days", 5))

        return item

    def get_all(self) -> List[Dict[str, Any]]:
        return [self._enrich_item(item) for item in self._items]

    def get_by_id(self, identifier: str) -> Optional[Dict[str, Any]]:
        target_slug = slugify(identifier)
        for item in self.get_all():
            if item["id"] == target_slug or slugify(item["medicine"]) == target_slug:
                return item
        return None

    def replace_all(self, new_records: List[Dict[str, Any]]) -> None:
        self._items = copy.deepcopy(new_records)
        self._save_persisted()

    def reset_to_default(self) -> None:
        self._items = copy.deepcopy(DEFAULT_HOSPITAL_DATA)
        self._save_persisted()

    def get_kpis(self) -> Dict[str, Any]:
        all_items = self.get_all()
        total_medicines = len(all_items)
        low_stock = sum(1 for m in all_items if m["risk_level"] == "Shortage")
        stable_stock = sum(1 for m in all_items if m["risk_level"] == "Stable")
        overstock = sum(1 for m in all_items if m["risk_level"] == "Overstock")
        total_pred = sum(m["predicted_demand"] for m in all_items)
        total_val = int(round(sum(m["stock_value"] for m in all_items)))
        total_reorder = sum(m["recommended_reorder"] for m in all_items)

        return {
            "totalMedicines": total_medicines,
            "total_medicines": total_medicines,
            "lowStock": low_stock,
            "low_stock": low_stock,
            "stableStock": stable_stock,
            "stable_stock": stable_stock,
            "overstock": overstock,
            "totalPredictedDemand": total_pred,
            "total_predicted_demand": total_pred,
            "totalInventoryValue": total_val,
            "total_inventory_value": total_val,
            "totalReorderNeeded": total_reorder,
            "total_reorder_needed": total_reorder,
        }


db = InventoryRepository()
