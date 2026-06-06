import os
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import asyncio
import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from ortools.constraint_solver import routing_enums_pb2
from ortools.constraint_solver import pywrapcp

from models.schemas import (
    WastePredictionRequest, WastePredictionResponse,
    RouteOptimizationRequest, RouteOptimizationResponse,
    CollectionSchedule
)

class MLService:
    def __init__(self):
        self.waste_model = None
        self.route_optimizer = None
        self.scaler = StandardScaler()
        self.model_trained = False
        self.model_path = 'models/waste_prediction_model.pkl'
        self.scaler_path = 'models/scaler.pkl'

        # Create models directory if it doesn't exist
        os.makedirs('models', exist_ok=True)

        # Try to load existing model
        self.load_model()

    def load_model(self):
        """Load trained model if available"""
        try:
            if os.path.exists(self.model_path) and os.path.exists(self.scaler_path):
                self.waste_model = joblib.load(self.model_path)
                self.scaler = joblib.load(self.scaler_path)
                self.model_trained = True
                print("✅ Loaded trained ML model")
            else:
                print("⚠️ No trained model found, using rule-based predictions")
                self.model_trained = False
        except Exception as e:
            print(f"⚠️ Could not load model: {e}")
            self.model_trained = False

    async def train_model(self, training_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Train waste prediction model with historical data"""
        try:
            if len(training_data) < 50:
                return {
                    "success": False,
                    "message": f"Need at least 50 data points, got {len(training_data)}. Continue collecting data."
                }

            # Convert to DataFrame
            df = pd.DataFrame(training_data)

            # Ensure required columns exist and handle missing values
            required_cols = ['fillLevel', 'binType', 'dayOfWeek', 'hourOfDay', 'latitude', 'longitude', 'actualFillLevel24h']
            missing_cols = [col for col in required_cols if col not in df.columns]
            if missing_cols:
                raise ValueError(f"Missing required columns: {missing_cols}")

            # Fill missing binType with 'general' (default)
            df['binType'] = df['binType'].fillna('general')

            # Ensure numeric columns are numeric
            df['latitude'] = pd.to_numeric(df['latitude'], errors='coerce').fillna(0)
            df['longitude'] = pd.to_numeric(df['longitude'], errors='coerce').fillna(0)
            df['fillLevel'] = pd.to_numeric(df['fillLevel'], errors='coerce').fillna(0)
            df['dayOfWeek'] = pd.to_numeric(df['dayOfWeek'], errors='coerce').fillna(0)
            df['hourOfDay'] = pd.to_numeric(df['hourOfDay'], errors='coerce').fillna(0)
            df['actualFillLevel24h'] = pd.to_numeric(df['actualFillLevel24h'], errors='coerce').fillna(df['fillLevel'])

            # Prepare features
            # Encode bin type
            bin_type_map = {'general': 0, 'recyclable': 1, 'organic': 2, 'hazardous': 3}
            df['binType_encoded'] = df['binType'].map(bin_type_map).fillna(0)  # Default to 'general' if unknown

            # Features
            feature_columns = ['fillLevel', 'binType_encoded', 'dayOfWeek', 'hourOfDay', 'latitude', 'longitude']
            X = df[feature_columns].values

            # Target: actual fill level 24h later
            y = df['actualFillLevel24h'].values

            # Split data
            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42
            )

            # Scale features
            X_train_scaled = self.scaler.fit_transform(X_train)
            X_test_scaled = self.scaler.transform(X_test)

            # Train model
            self.waste_model = RandomForestRegressor(
                n_estimators=100,
                max_depth=10,
                random_state=42,
                n_jobs=-1
            )
            self.waste_model.fit(X_train_scaled, y_train)

            # Evaluate
            train_score = self.waste_model.score(X_train_scaled, y_train)
            test_score = self.waste_model.score(X_test_scaled, y_test)

            # Save model
            joblib.dump(self.waste_model, self.model_path)
            joblib.dump(self.scaler, self.scaler_path)

            # Reload model to ensure it's in memory (in case it was already loaded)
            self.load_model()

            return {
                "success": True,
                "train_score": float(train_score),
                "test_score": float(test_score),
                "n_samples": len(training_data),
                "message": f"Model trained successfully! Train R²: {train_score:.3f}, Test R²: {test_score:.3f}"
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Training error: {str(e)}"
            }

    async def predict_waste_accumulation(self, request: WastePredictionRequest) -> WastePredictionResponse:
        """Predict waste accumulation - uses trained model if available"""
        try:
            # If model is trained, use it
            if self.model_trained and self.waste_model:
                return await self._predict_with_model(request)
            else:
                # Fallback to rule-based
                return await self._predict_rule_based(request)

        except Exception as e:
            # Fallback on error
            print(f"Model prediction error: {e}, using rule-based fallback")
            return await self._predict_rule_based(request)

    async def _predict_with_model(self, request: WastePredictionRequest) -> WastePredictionResponse:
        """Predict using trained ML model"""
        try:
            # Prepare features
            bin_type_map = {'general': 0, 'recyclable': 1, 'organic': 2, 'hazardous': 3}
            now = datetime.now()

            features = np.array([[
                request.current_level,
                bin_type_map.get(request.bin_type, 0),
                now.weekday(),
                now.hour,
                request.location.get('latitude', 0),
                request.location.get('longitude', 0)
            ]])

            # Scale features
            features_scaled = self.scaler.transform(features)

            # Predict
            predicted_level = self.waste_model.predict(features_scaled)[0]
            predicted_level = max(0, min(100, float(predicted_level)))  # Clamp to 0-100

            # Calculate confidence (use model's feature importance as proxy)
            confidence = 0.85  # Can be improved with prediction intervals

            # Calculate time to full
            fill_rate = (predicted_level - request.current_level) / request.time_horizon_hours
            time_to_full = None
            if fill_rate > 0:
                remaining = 100 - request.current_level
                time_to_full = remaining / fill_rate

            risk_level = self._determine_risk_level(predicted_level, fill_rate)

            return WastePredictionResponse(
                bin_id=request.bin_id,
                predicted_level=round(predicted_level, 2),
                confidence=round(confidence, 2),
                time_to_full_hours=round(time_to_full, 2) if time_to_full else None,
                recommended_collection_time=datetime.now() + timedelta(hours=2) if predicted_level > 85 else None,
                risk_level=risk_level,
                factors=["Trained ML model", "Historical patterns", f"Bin type: {request.bin_type}"]
            )

        except Exception as e:
            # Fallback to rule-based on error
            print(f"Model prediction error: {e}")
            return await self._predict_rule_based(request)

    async def _predict_rule_based(self, request: WastePredictionRequest) -> WastePredictionResponse:
        """Original rule-based prediction (fallback)"""
        try:
            # Simple prediction logic - in production, use trained ML model
            base_fill_rate = self._get_base_fill_rate(request.bin_type)

            # Adjust based on current level
            if request.current_level > 80:
                fill_rate = base_fill_rate * 1.5  # Faster filling when nearly full
            elif request.current_level > 50:
                fill_rate = base_fill_rate * 1.2
            else:
                fill_rate = base_fill_rate

            # Weather adjustment
            if request.weather_data:
                weather_factor = self._get_weather_factor(request.weather_data)
                fill_rate *= weather_factor

            # Predict level after time horizon
            predicted_level = min(100, request.current_level + (fill_rate * request.time_horizon_hours))

            # Calculate confidence based on data quality
            confidence = 0.8 if request.historical_data else 0.6

            # Determine risk level
            risk_level = self._determine_risk_level(predicted_level, fill_rate)

            # Calculate time to full
            time_to_full = None
            if fill_rate > 0:
                remaining_capacity = 100 - request.current_level
                time_to_full = remaining_capacity / fill_rate

            # Recommend collection time
            recommended_collection_time = None
            if predicted_level > 85:
                recommended_collection_time = datetime.now() + timedelta(hours=2)

            return WastePredictionResponse(
                bin_id=request.bin_id,
                predicted_level=round(predicted_level, 2),
                confidence=round(confidence, 2),
                time_to_full_hours=round(time_to_full, 2) if time_to_full else None,
                recommended_collection_time=recommended_collection_time,
                risk_level=risk_level,
                factors=self._get_prediction_factors(request)
            )

        except Exception as e:
            raise Exception(f"Error in waste prediction: {str(e)}")

    async def optimize_collection_route(self, request: RouteOptimizationRequest) -> RouteOptimizationResponse:
        """Optimize collection route using OR-Tools"""
        try:
            if len(request.bins) < 2:
                return RouteOptimizationResponse(
                    optimized_route=[bin.bin_id for bin in request.bins],
                    total_distance_km=0,
                    estimated_duration_hours=0,
                    total_waste_collected=sum(bin.current_level for bin in request.bins),
                    efficiency_score=1.0,
                    route_details=[]
                )

            # Create distance matrix
            distance_matrix = self._create_distance_matrix(request.bins, request.collector_location)

            # Solve TSP using OR-Tools
            route_indices = self._solve_tsp(distance_matrix)

            # Convert indices to bin IDs
            optimized_route = [request.bins[i].bin_id for i in route_indices[1:]]  # Skip depot

            # Calculate metrics
            total_distance = self._calculate_route_distance(route_indices, distance_matrix)
            total_waste = sum(bin.current_level for bin in request.bins)
            efficiency_score = min(1.0, total_waste / (total_distance + 1))

            # Handle optional time windows and traffic multiplier (soft constraints)
            traffic_multiplier = 1.0
            windows_by_bin: Dict[str, Dict[str, Any]] = {}
            if request.time_windows and isinstance(request.time_windows, dict):
                traffic_multiplier = float(request.time_windows.get("traffic_multiplier", 1.0) or 1.0)
                windows_by_bin = request.time_windows.get("windows", {}) or {}

            # Build route details with ETA considering traffic multiplier and simple waiting to satisfy windows
            route_details = []
            current_time_hours = 0.0
            base_leg_hours = 0.5  # simple per-leg duration proxy; scaled by traffic
            for i, bin_idx in enumerate(route_indices[1:], 1):
                bin = request.bins[bin_idx]

                # travel time for this leg scaled by traffic
                travel_time = base_leg_hours * traffic_multiplier
                current_time_hours += travel_time

                # apply basic time window waiting if defined (expects start/end in hours from route start)
                win = windows_by_bin.get(bin.bin_id)
                if isinstance(win, dict):
                    start = win.get("start")  # e.g., 2.0
                    end = win.get("end")
                    if isinstance(start, (int, float)) and current_time_hours < float(start):
                        # wait until window opens
                        current_time_hours = float(start)
                    # if arrives after end, we still record the ETA; no hard constraints

                route_details.append({
                    "order": i,
                    "bin_id": bin.bin_id,
                    "bin_type": bin.bin_type,
                    "location": {"latitude": bin.latitude, "longitude": bin.longitude},
                    "waste_level": bin.current_level,
                    "estimated_arrival": f"{current_time_hours:.1f} hours"
                })

            estimated_duration_hours = current_time_hours if route_details else 0.0

            return RouteOptimizationResponse(
                optimized_route=optimized_route,
                total_distance_km=round(total_distance, 2),
                estimated_duration_hours=round(estimated_duration_hours, 2),
                total_waste_collected=round(total_waste, 2),
                efficiency_score=round(efficiency_score, 2),
                route_details=route_details
            )

        except Exception as e:
            raise Exception(f"Error in route optimization: {str(e)}")

    async def generate_collection_schedule(self, schedule_data: Dict[str, Any]) -> CollectionSchedule:
        """Generate optimal collection schedule"""
        try:
            bins = schedule_data.get("bins", [])
            date = datetime.now().date()

            # Group bins by area/route
            routes = self._group_bins_by_area(bins)

            total_bins = len(bins)
            estimated_duration = len(routes) * 2  # 2 hours per route

            return CollectionSchedule(
                date=datetime.combine(date, datetime.min.time()),
                routes=routes,
                total_bins=total_bins,
                estimated_duration_hours=estimated_duration,
                resource_requirements={
                    "collectors_needed": len(routes),
                    "vehicles_needed": len(routes),
                    "estimated_fuel": estimated_duration * 10  # 10L per hour
                }
            )

        except Exception as e:
            raise Exception(f"Error in schedule generation: {str(e)}")

    # bin status and model status removed per requirement

    def _get_base_fill_rate(self, bin_type: str) -> float:
        """Get base fill rate for bin type (percentage per hour)"""
        rates = {
            "general": 2.5,
            "recyclable": 1.8,
            "organic": 3.2,
            "hazardous": 0.8
        }
        return rates.get(bin_type, 2.0)

    def _get_weather_factor(self, weather_data: Dict[str, Any]) -> float:
        """Adjust fill rate based on weather conditions"""
        # Simple weather adjustment
        temperature = weather_data.get("temperature", 20)
        precipitation = weather_data.get("precipitation", 0)

        factor = 1.0

        # Higher temperature might increase waste generation
        if temperature > 30:
            factor *= 1.1
        elif temperature < 5:
            factor *= 0.9

        # Precipitation might reduce outdoor waste
        if precipitation > 0.5:
            factor *= 0.8

        return factor

    def _determine_risk_level(self, predicted_level: float, fill_rate: float) -> str:
        """Determine risk level based on prediction"""
        if predicted_level >= 95 or fill_rate > 5:
            return "critical"
        elif predicted_level >= 85 or fill_rate > 3:
            return "high"
        elif predicted_level >= 70 or fill_rate > 2:
            return "medium"
        else:
            return "low"

    def _get_prediction_factors(self, request: WastePredictionRequest) -> List[str]:
        """Get factors influencing the prediction"""
        factors = []

        if request.current_level > 80:
            factors.append("High current fill level")

        if request.weather_data:
            factors.append("Weather conditions considered")

        if request.historical_data:
            factors.append("Historical data analyzed")

        if request.bin_type == "organic":
            factors.append("Organic waste decomposition rate")

        return factors

    def _haversine_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance between two points using Haversine formula (accurate for real distances)"""
        R = 6371  # Earth radius in km

        lat1_rad = radians(lat1)
        lat2_rad = radians(lat2)
        delta_lat = radians(lat2 - lat1)
        delta_lon = radians(lon2 - lon1)

        a = sin(delta_lat/2)**2 + cos(lat1_rad) * cos(lat2_rad) * sin(delta_lon/2)**2
        c = 2 * atan2(sqrt(a), sqrt(1-a))

        return R * c

    def _create_distance_matrix(self, bins: List, collector_location: Dict[str, float]) -> List[List[float]]:
        """Create distance matrix for TSP using Haversine formula"""
        n = len(bins) + 1  # +1 for depot
        matrix = [[0.0] * n for _ in range(n)]

        # Calculate distances
        for i in range(n):
            for j in range(n):
                if i == j:
                    continue

                if i == 0:  # From depot
                    lat1, lon1 = collector_location["latitude"], collector_location["longitude"]
                else:
                    bin = bins[i-1]
                    lat1, lon1 = bin.latitude, bin.longitude

                if j == 0:  # To depot
                    lat2, lon2 = collector_location["latitude"], collector_location["longitude"]
                else:
                    bin = bins[j-1]
                    lat2, lon2 = bin.latitude, bin.longitude

                # Use Haversine formula for accurate distance
                distance = self._haversine_distance(lat1, lon1, lat2, lon2)
                matrix[i][j] = distance

        return matrix

    def _solve_tsp(self, distance_matrix: List[List[float]]) -> List[int]:
        """Solve TSP using OR-Tools"""
        manager = pywrapcp.RoutingIndexManager(len(distance_matrix), 1, 0)
        routing = pywrapcp.RoutingModel(manager)

        def distance_callback(from_index, to_index):
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            return distance_matrix[from_node][to_node]

        transit_callback_index = routing.RegisterTransitCallback(distance_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

        search_parameters = pywrapcp.DefaultRoutingSearchParameters()
        search_parameters.first_solution_strategy = (
            routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
        )

        solution = routing.SolveWithParameters(search_parameters)

        if solution:
            route = []
            index = routing.Start(0)
            while not routing.IsEnd(index):
                route.append(manager.IndexToNode(index))
                index = solution.Value(routing.NextVar(index))
            route.append(manager.IndexToNode(index))
            return route

        return list(range(len(distance_matrix)))

    def _calculate_route_distance(self, route: List[int], distance_matrix: List[List[float]]) -> float:
        """Calculate total distance of route"""
        total_distance = 0.0
        for i in range(len(route) - 1):
            total_distance += distance_matrix[route[i]][route[i + 1]]
        return total_distance

    def _group_bins_by_area(self, bins: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Group bins by geographical area for route planning"""
        # Simple grouping by proximity (in production, use clustering)
        routes = []
        current_route = []

        for i, bin in enumerate(bins):
            current_route.append({
                "bin_id": bin.get("bin_id", f"bin_{i}"),
                "location": bin.get("location", {}),
                "waste_level": bin.get("current_level", 0)
            })

            # Create new route every 5 bins
            if len(current_route) >= 5:
                routes.append({
                    "route_id": f"route_{len(routes) + 1}",
                    "bins": current_route,
                    "estimated_duration": len(current_route) * 0.5
                })
                current_route = []

        # Add remaining bins
        if current_route:
            routes.append({
                "route_id": f"route_{len(routes) + 1}",
                "bins": current_route,
                "estimated_duration": len(current_route) * 0.5
            })

        return routes
