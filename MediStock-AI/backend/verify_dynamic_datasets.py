import os
import sys
import json
import csv
import io
import urllib.request
import urllib.parse
import uuid

BASE_URL = "http://127.0.0.1:8000"

def log(msg):
    print(f"[TEST] {msg}")

def http_get(url):
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as resp:
        data = resp.read().decode("utf-8")
        return resp.status, json.loads(data) if "application/json" in resp.headers.get("Content-Type", "") else data

def http_post_multipart(url, filename, file_bytes):
    boundary = f"----WebKitFormBoundary{uuid.uuid4().hex}"
    body = io.BytesIO()
    body.write(f"--{boundary}\r\n".encode("utf-8"))
    body.write(f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode("utf-8"))
    body.write(b"Content-Type: text/csv\r\n\r\n")
    body.write(file_bytes)
    body.write(b"\r\n")
    body.write(f"--{boundary}--\r\n".encode("utf-8"))
    
    content = body.getvalue()
    req = urllib.request.Request(url, data=content)
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    
    with urllib.request.urlopen(req) as resp:
        data = resp.read().decode("utf-8")
        return resp.status, json.loads(data)

def test_health():
    status, data = http_get(f"{BASE_URL}/api/health")
    assert status == 200, f"Health check failed with status {status}"
    log(f"Health check OK: {data}")

def test_upload_200_dataset():
    path_200 = r"C:\Users\ramap\Downloads\medistock_200_medicines.csv"
    assert os.path.exists(path_200), f"200-medicine CSV not found at {path_200}"
    
    with open(path_200, "rb") as f:
        file_bytes = f.read()
    
    status, data = http_post_multipart(f"{BASE_URL}/api/upload/csv?commit=true", "medistock_200_medicines.csv", file_bytes)
    assert status == 200, f"Upload 200 failed ({status}): {data}"
    log(f"Upload 200 Response: validation_passed={data.get('validation_passed')}, count={data.get('count')}")
    assert data.get("validation_passed") is True
    assert data.get("count") == 200

    # Verify inventory endpoint
    inv_status, inv = http_get(f"{BASE_URL}/api/inventory")
    assert inv_status == 200
    log(f"Inventory endpoint returned {len(inv)} items")
    assert len(inv) == 200

    # Verify KPIs
    kpi_status, kpis = http_get(f"{BASE_URL}/api/dashboard/kpis")
    assert kpi_status == 200
    log(f"KPIs for 200 items: {json.dumps(kpis, indent=2)}")
    assert kpis["totalMedicines"] == 200
    assert kpis["lowStock"] + kpis["stableStock"] + kpis["overstock"] == 200
    assert kpis["totalPredictedDemand"] > 0
    assert kpis["totalInventoryValue"] > 0
    assert kpis["totalReorderNeeded"] > 0

def test_dynamic_transition_50():
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Medicine", "Jan", "Feb", "Mar", "Apr", "Current_Stock", "Category", "UnitPrice"])
    for i in range(1, 51):
        writer.writerow([f"Med-50-Test-{i:03d}", 100 + i, 110 + i, 120 + i, 130 + i, 50, "General", 10.0])
    
    csv_bytes = output.getvalue().encode("utf-8")
    status, data = http_post_multipart(f"{BASE_URL}/api/upload/csv?commit=true", "medistock_50_test.csv", csv_bytes)
    assert status == 200
    assert data.get("count") == 50

    kpi_status, kpis = http_get(f"{BASE_URL}/api/dashboard/kpis")
    log(f"KPIs for 50 items: totalMedicines={kpis['totalMedicines']}")
    assert kpis["totalMedicines"] == 50

    inv_status, inv = http_get(f"{BASE_URL}/api/inventory")
    assert len(inv) == 50

def test_dynamic_transition_300():
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "medicine_name", "current_stock", "predicted_demand", "unit_price", "category"])
    for i in range(1, 301):
        writer.writerow([i, f"Med-300-Test-{i:03d}", 200, 250, 15.5, "Antibiotics" if i % 2 == 0 else "Analgesics"])
    
    csv_bytes = output.getvalue().encode("utf-8")
    status, data = http_post_multipart(f"{BASE_URL}/api/upload/csv?commit=true", "medistock_300_test.csv", csv_bytes)
    assert status == 200
    assert data.get("count") == 300

    kpi_status, kpis = http_get(f"{BASE_URL}/api/dashboard/kpis")
    log(f"KPIs for 300 items: totalMedicines={kpis['totalMedicines']}, lowStock={kpis['lowStock']}, stableStock={kpis['stableStock']}")
    assert kpis["totalMedicines"] == 300

    inv_status, inv = http_get(f"{BASE_URL}/api/inventory")
    assert len(inv) == 300

def test_restore_200_and_verify_persistence():
    path_200 = r"C:\Users\ramap\Downloads\medistock_200_medicines.csv"
    with open(path_200, "rb") as f:
        file_bytes = f.read()
    status, data = http_post_multipart(f"{BASE_URL}/api/upload/csv?commit=true", "medistock_200_medicines.csv", file_bytes)
    assert status == 200
    assert data.get("count") == 200

    kpi_status, kpis = http_get(f"{BASE_URL}/api/dashboard/kpis")
    assert kpis["totalMedicines"] == 200

    # Verify JSON persistence file on disk
    persisted_path = os.path.join(os.path.dirname(__file__), "app", "data", "active_inventory.json")
    assert os.path.exists(persisted_path), f"Persistence file not found: {persisted_path}"
    with open(persisted_path, "r", encoding="utf-8") as f:
        persisted_data = json.load(f)
    log(f"Persisted file item count: {len(persisted_data)}")
    assert len(persisted_data) == 200

def test_frontend_pages():
    pages = [
        "dashboard.html",
        "inventory.html",
        "upload.html",
        "demand-analysis.html",
        "ai-prediction.html",
        "risk-analysis.html",
        "recommendations.html",
        "reports.html"
    ]
    for page in pages:
        req = urllib.request.Request(f"http://localhost:3000/{page}")
        with urllib.request.urlopen(req) as resp:
            assert resp.status == 200, f"Page {page} returned status {resp.status}"
    log(f"All {len(pages)} frontend pages returned HTTP 200 OK")

if __name__ == "__main__":
    log("Starting Comprehensive Dynamic Dataset Verification Suite...")
    test_health()
    test_upload_200_dataset()
    test_dynamic_transition_50()
    test_dynamic_transition_300()
    test_restore_200_and_verify_persistence()
    test_frontend_pages()
    log("ALL DYNAMIC DATASET VERIFICATION TESTS PASSED SUCCESSFULLY!")
