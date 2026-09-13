from app import create_app


def test_index_page():
    client = create_app().test_client()

    response = client.get("/")

    assert response.status_code == 200
    assert b"API Filtrada" in response.data


def test_health_endpoint():
    client = create_app().test_client()

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json == {"status": "ok"}
