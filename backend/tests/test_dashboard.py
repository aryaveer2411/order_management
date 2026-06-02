def test_dashboard_empty(client, auth_headers):
    r = client.get("/dashboard", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["total_products"] == 0
    assert body["total_customers"] == 0
    assert body["total_orders"] == 0
    assert body["low_stock_products"] == []


def test_dashboard_counts(client, auth_headers):
    # Create 2 products, 1 customer, 1 order
    p1 = client.post("/products", json={"name": "A", "sku": "A", "price": "5.00", "quantity": 100}, headers=auth_headers).json()
    client.post("/products", json={"name": "B", "sku": "B", "price": "5.00", "quantity": 100}, headers=auth_headers)
    c = client.post("/customers", json={"full_name": "Test", "email": "t@t.com", "phone": "1"}, headers=auth_headers).json()
    client.post("/orders", json={"customer_id": c["id"], "items": [{"product_id": p1["id"], "quantity": 1}]}, headers=auth_headers)

    r = client.get("/dashboard", headers=auth_headers)
    body = r.json()
    assert body["total_products"] == 2
    assert body["total_customers"] == 1
    assert body["total_orders"] == 1


def test_dashboard_low_stock(client, auth_headers):
    # Default LOW_STOCK_THRESHOLD is 10; create one low-stock product
    client.post("/products", json={"name": "Low", "sku": "LOW", "price": "1.00", "quantity": 3}, headers=auth_headers)
    client.post("/products", json={"name": "OK", "sku": "OK", "price": "1.00", "quantity": 50}, headers=auth_headers)

    r = client.get("/dashboard", headers=auth_headers)
    body = r.json()
    assert len(body["low_stock_products"]) == 1
    assert body["low_stock_products"][0]["sku"] == "LOW"


def test_dashboard_tenant_isolation(client, auth_headers):
    """Dashboard only shows the authenticated user's own data."""
    from helpers import register_and_login

    # User A creates data
    client.post("/products", json={"name": "A", "sku": "A", "price": "1.00", "quantity": 10}, headers=auth_headers)

    # User B should see zero
    user_b = register_and_login(client, username="userb")
    r = client.get("/dashboard", headers=user_b)
    assert r.json()["total_products"] == 0
