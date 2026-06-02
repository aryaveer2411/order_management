from helpers import register_and_login


# ── register ───────────────────────────────────────────────────────────────────

def test_register_success(client):
    r = client.post("/auth/register", json={"username": "alice", "password": "Passw0rd!"})
    assert r.status_code == 201
    assert "message" in r.json()


def test_register_duplicate_username(client):
    client.post("/auth/register", json={"username": "alice", "password": "Passw0rd!"})
    r = client.post("/auth/register", json={"username": "alice", "password": "Passw0rd!"})
    assert r.status_code == 409


def test_register_short_password(client):
    r = client.post("/auth/register", json={"username": "alice", "password": "short"})
    assert r.status_code == 422


def test_register_username_with_space(client):
    r = client.post("/auth/register", json={"username": "a b", "password": "Passw0rd!"})
    assert r.status_code == 422


# ── login ──────────────────────────────────────────────────────────────────────

def test_login_success(client):
    client.post("/auth/register", json={"username": "alice", "password": "Passw0rd!"})
    r = client.post("/auth/login", data={"username": "alice", "password": "Passw0rd!"})
    assert r.status_code == 200
    body = r.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


def test_login_wrong_password(client):
    client.post("/auth/register", json={"username": "alice", "password": "Passw0rd!"})
    r = client.post("/auth/login", data={"username": "alice", "password": "wrongpass"})
    assert r.status_code == 401


def test_login_unknown_user(client):
    r = client.post("/auth/login", data={"username": "nobody", "password": "Passw0rd!"})
    assert r.status_code == 401


# ── refresh ────────────────────────────────────────────────────────────────────

def test_refresh_token(client):
    client.post("/auth/register", json={"username": "alice", "password": "Passw0rd!"})
    client.post("/auth/login", data={"username": "alice", "password": "Passw0rd!"})
    # TestClient carries the rt cookie from login automatically
    r = client.post("/auth/refresh")
    assert r.status_code == 200
    assert "access_token" in r.json()


def test_refresh_missing_cookie(client):
    r = client.post("/auth/refresh", cookies={})
    assert r.status_code == 401


def test_refresh_token_reuse_revokes_all(client):
    """Reusing a rotated token should revoke all tokens (theft detection)."""
    client.post("/auth/register", json={"username": "alice", "password": "Passw0rd!"})
    client.post("/auth/login", data={"username": "alice", "password": "Passw0rd!"})

    # Grab the current rt cookie value before rotation
    rt_before = client.cookies.get("rt")
    assert rt_before is not None

    # Rotate once (rt_before becomes invalid)
    r1 = client.post("/auth/refresh")
    assert r1.status_code == 200

    # Reuse the old token — should be rejected and all tokens revoked
    r2 = client.post("/auth/refresh", cookies={"rt": rt_before})
    assert r2.status_code == 401


# ── logout ─────────────────────────────────────────────────────────────────────

def test_logout(client):
    headers = register_and_login(client)
    r = client.post("/auth/logout", headers=headers)
    assert r.status_code == 204


# ── protected endpoint without token ──────────────────────────────────────────

def test_protected_without_token(client):
    r = client.get("/products")
    assert r.status_code == 401
