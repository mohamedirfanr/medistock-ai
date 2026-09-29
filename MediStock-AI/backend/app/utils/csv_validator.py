"""MediStock AI - Hospital CSV Ingestion & Universal Schema Validator."""

import io
import csv
from typing import List, Dict, Any, Tuple, Optional
from fastapi import HTTPException, status


def normalize_header(header: str) -> str:
    """Normalize column header for case/whitespace/separator insensitive matching."""
    return header.strip().lower().replace(" ", "").replace("_", "").replace("-", "")


# Candidate aliases for common columns across various hospital datasets
MEDICINE_ALIASES = [
    "medicine", "medicinename", "medname", "drugname", "drug",
    "itemname", "item", "productname", "product", "formulary", "name"
]

STOCK_ALIASES = [
    "currentstock", "stock", "stockonhand", "quantityinstock",
    "qtyinstock", "onhand", "inventory", "inventorylevel",
    "unitsinstock", "units", "quantity"
]

JAN_ALIASES = ["jan", "january", "month1", "m1"]
FEB_ALIASES = ["feb", "february", "month2", "m2"]
MAR_ALIASES = ["mar", "march", "month3", "m3"]
APR_ALIASES = ["apr", "april", "month4", "m4"]

PREDICTED_DEMAND_ALIASES = [
    "predicteddemand", "predicted30daydemand", "forecasteddemand",
    "forecastdemand", "demandforecast", "projecteddemand", "monthlydemand",
    "targetdemand", "demand"
]

DAILY_DEMAND_ALIASES = [
    "dailydemand", "averagedailydemand", "dailyburnrate", "burnrate"
]

UNIT_PRICE_ALIASES = [
    "unitprice", "price", "cost", "unitcost", "mrp", "rate"
]

CATEGORY_ALIASES = [
    "category", "therapeuticclass", "department", "type", "class"
]

LEAD_TIME_ALIASES = [
    "leadtimedays", "leadtime", "deliverydays", "leaddays"
]

SUPPLIER_ALIASES = [
    "supplier", "vendor", "manufacturer", "distributor"
]


def find_column_index(headers: List[str], aliases: List[str]) -> Optional[int]:
    """Find matching column index by exact normalized match, then substring match."""
    normalized = [normalize_header(h) for h in headers]
    # 1. Exact normalized match
    for alias in aliases:
        norm_alias = normalize_header(alias)
        if norm_alias in normalized:
            return normalized.index(norm_alias)
    # 2. Substring match
    for alias in aliases:
        norm_alias = normalize_header(alias)
        for idx, h in enumerate(normalized):
            if norm_alias in h or (len(h) > 2 and h in norm_alias):
                return idx
    return None


