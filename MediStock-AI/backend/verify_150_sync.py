"""Comprehensive End-to-End Test Suite for MediStock AI 150-Medicine Bug Fix."""

import urllib.request
import urllib.parse
import json
import pathlib
import mimetypes
import os

BASE_API = "http://127.0.0.1:8000/api"
CSV_PATH = pathlib.Path(__file__).parent.parent / "frontend" / "assets" / "MediStock_AI_150_Medicine_Upload_Ready(1).csv"
PERSISTENCE_FILE = pathlib.Path(__file__).parent / "app" / "data" / "active_inventory.json"


def post_multipart(url: str, filepath: pathlib.Path, fieldname: str = "file") -> dict:
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    filename = filepath.name
    with open(filepath, "rb") as f:
        file_bytes = f.read()

    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="{fieldname}"; filename="{filename}"\r\n'
        f"Content-Type: text/csv\r\n\r\n"
    ).encode("utf-8") + file_bytes + f"\r\n--{boundary}--\r\n".encode("utf-8")

    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST"
    )
    with urllib.request.urlopen(req) as response:
        return json.loads(response.read().decode("utf-8"))


def get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def post_json(url: str, data: dict = None) -> dict:
    body = json.dumps(data or {}).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def run_tests():
    print("=" * 60)
    print("MEDISTOCK AI: 150-MEDICINE DATA SYNC VERIFICATION SUITE")
    print("=" * 60)

    # 1. Health check
    health = get_json(f"{BASE_API}/health")
    print(f"[TEST 1] /api/health status: {health['status']}, count: {health['inventory_count']}")
    assert health["status"] == "healthy", "FastAPI should be healthy"

    # 2. Upload and commit 150 medicines
    print(f"\n[TEST 2] Uploading CSV: {CSV_PATH.name} ({CSV_PATH.stat().st_size} bytes)...")
    upload_res = post_multipart(f"{BASE_API}/upload/csv?commit=true", CSV_PATH)
    print(f"  Status: {upload_res['status']}")
    print(f"  File name: {upload_res['file_name']}")
    print(f"  Record count: {upload_res['record_count']}")
    print(f"  Validation status: {upload_res['validation_status']}")
    print(f"  Committed to inventory: {upload_res['committed_to_inventory']}")
    assert upload_res["record_count"] == 150, f"Expected 150 records parsed, got {upload_res['record_count']}"
    assert upload_res["committed_to_inventory"] is True, "Expected commit=True"

    # 3. Check KPIs from upload response
    kpis = upload_res.get("kpis")
    assert kpis is not None, "Upload response should include recalculated KPIs"
    print("\n[TEST 3] Recalculated KPIs from upload:")
    print(f"  Total Medicines: {kpis['totalMedicines']}")
    print(f"  Low Stock: {kpis['lowStock']}")
    print(f"  Stable Stock: {kpis['stableStock']}")
    print(f"  Overstock: {kpis['overstock']}")
    print(f"  Predicted Demand: {kpis['totalPredictedDemand']:,} units")
    print(f"  Inventory Value: Rs.{kpis['totalInventoryValue']:,}")
    print(f"  Total Reorder Needed: {kpis['totalReorderNeeded']:,} units")

    assert kpis["totalMedicines"] == 150, f"Expected 150 total medicines, got {kpis['totalMedicines']}"
    assert kpis["lowStock"] == 78, f"Expected 78 low stock, got {kpis['lowStock']}"
    assert kpis["stableStock"] == 64, f"Expected 64 stable stock, got {kpis['stableStock']}"
    assert kpis["overstock"] == 8, f"Expected 8 overstock, got {kpis['overstock']}"
    assert kpis["totalPredictedDemand"] == 123950, f"Expected 123950 demand, got {kpis['totalPredictedDemand']}"
    assert kpis["totalInventoryValue"] == 288710, f"Expected 288710 value, got {kpis['totalInventoryValue']}"
    assert kpis["totalReorderNeeded"] == 25862, f"Expected 25862 reorder, got {kpis['totalReorderNeeded']}"

    # 4. Check GET /api/inventory
    print("\n[TEST 4] Calling GET /api/inventory...")
    items = get_json(f"{BASE_API}/inventory")
    print(f"  Retrieved items count: {len(items)}")
    assert len(items) == 150, f"Expected 150 items from /api/inventory, got {len(items)}"

    # Check first and last items
    first = items[0]
    last = items[-1]
    print(f"  Item 1: {first['medicine']}, stock: {first['current_stock']}, demand: {first['predicted_demand']}, risk: {first['risk_level']}")
    print(f"  Item 150: {last['medicine']}, stock: {last['current_stock']}, demand: {last['predicted_demand']}, risk: {last['risk_level']}")

    # 5. Check GET /api/dashboard/kpis
    print("\n[TEST 5] Calling GET /api/dashboard/kpis...")
    dash_kpis = get_json(f"{BASE_API}/dashboard/kpis")
    print(f"  total_medicines: {dash_kpis['total_medicines']}")
    print(f"  low_stock: {dash_kpis['low_stock']}")
    print(f"  total_reorder_needed: {dash_kpis['total_reorder_needed']}")
    assert dash_kpis["total_medicines"] == 150, "Dashboard KPI total_medicines must be 150"
    assert dash_kpis["low_stock"] == 78, "Dashboard KPI low_stock must be 78"

    # 6. Check persistence file on disk
    print(f"\n[TEST 6] Checking persistence file at {PERSISTENCE_FILE}...")
    assert PERSISTENCE_FILE.exists(), f"Persistence file {PERSISTENCE_FILE} must exist!"
    with open(PERSISTENCE_FILE, "r", encoding="utf-8") as f:
        persisted_data = json.load(f)
    print(f"  Persisted items count: {len(persisted_data)}")
    assert len(persisted_data) == 150, f"Expected 150 persisted items, got {len(persisted_data)}"

    # 7. Test simulated server restart persistence
    print("\n[TEST 7] Testing repository reload from disk (simulating server restart)...")
    from app.models.database import InventoryRepository
    reloaded_db = InventoryRepository()
    reloaded_items = reloaded_db.get_all()
    print(f"  Reloaded database items: {len(reloaded_items)}")
    assert len(reloaded_items) == 150, "Reloaded database must restore 150 medicines from disk"

    # 8. Test dataset reset and re-upload sequence (150 -> 15 -> 150)
    print("\n[TEST 8] Testing dataset replacement (Reset to 15 -> Re-upload 150)...")
    reset_res = post_json(f"{BASE_API}/upload/reset-default")
    print(f"  Reset response count: {reset_res['count']}")
    assert reset_res["count"] == 15, "Reset must revert to 15 default medicines"
    reset_kpis = get_json(f"{BASE_API}/dashboard/kpis")
    assert reset_kpis["total_medicines"] == 15, "Dashboard must reflect 15 medicines after reset"

    # Re-upload 150 CSV
    reupload_res = post_multipart(f"{BASE_API}/upload/csv?commit=true", CSV_PATH)
    assert reupload_res["record_count"] == 150, "Re-upload must commit 150 medicines"
    reupload_kpis = get_json(f"{BASE_API}/dashboard/kpis")
    assert reupload_kpis["total_medicines"] == 150, "Dashboard must reflect 150 medicines after re-upload"
    print("  Clean dataset transition verified (150 -> 15 -> 150)!")

    # 9. Verify Frontend Node server serves all pages
    print("\n[TEST 9] Verifying frontend pages served by Node server (port 3000)...")
    pages = [
        "dashboard.html",
        "upload.html",
        "inventory.html",
        "demand-analysis.html",
        "ai-prediction.html",
        "risk-analysis.html",
        "recommendations.html",
        "reports.html"
    ]
    for page in pages:
        url = f"http://127.0.0.1:3000/{page}"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode("utf-8")
            assert resp.status == 200, f"Page {page} failed to load"
            # Ensure no static 15 in total-medicines-count
            assert '<span class="nav-badge badge-teal total-medicines-count">15</span>' not in content, f"Static 15 found in {page}"
            print(f"  http://localhost:3000/{page}: 200 OK (Clean placeholders verified)")

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED SUCCESSFULLY! 150-MEDICINE DATA SYNC VERIFIED!")
    print("=" * 60)


if __name__ == "__main__":
    run_tests()
