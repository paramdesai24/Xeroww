"""
tests/test_watchlist.py
────────────────────────
Tests for the watchlist domain: create, rename, delete, add/remove symbols.
"""



def _auth_headers(client, email: str) -> dict:
    client.post("/auth/register", json={
        "name": "WL User", "email": email, "password": "SecurePass1"
    })
    resp = client.post("/auth/login", json={"email": email, "password": "SecurePass1"})
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


class TestWatchlistCRUD:
    def test_default_watchlist_seeded_on_register(self, client):
        headers = _auth_headers(client, "wl_default@test.io")
        resp = client.get("/watchlists", headers=headers)
        assert resp.status_code == 200
        watchlists = resp.json()
        assert len(watchlists) >= 1
        # Default watchlist must be seeded
        defaults = [wl for wl in watchlists if wl["is_default"]]
        assert len(defaults) == 1

    def test_create_watchlist(self, client):
        headers = _auth_headers(client, "wl_create@test.io")
        resp = client.post("/watchlists", json={"name": "Tech Stocks"}, headers=headers)
        assert resp.status_code == 201
        assert resp.json()["name"] == "Tech Stocks"
        assert resp.json()["is_default"] is False

    def test_rename_watchlist(self, client):
        headers = _auth_headers(client, "wl_rename@test.io")
        create = client.post("/watchlists", json={"name": "Old Name"}, headers=headers)
        wl_id = create.json()["id"]
        resp = client.patch(f"/watchlists/{wl_id}", json={"name": "New Name"}, headers=headers)
        assert resp.status_code == 200
        assert resp.json()["name"] == "New Name"

    def test_delete_watchlist(self, client):
        headers = _auth_headers(client, "wl_delete@test.io")
        create = client.post("/watchlists", json={"name": "Delete Me"}, headers=headers)
        wl_id = create.json()["id"]
        resp = client.delete(f"/watchlists/{wl_id}", headers=headers)
        assert resp.status_code == 204
        # Confirm it's gone
        resp = client.get(f"/watchlists/{wl_id}", headers=headers)
        assert resp.status_code == 404

    def test_cannot_delete_default_watchlist(self, client):
        headers = _auth_headers(client, "wl_no_del_default@test.io")
        watchlists = client.get("/watchlists", headers=headers).json()
        default_id = next(wl["id"] for wl in watchlists if wl["is_default"])
        resp = client.delete(f"/watchlists/{default_id}", headers=headers)
        assert resp.status_code == 400


class TestWatchlistSymbols:
    def test_add_symbol(self, client):
        headers = _auth_headers(client, "wl_sym_add@test.io")
        create = client.post("/watchlists", json={"name": "Sym Test"}, headers=headers)
        wl_id = create.json()["id"]
        resp = client.post(f"/watchlists/{wl_id}/symbols", json={"symbol": "INFY.NS"}, headers=headers)
        assert resp.status_code == 201
        assert resp.json()["symbol"] == "INFY.NS"

    def test_add_duplicate_symbol_rejected(self, client):
        headers = _auth_headers(client, "wl_sym_dup@test.io")
        create = client.post("/watchlists", json={"name": "Dup Test"}, headers=headers)
        wl_id = create.json()["id"]
        client.post(f"/watchlists/{wl_id}/symbols", json={"symbol": "TCS.NS"}, headers=headers)
        resp = client.post(f"/watchlists/{wl_id}/symbols", json={"symbol": "TCS.NS"}, headers=headers)
        assert resp.status_code == 409

    def test_remove_symbol(self, client):
        headers = _auth_headers(client, "wl_sym_rem@test.io")
        create = client.post("/watchlists", json={"name": "Remove Test"}, headers=headers)
        wl_id = create.json()["id"]
        client.post(f"/watchlists/{wl_id}/symbols", json={"symbol": "HDFCBANK.NS"}, headers=headers)
        resp = client.delete(f"/watchlists/{wl_id}/symbols/HDFCBANK.NS", headers=headers)
        assert resp.status_code == 204

    def test_remove_nonexistent_symbol(self, client):
        headers = _auth_headers(client, "wl_sym_noex@test.io")
        create = client.post("/watchlists", json={"name": "NoEx Test"}, headers=headers)
        wl_id = create.json()["id"]
        resp = client.delete(f"/watchlists/{wl_id}/symbols/FAKE.NS", headers=headers)
        assert resp.status_code == 404

    def test_symbol_normalized_to_uppercase(self, client):
        headers = _auth_headers(client, "wl_sym_case@test.io")
        create = client.post("/watchlists", json={"name": "Case Test"}, headers=headers)
        wl_id = create.json()["id"]
        resp = client.post(f"/watchlists/{wl_id}/symbols", json={"symbol": "reliance.ns"}, headers=headers)
        assert resp.status_code == 201
        assert resp.json()["symbol"] == "RELIANCE.NS"