def parse_and_validate_csv(
    content_bytes: bytes,
) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Parses and validates CSV bytes dynamically supporting any dataset size
    and standard hospital formulary schemas.
    """
    try:
        text = content_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            text = content_bytes.decode("latin-1")
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to decode file. Please provide a valid UTF-8 CSV.",
            )

    reader = csv.reader(io.StringIO(text))
    rows = [r for r in reader if any(cell.strip() for cell in r)]

    if not rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded CSV file is empty.",
        )

    headers = rows[0]

    # Required primary fields: Medicine name & Stock
    med_idx = find_column_index(headers, MEDICINE_ALIASES)
    stock_idx = find_column_index(headers, STOCK_ALIASES)

    missing = []
    if med_idx is None:
        missing.append("Medicine / Drug Name")
    if stock_idx is None:
        missing.append("Current Stock")

    if missing:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"CSV validation failed. Missing required column(s): {', '.join(missing)}. "
                f"Headers found: {', '.join(headers[:8])}"
            ),
        )

    # Optional / Contextual fields
    jan_idx = find_column_index(headers, JAN_ALIASES)
    feb_idx = find_column_index(headers, FEB_ALIASES)
    mar_idx = find_column_index(headers, MAR_ALIASES)
    apr_idx = find_column_index(headers, APR_ALIASES)
    pred_idx = find_column_index(headers, PREDICTED_DEMAND_ALIASES)
    daily_idx = find_column_index(headers, DAILY_DEMAND_ALIASES)
    price_idx = find_column_index(headers, UNIT_PRICE_ALIASES)
    cat_idx = find_column_index(headers, CATEGORY_ALIASES)
    lt_idx = find_column_index(headers, LEAD_TIME_ALIASES)
    supp_idx = find_column_index(headers, SUPPLIER_ALIASES)

    has_months = (
        jan_idx is not None and feb_idx is not None and
        mar_idx is not None and apr_idx is not None
    )

    parsed_records: List[Dict[str, Any]] = []
    warnings: List[str] = []

    for line_num, row in enumerate(rows[1:], start=2):
        if not row or all(c.strip() == "" for c in row):
            continue

        try:
            if med_idx >= len(row):
                continue
            med_name = row[med_idx].strip()
            if not med_name:
                warnings.append(f"Row {line_num}: Empty medicine name skipped.")
                continue

            # Stock
            stock_val = 0
            if stock_idx < len(row) and row[stock_idx].strip():
                try:
                    stock_val = max(0, int(float(row[stock_idx].strip())))
                except ValueError:
                    stock_val = 0

            # Demand values
            jan, feb, mar, apr = 0, 0, 0, 0
            pred_demand: Optional[int] = None

            # Explicit predicted_demand column
            if pred_idx is not None and pred_idx < len(row) and row[pred_idx].strip():
                try:
                    p = int(float(row[pred_idx].strip()))
                    if p > 0:
                        pred_demand = p
                except ValueError:
                    pass

            # Daily demand column
            if pred_demand is None and daily_idx is not None and daily_idx < len(row) and row[daily_idx].strip():
                try:
                    d = float(row[daily_idx].strip())
                    if d > 0:
                        pred_demand = int(round(d * 30))
                except ValueError:
                    pass

            # Monthly consumption columns
            if has_months and max(jan_idx, feb_idx, mar_idx, apr_idx) < len(row):
                try:
                    jan = max(0, int(float(row[jan_idx].strip())))
                    feb = max(0, int(float(row[feb_idx].strip())))
                    mar = max(0, int(float(row[mar_idx].strip())))
                    apr = max(0, int(float(row[apr_idx].strip())))
                except ValueError:
                    pass
            elif pred_demand is not None and pred_demand > 0:
                # Synthesize monthly velocity leading up to predicted demand
                apr = max(1, int(round(pred_demand * 0.95)))
                mar = max(1, int(round(pred_demand * 0.90)))
                feb = max(1, int(round(pred_demand * 0.85)))
                jan = max(1, int(round(pred_demand * 0.80)))
            else:
                # Baseline estimate
                base = max(10, int(round(stock_val * 0.8)))
                apr = base
                mar = max(1, int(base * 0.95))
                feb = max(1, int(base * 0.90))
                jan = max(1, int(base * 0.85))

            # Unit Price
            unit_price = 2.50
            if price_idx is not None and price_idx < len(row) and row[price_idx].strip():
                try:
                    pr = float(row[price_idx].strip())
                    if pr > 0:
                        unit_price = round(pr, 2)
                except ValueError:
                    pass

            # Category
            category = "Imported Formulary"
            if cat_idx is not None and cat_idx < len(row) and row[cat_idx].strip():
                c = row[cat_idx].strip()
                if c:
                    category = c

            # Lead time
            lead_time = 5
            if lt_idx is not None and lt_idx < len(row) and row[lt_idx].strip():
                try:
                    lt = int(float(row[lt_idx].strip()))
                    if lt > 0:
                        lead_time = lt
                except ValueError:
                    pass

            # Supplier
            supplier = "Standard Hospital Supplier"
            if supp_idx is not None and supp_idx < len(row) and row[supp_idx].strip():
                s = row[supp_idx].strip()
                if s:
                    supplier = s

            record = {
                "medicine": med_name,
                "jan": jan,
                "feb": feb,
                "mar": mar,
                "apr": apr,
                "current_stock": stock_val,
                "category": category,
                "unit_price": unit_price,
                "lead_time_days": lead_time,
                "supplier": supplier,
            }
            if pred_demand is not None and pred_demand > 0:
                record["predicted_demand"] = pred_demand
                record["manual_predicted"] = pred_demand

            parsed_records.append(record)
        except Exception as err:
            warnings.append(f"Row {line_num}: Failed to parse ({err}).")

    if not parsed_records:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid medicine data rows could be extracted from the CSV.",
        )

    return parsed_records, warnings
