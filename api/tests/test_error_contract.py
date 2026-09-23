"""Tests for the application-wide API error envelope."""


def _register_login(client, email: str) -> dict[str, str]:
    client.post(
        "/auth/register",
        json={"name": "Error User", "email": email, "password": "SecurePass1"},
    )
    response = client.post(
        "/auth/login",
        json={"email": email, "password": "SecurePass1"},
    )
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_validation_error_has_readable_envelope(client):
    headers = _register_login(client, "validation-envelope@test.io")
    response = client.post("/portfolios", json={"name": ""}, headers=headers)

    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert body["detail"] == "Check the highlighted fields and try again."
    assert body["error"]["details"]["fields"] == [
        {"field": "name", "message": "Enter at least 1 character(s)."}
    ]
    assert body["request_id"]


def test_invalid_path_parameter_has_field_error(client):
    headers = _register_login(client, "path-envelope@test.io")
    response = client.get("/portfolios/not-a-number", headers=headers)

    assert response.status_code == 422
    fields = response.json()["error"]["details"]["fields"]
    assert fields == [
        {"field": "portfolio_id", "message": "Enter a valid whole number."}
    ]


def test_http_exception_uses_same_envelope(client):
    headers = _register_login(client, "http-envelope@test.io")
    response = client.get("/portfolios/999999", headers=headers)

    assert response.status_code == 404
    body = response.json()
    assert body["error"]["code"] == "RESOURCE_NOT_FOUND"
    assert body["detail"] == body["error"]["message"]
