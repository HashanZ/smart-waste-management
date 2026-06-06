# Machine Learning & Route Optimization Models

The ML microservice uses prediction models and operations research tools to optimize waste collection routes dynamically.

## 1. Waste Generation Prediction

- **Algorithm**: Random Forest Regressor / Linear Regressor (Scikit-Learn).
- **Features Used**: Historical fill levels, day of the week, hour of the day, seasonality, and location-specific generation rate.
- **Model Storage**: Trained model weights are serialized as `waste_prediction_model.pkl` along with `scaler.pkl`.
- **Inference**: Predicts how long it will take for a specific bin to overflow based on real-time sensor updates.

## 2. Route Optimization (Vehicle Routing Problem)

- **Library**: Google OR-Tools (Operations Research).
- **Inputs**: Coordinates of all active waste bins, current fill levels, vehicle capacity constraints, and depot coordinates.
- **Output**: An ordered sequence of waypoint coordinates representing the shortest path to collect overflow/full bins (fill level >= 90%).

## 3. Local Training & Inference

To trigger synthetic dataset generation and model training locally:

```bash
# Generate mock records
npm run generate:synthetic

# Train models using scripts in ml-service/scripts
# Inference is run automatically as a background service via uvicorn
```
