import sys
from app.utils.csv_validator import parse_and_validate_csv
from app.models.database import db

with open('../frontend/assets/MediStock_AI_150_Medicine_Upload_Ready(1).csv', 'rb') as f:
    content = f.read()

items, warnings = parse_and_validate_csv(content)
print(f"Parsed records count: {len(items)}")
print(f"Warnings: {warnings[:3]}")

db.replace_all(items)
all_items = db.get_all()
print(f"db.get_all() count: {len(all_items)}")

kpis = db.get_kpis()
print("Recalculated KPIs:")
for k, v in kpis.items():
    print(f"  {k}: {v}")
