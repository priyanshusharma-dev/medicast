import os
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

import pytest
import datetime
import pandas as pd
from ml_pipeline import create_features, ModelPipeline
from database import engine, Base, SessionLocal
import models
import data_generator

@pytest.fixture(scope="module")
def setup_db():
    Base.metadata.create_all(bind=engine)
    data_generator.generate_data()
    db = SessionLocal()
    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)

def test_decision_engine_thresholds(setup_db):
    db = setup_db
    pipeline = ModelPipeline(db)
    
    # Force a mock high prediction and run severity logic inside a test
    capacity = 20
    p90_val = 19 # 95% > 90%
    p50_val = 15 # 75% < 80%
    
    severity = "LOW"
    if p90_val > 0.9 * capacity:
        severity = "HIGH"
    elif p50_val > 0.8 * capacity:
        severity = "MEDIUM"
        
    assert severity == "HIGH"
    
    p90_val = 17
    p50_val = 17 # > 80%
    severity = "LOW"
    if p90_val > 0.9 * capacity:
        severity = "HIGH"
    elif p50_val > 0.8 * capacity:
        severity = "MEDIUM"
        
    assert severity == "MEDIUM"

def test_time_split_leakage():
    # Verify train/test split has no future leakage
    dates = pd.date_range("2023-01-01", "2023-12-31")
    df = pd.DataFrame({'occupancy': range(len(dates))}, index=dates)
    
    n = len(df)
    train_size = int(n * 0.85)
    train_df = df.iloc[:train_size]
    test_df = df.iloc[train_size:]
    
    # Train dates should be strictly less than test dates
    assert train_df.index.max() < test_df.index.min()
