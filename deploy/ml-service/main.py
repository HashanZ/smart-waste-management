from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Dict, Any
import uvicorn
import os
from dotenv import load_dotenv

from models.schemas import (
    WastePredictionRequest, WastePredictionResponse,
    RouteOptimizationRequest, RouteOptimizationResponse
)
from services.ml_service import MLService

# Load environment variables
load_dotenv()

app = FastAPI(
    title="Smart Waste Management ML Service",
    description="Machine Learning service for waste prediction and route optimization",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()

# Initialize ML service
ml_service = MLService()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Simple token validation - in production, validate against backend"""
    if not credentials.credentials:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    return {"user_id": "ml_service_user"}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "ml-service"}

@app.post("/predict/waste", response_model=WastePredictionResponse)
async def predict_waste_accumulation(
    request: WastePredictionRequest,
    current_user: dict = Depends(get_current_user)
):
    """Predict waste accumulation for bins"""
    try:
        prediction = await ml_service.predict_waste_accumulation(request)
        return prediction
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/optimize/route", response_model=RouteOptimizationResponse)
async def optimize_collection_route(
    request: RouteOptimizationRequest,
    current_user: dict = Depends(get_current_user)
):
    """Optimize collection routes for waste bins"""
    try:
        optimization = await ml_service.optimize_collection_route(request)
        return optimization
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/schedule/collections")
async def schedule_collections(
    schedule_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Generate optimal collection schedules"""
    try:
        schedule = await ml_service.generate_collection_schedule(schedule_data)
        return schedule
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/train/model")
async def train_model(
    training_data: List[Dict[str, Any]],
    current_user: dict = Depends(get_current_user)
):
    """Train waste prediction model with historical data"""
    try:
        result = await ml_service.train_model(training_data)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import os
    # Use port 8888 as default (8001 is in Windows excluded port range 7989-8088)
    port = int(os.getenv("ML_SERVICE_PORT", "8888"))
    host = os.getenv("ML_SERVICE_HOST", "127.0.0.1")  # Use localhost instead of 0.0.0.0 for Windows
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=True
    )









































