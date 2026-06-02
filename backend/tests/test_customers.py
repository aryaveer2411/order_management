from helpers import register_and_login

_CUSTOMER = {"full_name": "Alice Smith", "email": "alice@example.com", "phone": "555-1234"}


def _create(client, headers, **overrides):
    payload = {**_CUSTOMER, **overrides}
    r = client.post("/customers", json=payload, headers=headers)
    assert r.status_code == 201
    return r.json()


# ── create ─────────────────────────────────────────────────────────────────────

def test_create_customer(client, auth_headers):
    r = client.post("/customers", json=_CUSTOMER, headers=auth_headers)
    assert r.status_code == 201
    body = r.json()
    assert body["full_name"] == "Alice Smith"
    assert body["email"] == "alice@example.com"
    assert "id" in body


def test_create_customer_duplicate_email(client, auth_headers):
    _create(client, auth_headers)
    r = client.post("/customers", json=_CUSTOMER, headers=auth_headers)
    assert r.status_code == 409


def test_create_customer_invalid_email(client, auth_headers):
    r = client.post("/customers", json={**_CUSTOMER, "email": "not-an-email"}, headers=auth_headers)
    assert r.status_code == 422


# ── list ───────────────────────────────────────────────────────────────────────

def test_list_customers_empty(client, auth_headers):
    r = client.get("/customers", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["total"] == 0


def test_list_customers(client, auth_headers):
    _create(client, auth_headers, email="a@example.com")
    _create(client, auth_headers, email="b@example.com")
    r = client.get("/customers", headers=auth_headers)
    assert r.json()["total"] == 2


def test_list_customers_pagination(client, auth_headers):
    for i in range(5):
        _create(client, auth_headers, email=f"user{i}@example.com")
    r = client.get("/customers?page=1&size=3", headers=auth_headers)
    body = r.json()
    assert len(body["items"]) == 3
    assert body["pages"] == 2


# ── get ────────────────────────────────────────────────────────────────────────

def test_get_customer(client, auth_headers):
    customer = _create(client, auth_headers)
    r = client.get(f"/customers/{customer['id']}", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["id"] == customer["id"]


def test_get_customer_not_found(client, auth_headers):
    r = client.get("/customers/9999", headers=auth_headers)
    assert r.status_code == 404


# ── delete ─────────────────────────────────────────────────────────────────────

def test_delete_customer(client, auth_headers):
    customer = _create(client, auth_headers)
    r = client.delete(f"/customers/{customer['id']}", headers=auth_headers)
    assert r.status_code == 204
    assert client.get(f"/customers/{customer['id']}", headers=auth_headers).status_code == 404


def test_delete_customer_not_found(client, auth_headers):
    r = client.delete("/customers/9999", headers=auth_headers)
    assert r.status_code == 404


# ── tenant isolation ───────────────────────────────────────────────────────────

def test_tenant_isolation(client, auth_headers):
    customer = _create(client, auth_headers)
    user_b = register_and_login(client, username="userb")

    assert client.get(f"/customers/{customer['id']}", headers=user_b).status_code == 404
    assert client.get("/customers", headers=user_b).json()["total"] == 0
    assert client.delete(f"/customers/{customer['id']}", headers=user_b).status_code == 404
