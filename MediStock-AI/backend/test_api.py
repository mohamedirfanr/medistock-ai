"""Comprehensive automated test suite for MediStock AI FastAPI endpoints."""

import sys
import json
import urllib.request
import urllib.error
import urllib.parse
from pathlib import Path

# Set output encoding to UTF-8
if sys.platform.startswith("win"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE_URL = "http://127.0.0.1:8000"


def make_request(method: str, path: str, data: dict = None, headers: dict = None):
    url = f"{BASE_URL}{path}"
    req_headers = headers or {}
    body = None

    if data is not None:
        body = json.dumps(data).encode("utf-8")
        req_headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=body, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            status = response.getcode()
            resp_headers = dict(response.info())
            resp_body = response.read().decode("utf-8")
            try:
                parsed_json = json.loads(resp_body)
            except Exception:
                parsed_json = resp_body
            return status, resp_headers, parsed_json
    except urllib.error.HTTPError as err:
        err_body = err.read().decode("utf-8")
        try:
            parsed_err = json.loads(err_body)
        except Exception:
            parsed_err = err_body
        return err.code, dict(err.headers), parsed_err
    except Exception as exc:
        return 0, {}, {"error": str(exc)}


def test_multipart_csv_upload(csv_path: str):
    """Performs multipart/form-data upload using standard library."""
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    filename = Path(csv_path).name

    with open(csv_path, "rb") as f:
        file_bytes = f.read()

    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        f"Content-Type: text/csv\r\n\r\n"
    ).encode("utf-8") + file_bytes + f"\r\n--{boundary}--\r\n".encode("utf-8")

    headers = {
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "Content-Length": str(len(body)),
    }

    url = f"{BASE_URL}/api/upload/csv"
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            return response.getcode(), json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        return err.code, json.loads(err.read().decode("utf-8"))


