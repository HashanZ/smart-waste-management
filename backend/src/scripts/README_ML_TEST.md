# ML Functions Test Script

## Overview

The `testMLFunctions.ts` script is a comprehensive test suite that verifies all ML-related functionality in the Smart Waste Management system via the dashboard API endpoints.

## What It Tests

1. **ML Service Health Check** - Verifies the ML service is running and healthy
2. **Waste Predictions** - Tests prediction generation for bins
3. **Prediction Accuracy Metrics** - Validates accuracy tracking (MAE, RMSE, MAPE)
4. **Route Optimization** - Tests ML-powered route optimization
5. **Prediction Data** - Checks prediction data stored in database
6. **Prediction Accuracy Data** - Verifies accuracy records in database
7. **Automatic Collection Scheduling** - Checks for automatically scheduled collections
8. **Dashboard Data** - Validates dashboard endpoint including ML health

## Prerequisites

1. **Backend API Server** must be running on `http://localhost:3000` (or set `API_URL` env variable)
2. **ML Service** must be running on `http://localhost:8000`
3. **MongoDB** must be running and accessible
4. **Test User Account** - Default: `admin@example.com` / `admin123` (or set `TEST_EMAIL` and `TEST_PASSWORD`)

## Usage

### Basic Usage

```bash
# From backend directory
npm run test:ml
```

### With Custom Environment Variables

```bash
# Set custom API URL
API_URL=http://localhost:3000 npm run test:ml

# Set custom test credentials
TEST_EMAIL=your@email.com TEST_PASSWORD=yourpassword npm run test:ml

# Combined
API_URL=http://localhost:3000 TEST_EMAIL=admin@test.com TEST_PASSWORD=admin123 npm run test:ml
```

### Direct Execution

```bash
# Using ts-node directly
ts-node -r tsconfig-paths/register src/scripts/testMLFunctions.ts
```

## Test Output

The script provides detailed output for each test:

```
🧪 Testing: ML Service Health Check
   Health Status: ✅ Healthy
   Model Trained: ✅ Yes
   Latency: 45ms
✅ PASS: ML Service Health Check (123ms)
```

## Test Results Summary

At the end, you'll see a comprehensive summary:

```
📊 Test Summary
============================================================
Total Tests: 8
✅ Passed: 7
❌ Failed: 1
⏭️  Skipped: 0
```

## Expected Results

### ✅ All Tests Should Pass When:

- ML service is running and healthy
- Model is trained (`waste_prediction_model.pkl` exists)
- At least 2 active bins exist in database
- Predictions have been generated (via scheduler or manual trigger)
- Backend API is accessible and authenticated

### ⚠️ Some Tests May Show Warnings When:

- No predictions exist yet (normal for new installations)
- No accuracy records exist yet (normal if predictions haven't been validated)
- No automatic collections scheduled (normal if scheduler hasn't run)

## Troubleshooting

### Authentication Failed

**Error:** `❌ Authentication failed`

**Solution:**
- Ensure backend server is running
- Check test credentials in `.env` or use `TEST_EMAIL` and `TEST_PASSWORD` env variables
- Verify user exists in database

### ML Service Not Healthy

**Error:** `ML service is not healthy`

**Solution:**
- Start ML service: `cd ml-service && python main.py`
- Check ML service is accessible at `http://localhost:8000`
- Verify ML service health endpoint: `curl http://localhost:8000/health`

### No Bins Found

**Error:** `No active bins found in database`

**Solution:**
- Import synthetic data: `npm run import:synthetic`
- Or create bins manually via dashboard

### Connection Errors

**Error:** `ECONNREFUSED` or connection timeout

**Solution:**
- Ensure backend server is running: `npm run dev`
- Check `API_URL` environment variable matches your server URL
- Verify firewall/network settings

## Integration with CI/CD

You can integrate this test script into your CI/CD pipeline:

```yaml
# Example GitHub Actions
- name: Test ML Functions
  run: |
    npm run test:ml
  env:
    API_URL: http://localhost:3000
    TEST_EMAIL: ${{ secrets.TEST_EMAIL }}
    TEST_PASSWORD: ${{ secrets.TEST_PASSWORD }}
```

## Exit Codes

- `0` - All tests passed
- `1` - One or more tests failed

## Notes

- Tests are run sequentially (not in parallel)
- Each test has a 30-second timeout
- Tests require database connection
- Tests require valid authentication token
- Some tests may be skipped if prerequisites aren't met (e.g., no bins)

## Related Scripts

- `trainMLModel.ts` - Train the ML model
- `triggerPredictions.ts` - Manually trigger predictions for all bins
- `importSyntheticData.ts` - Import test data



