from helpers import register_and_login

_PRODUCT = {"name": "Widget", "sku": "SKU-001", "price": "9.99", "quantity": 100}


def _create(client, headers, **overrides):
    payload = {**_PRODUCT, **overrides}
    r = client.post("/products", json=payload, headers=headers)
    assert r.status_code == 201
    return r.json()


# ── create ─────────────────────────────────────────────────────────────────────

def test_create_product(client, auth_headers):
    r = client.post("/products", json=_PRODUCT, headers=auth_headers)
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "Widget"
    assert body["sku"] == "SKU-001"
    assert float(body["price"]) == 9.99
    assert body["quantity"] == 100
    assert "id" in body


def test_create_product_duplicate_sku(client, auth_headers):
    _create(client, auth_headers)
    r = client.post("/products", json=_PRODUCT, headers=auth_headers)
    assert r.status_code == 409


def test_create_product_negative_price(client, auth_headers):
    r = client.post("/products", json={**_PRODUCT, "price": "-1"}, headers=auth_headers)
    assert r.status_code == 422


def test_create_product_negative_quantity(client, auth_headers):
    r = client.post("/products", json={**_PRODUCT, "quantity": -5}, headers=auth_headers)
    assert r.status_code == 422


# ── list ───────────────────────────────────────────────────────────────────────

def test_list_products_empty(client, auth_headers):
    r = client.get("/products", headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 0
    assert body["items"] == []


def test_list_products(client, auth_headers):
    _create(client, auth_headers, sku="A")
    _create(client, auth_headers, sku="B")
    r = client.get("/products", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["total"] == 2


def test_list_products_pagination(client, auth_headers):
    for i in range(5):
        _create(client, auth_headers, sku=f"S{i}")
    r = client.get("/products?page=1&size=2", headers=auth_headers)
    body = r.json()
    assert len(body["items"]) == 2
    assert body["total"] == 5
    assert body["pages"] == 3


# ── get ────────────────────────────────────────────────────────────────────────

def test_get_product(client, auth_headers):
    product = _create(client, auth_headers)
    r = client.get(f"/products/{product['id']}", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["id"] == product["id"]


def test_get_product_not_found(client, auth_headers):
    r = client.get("/products/9999", headers=auth_headers)
    assert r.status_code == 404


# ── update (PUT) ───────────────────────────────────────────────────────────────

def test_update_product(client, auth_headers):
    product = _create(client, auth_headers)
    r = client.put(
        f"/products/{product['id']}",
        json={"name": "Gadget", "sku": "SKU-002", "price": "19.99", "quantity": 50},
        headers=auth_headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["name"] == "Gadget"
    assert body["sku"] == "SKU-002"
    assert body["quantity"] == 50


def test_update_product_requires_all_fields(client, auth_headers):
    """PUT must reject partial payloads (missing required fields)."""
    product = _create(client, auth_headers)
    r = client.put(
        f"/products/{product['id']}",
        json={"name": "Gadget"},
        headers=auth_headers,
    )
    assert r.status_code == 422


def test_update_product_not_found(client, auth_headers):
    r = client.put(
        "/products/9999",
        json={"name": "X", "sku": "X", "price": "1.00", "quantity": 1},
        headers=auth_headers,
    )
    assert r.status_code == 404


# ── delete ─────────────────────────────────────────────────────────────────────

def test_delete_product(client, auth_headers):
    product = _create(client, auth_headers)
    r = client.delete(f"/products/{product['id']}", headers=auth_headers)
    assert r.status_code == 204
    assert client.get(f"/products/{product['id']}", headers=auth_headers).status_code == 404


def test_delete_product_not_found(client, auth_headers):
    r = client.delete("/products/9999", headers=auth_headers)
    assert r.status_code == 404


# ── tenant isolation ───────────────────────────────────────────────────────────

def test_tenant_isolation(client, auth_headers):
    """User B must not see or modify User A's products."""
    product = _create(client, auth_headers)

    user_b = register_and_login(client, username="userb")

    # B cannot read A's product
    assert client.get(f"/products/{product['id']}", headers=user_b).status_code == 404
    # B's list is empty
    assert client.get("/products", headers=user_b).json()["total"] == 0
    # B cannot update A's product
    assert client.put(
        f"/products/{product['id']}",
        json={"name": "X", "sku": "X", "price": "1.00", "quantity": 1},
        headers=user_b,
    ).status_code == 404
    # B cannot delete A's product
    assert client.delete(f"/products/{product['id']}", headers=user_b).status_code == 404