def run_all_tests():
    print("\n" + "=" * 65)
    print("[TEST SUITE] Starting MediStock AI FastAPI Endpoint Test Suite")
    print("=" * 65 + "\n")

    test_results = []

    # 1. Test GET /api/health
    print("1. Testing GET /api/health...")
    status, headers, body = make_request("GET", "/api/health")
    passed = status == 200 and body.get("status") == "healthy"
    test_results.append(("GET /api/health", status, passed, body))
    print(f"   Status: {status} | Healthy: {body.get('status')} | Items: {body.get('inventory_count')}")

    # 2. Test GET /api/inventory
    print("\n2. Testing GET /api/inventory...")
    status, headers, body = make_request("GET", "/api/inventory")
    passed = status == 200 and isinstance(body, list) and len(body) > 0
    paracetamol = next((m for m in body if "paracetamol 500mg" in m.get("medicine", "").lower()), None)
    if paracetamol:
        print(f"   Found Paracetamol: Stock={paracetamol.get('current_stock')} | Demand={paracetamol.get('predicted_demand')} | Reorder={paracetamol.get('recommended_reorder')} | Risk={paracetamol.get('risk_level')}")
        passed = passed and paracetamol.get("predicted_demand") == 800 and paracetamol.get("recommended_reorder") == 500
    test_results.append(("GET /api/inventory", status, passed, f"{len(body)} medicines returned"))

    # 3. Test GET /api/inventory/{medicine_id}/rationale
    print("\n3. Testing GET /api/inventory/paracetamol-500mg/rationale...")
    status, headers, body = make_request("GET", "/api/inventory/paracetamol-500mg/rationale")
    passed = status == 200 and "Demand has increased continuously" in body.get("explanation", "")
    test_results.append(("GET /api/inventory/{id}/rationale", status, passed, body.get("explanation")))
    print(f"   Status: {status} | Explanation: \"{body.get('explanation')}\"")

    # 4. Test POST /api/upload/csv
    print("\n4. Testing POST /api/upload/csv...")
    sample_csv = Path(__file__).resolve().parent.parent / "frontend" / "assets" / "sample_medicines.csv"
    if sample_csv.exists():
        status, body = test_multipart_csv_upload(str(sample_csv))
        passed = status == 200 and body.get("status") == "success" and body.get("record_count", 0) > 0
        test_results.append(("POST /api/upload/csv (Valid)", status, passed, f"Uploaded {body.get('record_count')} items"))
        print(f"   Status: {status} | File: {body.get('file_name')} | Parsed: {body.get('record_count')} records | Validation: {body.get('validation_status')}")
    else:
        test_results.append(("POST /api/upload/csv (Valid)", 0, False, "sample_medicines.csv not found"))
        print("   sample_medicines.csv not found")

    # 4b. Test POST /api/upload/csv with Missing Column (Invalid Schema)
    print("\n4b. Testing POST /api/upload/csv with Missing Column (Schema Rejection)...")
    bad_boundary = "----WebKitFormBoundaryBad"
    bad_bytes = b"Medicine,Jan,Feb,Current_Stock\nParacetamol,100,200,50\n"
    bad_body = (
        f"--{bad_boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="invalid_schema.csv"\r\n'
        f"Content-Type: text/csv\r\n\r\n"
    ).encode("utf-8") + bad_bytes + f"\r\n--{bad_boundary}--\r\n".encode("utf-8")
    bad_headers = {
        "Content-Type": f"multipart/form-data; boundary={bad_boundary}",
        "Content-Length": str(len(bad_body)),
    }
    bad_req = urllib.request.Request(f"{BASE_URL}/api/upload/csv", data=bad_body, headers=bad_headers, method="POST")
    try:
        urllib.request.urlopen(bad_req, timeout=5)
        bad_passed = False
        bad_status = 200
        bad_msg = "Expected rejection but succeeded"
    except urllib.error.HTTPError as err:
        bad_status = err.code
        bad_passed = err.code in [400, 422]
        bad_msg = f"Properly rejected with HTTP {err.code}: {json.loads(err.read().decode('utf-8')).get('detail')}"
    test_results.append(("POST /api/upload/csv (Schema Validation)", bad_status, bad_passed, bad_msg))
    print(f"   Status: {bad_status} | Passed: {bad_passed} | Message: {bad_msg}")

    # 5. Test POST /api/forecast/predict
    print("\n5. Testing POST /api/forecast/predict...")
    status, headers, body = make_request("POST", "/api/forecast/predict", data={"model": "xgboost", "horizon_months": 2})
    passed = status == 200 and body.get("status") == "success" and len(body.get("predictions", [])) > 0
    test_results.append(("POST /api/forecast/predict", status, passed, f"Model: {body.get('model_used')} | MAPE: {body.get('metrics', {}).get('mape')}%"))
    print(f"   Status: {status} | Model: {body.get('model_used')} | Total Items: {body.get('total_items')}")

    # 6. Test GET /api/recommendations/purchase-orders
    print("\n6. Testing GET /api/recommendations/purchase-orders...")
    status, headers, body = make_request("GET", "/api/recommendations/purchase-orders")
    passed = status == 200 and body.get("total_purchase_orders", 0) > 0
    test_results.append(("GET /api/recommendations/purchase-orders", status, passed, f"{body.get('total_purchase_orders')} POs | Units: {body.get('total_units_to_order')} | Cost: ${body.get('total_estimated_cost')}"))
    print(f"   Status: {status} | Orders: {body.get('total_purchase_orders')} | Units: {body.get('total_units_to_order')} | Est. Cost: ${body.get('total_estimated_cost')}")

    # 7. Test POST /api/recommendations/dispatch-po
    print("\n7. Testing POST /api/recommendations/dispatch-po...")
    dispatch_payload = {
        "medicine": "Paracetamol 500mg",
        "quantity": 500,
        "supplier": "PharmaCore Labs",
        "estimated_cost": 625.0,
    }
    status, headers, body = make_request("POST", "/api/recommendations/dispatch-po", data=dispatch_payload)
    passed = status == 200 and body.get("status") == "success" and "po_number" in body
    test_results.append(("POST /api/recommendations/dispatch-po", status, passed, f"Dispatched {body.get('po_number')}"))
    print(f"   Status: {status} | Dispatched PO: {body.get('po_number')} | Item: {body.get('medicine')} ({body.get('quantity')} units)")

    # 8. Test GET /api/dashboard/kpis
    print("\n8. Testing GET /api/dashboard/kpis...")
    status, headers, body = make_request("GET", "/api/dashboard/kpis")
    passed = status == 200 and body.get("totalMedicines", 0) > 0
    test_results.append(("GET /api/dashboard/kpis", status, passed, f"Total: {body.get('totalMedicines')} | Low: {body.get('lowStock')} | Stable: {body.get('stableStock')}"))
    print(f"   Status: {status} | Total: {body.get('totalMedicines')} | Low Stock: {body.get('lowStock')} | Valuation: ${body.get('totalInventoryValue')}")

    # 9. Test CORS headers
    print("\n9. Testing CORS configuration...")
    cors_req = urllib.request.Request(
        f"{BASE_URL}/api/health",
        headers={"Origin": "http://localhost:3000"}
    )
    with urllib.request.urlopen(cors_req) as resp:
        cors_header = resp.headers.get("access-control-allow-origin")
        cors_passed = cors_header in ["http://localhost:3000", "*"]
        test_results.append(("CORS Validation", resp.status, cors_passed, f"Access-Control-Allow-Origin: {cors_header}"))
        print(f"   CORS Origin header: {cors_header}")

    # Summary
    print("\n" + "=" * 65)
    print("[SUMMARY] Test Summary Report")
    print("=" * 65)
    all_passed = True
    for name, code, is_ok, info in test_results:
        flag = "[PASS]" if is_ok else "[FAIL]"
        if not is_ok:
            all_passed = False
        print(f"{flag} [{code}] {name: <40} -> {info}")

    print("=" * 65)
    if all_passed:
        print("[SUCCESS] ALL ENDPOINTS PASSED SUCCESSFULLY!")
        return 0
    else:
        print("[ERROR] SOME TESTS FAILED.")
        return 1


if __name__ == "__main__":
    sys.exit(run_all_tests())
