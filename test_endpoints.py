import requests
import json
import sys

BASE_URL = "http://localhost:8081"

def test_endpoint(name, url, method="GET", data=None, expected_status=200):
    print(f"Testing {name} ({method} {url})...", end=" ")
    try:
        if method == "GET":
            response = requests.get(f"{BASE_URL}{url}")
        elif method == "POST":
            response = requests.post(f"{BASE_URL}{url}", json=data)
        
        if response.status_code == expected_status:
            print(f"PASS (Status: {response.status_code})")
            return float('inf') if method == "POST" else response # Return response for POST to get ID
        else:
            print(f"FAIL (Status: {response.status_code})")
            print(f"Response: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return False

print("=== Starting Verification ===")

# 1. HTML Pages
test_endpoint("Dashboard", "/")
test_endpoint("Kanban", "/kanban")
test_endpoint("New Deal Form", "/deals/new")

# 2. API Endpoints
test_endpoint("Statistics API", "/api/statistics")
test_endpoint("Deals API (List)", "/api/deals")

# 3. Functional Test: Create Deal
deal_data = {
    "commodity_type": "Copper",
    "source_name": "Test Source",
    "date_received": "2023-10-27",
    "price": 8500,
    "quantity": 100,
    "quantity_unit": "MT",
    "status": "new"
}
response = test_endpoint("Create Deal API", "/api/deals", "POST", deal_data, 201)

if response:
    try:
        deal_id = response.json().get('deal_id')
        print(f"Created Deal ID: {deal_id}")
        # Verify we can get it back
        test_endpoint(f"Get Created Deal ({deal_id})", f"/api/deals/{deal_id}")
    except:
        print("Could not extract deal_id from response")

print("=== Verification Complete ===")
