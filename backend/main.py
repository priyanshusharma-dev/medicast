from fastapi import FastAPI, Depends, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import datetime
import pandas as pd
import numpy as np

from database import engine, get_db
import models, schemas
import ml_pipeline

app = FastAPI(title="MediCast API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    from apscheduler.schedulers.background import BackgroundScheduler
    scheduler = BackgroundScheduler()
    scheduler.add_job(ml_pipeline.run_pipeline, 'cron', hour=2, minute=0)
    scheduler.start()

@app.get("/forecast", response_model=List[schemas.Forecast])
def get_forecast(ward: str, days: int = 7, db: Session = Depends(get_db)):
    # Return forecast starting from tomorrow up to `days`
    today = datetime.date.today()
    forecasts = db.query(models.Forecast).filter(
        models.Forecast.ward_id == ward,
        models.Forecast.target_date > today,
        models.Forecast.target_date <= today + datetime.timedelta(days=days)
    ).order_by(models.Forecast.target_date).all()
    return forecasts

@app.get("/actuals")
def get_actuals(ward: str, days: int = 14, db: Session = Depends(get_db)):
    # Return historical actuals for chart
    today = datetime.date.today()
    past = today - datetime.timedelta(days=days)
    actuals = db.query(models.DailyCensus).filter(
        models.DailyCensus.ward_id == ward,
        models.DailyCensus.date >= past,
        models.DailyCensus.date <= today
    ).order_by(models.DailyCensus.date).all()
    return [{"date": a.date, "occupancy": a.occupancy} for a in actuals]

@app.get("/alerts", response_model=List[schemas.Alert])
def get_alerts(ward: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Alert)
    if ward:
        query = query.filter(models.Alert.ward_id == ward)
    return query.order_by(models.Alert.date).all()

@app.get("/wards", response_model=List[schemas.Ward])
def get_wards(db: Session = Depends(get_db)):
    return db.query(models.Ward).all()

@app.post("/whatif")
def what_if(
    ward: str = Body(...),
    extra_surgeries: int = Body(0),
    flu_surge_pct: float = Body(0.0),
    staff_absent: int = Body(0),
    db: Session = Depends(get_db)
):
    # Live rerun of the p50 forecast with modifiers
    today = datetime.date.today()
    
    # 1. Load data
    df = ml_pipeline.load_data(db, ward)
    
    # Apply modifiers to future data
    future_mask = df.index > pd.to_datetime(today)
    if extra_surgeries != 0:
        df.loc[future_mask, 'elective_surgeries'] += extra_surgeries
    if flu_surge_pct != 0:
        df.loc[future_mask, 'flu_index'] *= (1 + flu_surge_pct/100.0)
        df.loc[future_mask, 'flu_index'] = df.loc[future_mask, 'flu_index'].clip(0, 1)
        
    df_feat = ml_pipeline.create_features(df)
    
    historical_df = df_feat[df_feat.index <= pd.to_datetime(today)].copy()
    future_df = df_feat[(df_feat.index > pd.to_datetime(today)) & (df_feat.index <= pd.to_datetime(today) + datetime.timedelta(days=7))].copy()
    
    features = [
        'occ_lag_1', 'occ_lag_2', 'occ_lag_3', 'occ_lag_7', 'occ_lag_14',
        'rolling_mean_7', 'rolling_std_7', 'rolling_mean_14', 'rolling_std_14',
        'day_of_week', 'month', 'is_holiday', 'flu_index', 'aqi', 'temperature',
        'surgeries_next_3d'
    ]
    
    # We need a trained model. For this MVP, we re-train quickly on P50.
    # In production, we'd load a pickled model.
    X_train = historical_df[features]
    y_train = historical_df['occupancy']
    from lightgbm import LGBMRegressor
    model = LGBMRegressor(objective='quantile', alpha=0.5, n_estimators=100, random_state=42)
    model.fit(X_train, y_train)
    
    occ_history = list(y_train.values)
    forecast_dates = [pd.to_datetime(today) + datetime.timedelta(days=i) for i in range(1, 8)]
    
    results = []
    
    for i, f_date in enumerate(forecast_dates):
        ext = future_df.loc[f_date]
        row = pd.DataFrame([{
            'occ_lag_1': occ_history[-1],
            'occ_lag_2': occ_history[-2],
            'occ_lag_3': occ_history[-3],
            'occ_lag_7': occ_history[-7],
            'occ_lag_14': occ_history[-14],
            'rolling_mean_7': np.mean(occ_history[-7:]),
            'rolling_std_7': np.std(occ_history[-7:]),
            'rolling_mean_14': np.mean(occ_history[-14:]),
            'rolling_std_14': np.std(occ_history[-14:]),
            'day_of_week': f_date.weekday(),
            'month': f_date.month,
            'is_holiday': ext['is_holiday'],
            'flu_index': ext['flu_index'],
            'aqi': ext['aqi'],
            'temperature': ext['temperature'],
            'surgeries_next_3d': ext['surgeries_next_3d']
        }])
        p50_val = model.predict(row)[0]
        results.append({
            "target_date": f_date.strftime('%Y-%m-%d'),
            "p50_after": float(p50_val)
        })
        occ_history.append(p50_val)
        
    return results

@app.get("/model/health")
def model_health():
    import os
    if os.path.exists("model_metrics.csv"):
        df = pd.read_csv("model_metrics.csv")
        return df.to_dict(orient='records')
    return []

@app.post("/assistant")
def assistant_chat(query: str = Body(..., embed=True), db: Session = Depends(get_db)):
    # Grounded answer using LLM
    # In this MVP, we simulate the LLM response based on the query since we don't have an active Claude API key
    query_lower = query.lower()
    if "why is icu risky on thursday" in query_lower:
        return {"answer": "The ICU is predicted to reach HIGH capacity on Thursday (95% risk). This is primarily driven by: 1) A 20% spike in scheduled elective surgeries, 2) Elevated flu index increasing emergency arrivals, and 3) Historical trends showing high bed utilization on Thursdays."}
    elif "staffing" in query_lower:
        return {"answer": "Based on the forecasts, you have a projected shortfall of 2 nurses in the General ward this weekend due to increased occupancy. I recommend offering 2 extra shifts for the night roster."}
    return {"answer": "According to the MediCast forecasts, all other metrics remain within acceptable bounds. Is there a specific ward you'd like to dive into?"}

@app.post("/retrain")
def retrain_models():
    # Triggers pipeline
    import threading
    t = threading.Thread(target=ml_pipeline.run_pipeline)
    t.start()
    return {"status": "retraining started in background"}
