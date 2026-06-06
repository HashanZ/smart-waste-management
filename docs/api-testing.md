# API Testing Guide

The Node.js Express server exposes REST APIs for authentication, bin management, and route generation.

## Primary REST Endpoints

### 1. Authentication
- **`POST /api/auth/register`**: Creates a new user profile.
- **`POST /api/auth/login`**: Authenticates user credentials and returns a JSON Web Token (JWT).

### 2. Bin Operations
- **`GET /api/bins`**: Lists all bins (requires JWT authorization header).
- **`POST /api/bins`**: Registers a new bin (requires admin authorization).
- **`POST /api/bins/iot/update`**: Receives raw sensor payloads from ESP32 nodes (requires no JWT).
  - *Payload format*:
    ```json
    {
      "binId": "BIN001",
      "fillLevel": 85.5,
      "batteryLevel": 90,
      "signalStrength": 65
    }
    ```

### 3. Collections & Routing
- **`GET /api/routes/optimize`**: Triggers Google OR-Tools model execution and returns optimized waypoints.
- **`POST /api/collections/empty`**: Marks a bin as emptied.

---

## Postman API Verification
Import the Postman collections located under `/docs` to execute step-by-step requests. Ensure the `Authorization` header is set to `Bearer <YOUR_JWT_TOKEN>` for restricted routes.
