def register_and_login(client, username="testuser", password="Passw0rd!"):
    client.post("/auth/register", json={"username": username, "password": password})
    r = client.post("/auth/login", data={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}
