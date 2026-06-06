from fastapi.testclient import TestClient
from main import app

client = TestClient(app)
AUTH = {"Authorization": "Bearer test"}


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json().get("status") == "healthy"


def test_predict_waste():
    payload = {
        "bin_id": "BIN-1",
        "bin_type": "general",
        "current_level": 70,
        "capacity": 100,
        "location": {"latitude": 1.0, "longitude": 2.0},
        "time_horizon_hours": 24,
        "historical_data": [],
        "weather_data": None,
    }
    r = client.post("/predict/waste", json=payload, headers=AUTH)
    assert r.status_code == 200
    body = r.json()
    assert body["bin_id"] == "BIN-1"
    assert 0 <= body["predicted_level"] <= 100


def test_optimize_route_with_time_windows():
    payload = {
        "bins": [
            {
                "bin_id": "BIN-1",
                "latitude": 1.0,
                "longitude": 2.0,
                "bin_type": "general",
                "current_level": 80,
                "capacity": 100,
                "priority": 1,
            }
        ],
        "collector_location": {"latitude": 0.0, "longitude": 0.0},
        "time_windows": {
            "traffic_multiplier": 1.2,
            "windows": {"BIN-1": {"start": 1.0, "end": 3.0}},
        },
    }
    r = client.post("/optimize/route", json=payload, headers=AUTH)
    assert r.status_code == 200
    body = r.json()
    assert body["optimized_route"]
    assert body["route_details"][0]["estimated_arrival"]


def test_schedule_collections():
    payload = {"bins": [{"bin_id": "BIN-1", "current_level": 80}]}
    r = client.post("/schedule/collections", json=payload, headers=AUTH)
    assert r.status_code == 200
    body = r.json()
    assert body["total_bins"] >= 1









