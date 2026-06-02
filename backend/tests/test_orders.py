from helpers import register_and_login


# ── helpers ────────────────────────────────────────────────────────────────────

def _product(client, headers, sku="P1", quantity=50, price="10.00"):
    r = client.post(
        "/products",
        json={"name": "Test Product", "sku": sku, "price": price, "quantity": quantity},
        headers=headers,
    )
    assert r.status_code == 201
    return r.json()


def _customer(client, headers, email="cust@example.com"):
    r = client.post(
        "/customers",
        json={"full_name": "Test Customer", "email": email, "phone": "555-0000"},
        headers=headers,
    )
    assert r.status_code == 201
    return r.json()


def _order(client, headers, customer_id, items):
    r = client.post(
        "/orders",
        json={"customer_id": customer_id, "items": items},
        headers=headers,
    )
    return r


# ── create ─────────────────────────────────────────────────────────────────────

def test_create_order_deducts_stock(client, auth_headers):
    p = _product(client, auth_headers, quantity=20)
    c = _customer(client, auth_headers)

    r = _order(client, auth_headers, c["id"], [{"product_id": p["id"], "quantity": 5}])
    assert r.status_code == 201

    body = r.json()
    assert float(body["total_amount"]) == 50.0  # 5 * 10.00
    assert len(body["items"]) == 1

    # Confirm stock was deducted
    updated = client.get(f"/products/{p['id']}", headers=auth_headers).json()
    assert updated["quantity"] == 15


def test_create_order_total_amount(client, auth_headers):
    p1 = _product(client, auth_headers, sku="A", quantity=100, price="5.00")
    p2 = _product(client, auth_headers, sku="B", quantity=100, price="3.00")
    c = _customer(client, auth_headers)

    r = _order(client, auth_headers, c["id"], [
        {"product_id": p1["id"], "quantity": 2},
        {"product_id": p2["id"], "quantity": 4},
    ])
    assert r.status_code == 201
    assert float(r.json()["total_amount"]) == 22.0  # 2*5 + 4*3


def test_create_order_insufficient_stock(client, auth_headers):
    p = _product(client, auth_headers, quantity=3)
    c = _customer(client, auth_headers)

    r = _order(client, auth_headers, c["id"], [{"product_id": p["id"], "quantity": 10}])
    assert r.status_code == 422
    assert "Insufficient stock" in r.json()["detail"]


def test_create_order_unknown_product(client, auth_headers):
    c = _customer(client, auth_headers)
    r = _order(client, auth_headers, c["id"], [{"product_id": 9999, "quantity": 1}])
    assert r.status_code == 404


def test_create_order_unknown_customer(client, auth_headers):
    p = _product(client, auth_headers)
    r = _order(client, auth_headers, 9999, [{"product_id": p["id"], "quantity": 1}])
    assert r.status_code == 404


def test_create_order_duplicate_product_ids(client, auth_headers):
    p = _product(client, auth_headers)
    c = _customer(client, auth_headers)
    r = _order(client, auth_headers, c["id"], [
        {"product_id": p["id"], "quantity": 1},
        {"product_id": p["id"], "quantity": 2},
    ])
    assert r.status_code == 422


def test_create_order_zero_quantity(client, auth_headers):
    p = _product(client, auth_headers)
    c = _customer(client, auth_headers)
    r = _order(client, auth_headers, c["id"], [{"product_id": p["id"], "quantity": 0}])
    assert r.status_code == 422


def test_create_order_empty_items(client, auth_headers):
    c = _customer(client, auth_headers)
    r = _order(client, auth_headers, c["id"], [])
    assert r.status_code == 422


# ── list / get ─────────────────────────────────────────────────────────────────

def test_list_orders_empty(client, auth_headers):
    r = client.get("/orders", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["total"] == 0


def test_list_orders(client, auth_headers):
    p = _product(client, auth_headers, quantity=100)
    c = _customer(client, auth_headers)
    _order(client, auth_headers, c["id"], [{"product_id": p["id"], "quantity": 1}])
    _order(client, auth_headers, c["id"], [{"product_id": p["id"], "quantity": 1}])
    r = client.get("/orders", headers=auth_headers)
    assert r.json()["total"] == 2


def test_get_order(client, auth_headers):
    p = _product(client, auth_headers)
    c = _customer(client, auth_headers)
    order = _order(client, auth_headers, c["id"], [{"product_id": p["id"], "quantity": 1}]).json()

    r = client.get(f"/orders/{order['id']}", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["id"] == order["id"]


def test_get_order_not_found(client, auth_headers):
    r = client.get("/orders/9999", headers=auth_headers)
    assert r.status_code == 404


# ── delete ─────────────────────────────────────────────────────────────────────

def test_delete_order_restores_stock(client, auth_headers):
    p = _product(client, auth_headers, quantity=20)
    c = _customer(client, auth_headers)
    order = _order(client, auth_headers, c["id"], [{"product_id": p["id"], "quantity": 7}]).json()

    stock_after_order = client.get(f"/products/{p['id']}", headers=auth_headers).json()["quantity"]
    assert stock_after_order == 13

    r = client.delete(f"/orders/{order['id']}", headers=auth_headers)
    assert r.status_code == 204

    stock_restored = client.get(f"/products/{p['id']}", headers=auth_headers).json()["quantity"]
    assert stock_restored == 20


def test_delete_order_not_found(client, auth_headers):
    r = client.delete("/orders/9999", headers=auth_headers)
    assert r.status_code == 404


# ── tenant isolation ───────────────────────────────────────────────────────────

def test_tenant_isolation(client, auth_headers):
    p = _product(client, auth_headers)
    c = _customer(client, auth_headers)
    order = _order(client, auth_headers, c["id"], [{"product_id": p["id"], "quantity": 1}]).json()

    user_b = register_and_login(client, username="userb")
    assert client.get(f"/orders/{order['id']}", headers=user_b).status_code == 404
    assert client.get("/orders", headers=user_b).json()["total"] == 0
    assert client.delete(f"/orders/{order['id']}", headers=user_b).status_code == 404
