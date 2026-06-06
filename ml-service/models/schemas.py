from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class BinType(str, Enum):
    GENERAL = "general"
    RECYCLABLE = "recyclable"
    ORGANIC = "organic"
    HAZARDOUS = "hazardous"

class WastePredictionRequest(BaseModel):
    bin_id: str
    bin_type: BinType
    current_level: float = Field(..., ge=0, le=100)
    capacity: float = Field(..., gt=0)
    location: Dict[str, float] = Field(..., description="Latitude and longitude")
    historical_data: List[Dict[str, Any]] = Field(default_factory=list)
    weather_data: Optional[Dict[str, Any]] = None
    time_horizon_hours: int = Field(default=24, ge=1, le=168)

class WastePredictionResponse(BaseModel):
    bin_id: str
    predicted_level: float = Field(..., ge=0, le=100)
    confidence: float = Field(..., ge=0, le=1)
    time_to_full_hours: Optional[float] = None
    recommended_collection_time: Optional[datetime] = None
    risk_level: str = Field(..., description="low, medium, high, critical")
    factors: List[str] = Field(default_factory=list)

class BinLocation(BaseModel):
    bin_id: str
    latitude: float
    longitude: float
    bin_type: BinType
    current_level: float = Field(..., ge=0, le=100)
    capacity: float = Field(..., gt=0)
    priority: int = Field(default=1, ge=1, le=5)

class RouteOptimizationRequest(BaseModel):
    bins: List[BinLocation]
    collector_location: Dict[str, float] = Field(..., description="Starting location")
    max_route_duration_hours: float = Field(default=8.0, gt=0)
    vehicle_capacity: float = Field(default=1000.0, gt=0)
    time_windows: Optional[Dict[str, Any]] = None

class RouteOptimizationResponse(BaseModel):
    optimized_route: List[str] = Field(..., description="Ordered list of bin IDs")
    total_distance_km: float
    estimated_duration_hours: float
    total_waste_collected: float
    efficiency_score: float = Field(..., ge=0, le=1)
    route_details: List[Dict[str, Any]]

class BinStatusPrediction(BaseModel):
    bin_id: str
    status: str = Field(..., description="active, full, overflowing, maintenance_needed")
    fill_rate_per_hour: float
    predicted_full_time: Optional[datetime] = None
    maintenance_required: bool = False
    alert_level: str = Field(..., description="none, low, medium, high, critical")

class CollectionSchedule(BaseModel):
    date: datetime
    routes: List[Dict[str, Any]]
    total_bins: int
    estimated_duration_hours: float
    resource_requirements: Dict[str, Any]

class ModelStatus(BaseModel):
    waste_prediction_model: Dict[str, Any]
    route_optimization_model: Dict[str, Any]
    last_trained: Optional[datetime]
    accuracy_metrics: Dict[str, float]
    status: str = Field(..., description="ready, training, error")









































