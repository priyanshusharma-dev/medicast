import pandas as pd
import numpy as np
import datetime
from sqlalchemy.orm import Session
from database import SessionLocal, engine
from models import Ward, DailyCensus, ExternalSignals, OTSchedule, Forecast, Alert
from lightgbm import LGBMRegressor
from statsmodels.tsa.statespace.sarimax import SARIMAX
import shap
from sklearn.metrics import mean_absolute_error, mean_squared_error
import warnings
warnings.filterwarnings('ignore')

def smape(y_true, y_pred):
    return 100/len(y_true) * np.sum(2 * np.abs(y_pred - y_true) / (np.abs(y_true) + np.abs(y_pred) + 1e-10))

def pinball_loss(y_true, y_pred, alpha):
    diff = y_true - y_pred
    return np.mean(np.maximum(alpha * diff, (alpha - 1) * diff))

def load_data(db: Session, ward_id: str):
    # Load past census
    census = pd.read_sql(db.query(DailyCensus).filter(DailyCensus.ward_id == ward_id).statement, db.bind)
    census['date'] = pd.to_datetime(census['date'])
    census = census.sort_values('date').set_index('date')
    
    # Load external signals
    signals = pd.read_sql(db.query(ExternalSignals).statement, db.bind)
    signals['date'] = pd.to_datetime(signals['date'])
    signals = signals.sort_values('date').set_index('date')
    
    # Load OT schedule
    ot = pd.read_sql(db.query(OTSchedule).statement, db.bind)
    ot['date'] = pd.to_datetime(ot['date'])
    ot = ot.sort_values('date').set_index('date')
    
    # Combine
    df = census[['occupancy']].join(signals, how='outer')
    df = df.join(ot[['elective_surgeries', 'emergency_surgeries']], how='outer')
    
    return df

def create_features(df: pd.DataFrame):
    df = df.copy()
    
    # Target and Lags
    for lag in [1, 2, 3, 7, 14]:
        df[f'occ_lag_{lag}'] = df['occupancy'].shift(lag)
        
    # Rolling features based on lag 1 (to prevent leakage)
    occ_lag1 = df['occupancy'].shift(1)
    df['rolling_mean_7'] = occ_lag1.rolling(window=7).mean()
    df['rolling_std_7'] = occ_lag1.rolling(window=7).std()
    df['rolling_mean_14'] = occ_lag1.rolling(window=14).mean()
    df['rolling_std_14'] = occ_lag1.rolling(window=14).std()
    
    # Time features
    df['day_of_week'] = df.index.dayofweek
    df['month'] = df.index.month
    
    # Forward looking features (surgeries next 3 days)
    # Note: we assume we know scheduled surgeries 3 days in advance
    df['surgeries_next_3d'] = df['elective_surgeries'].rolling(window=3).sum().shift(-3)
    
    # Impute missing values (for early rows)
    df.bfill(inplace=True)
    df.fillna(0, inplace=True)
    
    return df

class ModelPipeline:
    def __init__(self, db: Session):
        self.db = db
        self.metrics_summary = []
        
    def evaluate_baselines(self, df: pd.DataFrame, train_size: int):
        test_df = df.iloc[train_size:].copy()
        y_test = test_df['occupancy'].values
        
        # Naive 1: Yesterday
        naive_1 = test_df['occupancy'].shift(1).fillna(test_df['occupancy'].iloc[0]).values
        
        # Naive 2: Same weekday last week
        naive_7 = test_df['occupancy'].shift(7).bfill().values
        
        # SARIMA (simplified for speed)
        train_y = df.iloc[:train_size]['occupancy'].values
        try:
            sarima = SARIMAX(train_y, order=(1,1,1), seasonal_order=(1,0,0,7))
            sarima_fit = sarima.fit(disp=False)
            sarima_pred = sarima_fit.forecast(steps=len(test_df))
        except:
            sarima_pred = naive_1 # fallback
            
        metrics = {
            'naive_yesterday_mae': mean_absolute_error(y_test, naive_1),
            'naive_lastweek_mae': mean_absolute_error(y_test, naive_7),
            'sarima_mae': mean_absolute_error(y_test, sarima_pred)
        }
        return metrics

    def run_for_ward(self, ward_id: str, capacity: int, today: datetime.date):
        df = load_data(self.db, ward_id)
        df_feat = create_features(df)
        
        # We can only train on data up to 'today' where occupancy is known
        train_end_date = pd.to_datetime(today)
        historical_df = df_feat[df_feat.index <= train_end_date].copy()
        future_df = df_feat[(df_feat.index > train_end_date) & (df_feat.index <= train_end_date + datetime.timedelta(days=7))].copy()
        
        if historical_df.empty:
            return
            
        features = [
            'occ_lag_1', 'occ_lag_2', 'occ_lag_3', 'occ_lag_7', 'occ_lag_14',
            'rolling_mean_7', 'rolling_std_7', 'rolling_mean_14', 'rolling_std_14',
            'day_of_week', 'month', 'is_holiday', 'flu_index', 'aqi', 'temperature',
            'surgeries_next_3d'
        ]
        
        # Train/test split for evaluation (last 15% for test)
        n = len(historical_df)
        train_size = int(n * 0.85)
        
        train_df = historical_df.iloc[:train_size]
        test_df = historical_df.iloc[train_size:]
        
        X_train, y_train = train_df[features], train_df['occupancy']
        X_test, y_test = test_df[features], test_df['occupancy']
        
        # Baselines
        baseline_metrics = self.evaluate_baselines(historical_df, train_size)
        
        # LightGBM quantiles
        models = {}
        preds = {}
        for alpha, name in [(0.1, 'p10'), (0.5, 'p50'), (0.9, 'p90')]:
            model = LGBMRegressor(objective='quantile', alpha=alpha, n_estimators=100, random_state=42)
            model.fit(X_train, y_train)
            models[name] = model
            preds[name] = model.predict(X_test)
            
        # Metrics
        y_test_vals = y_test.values
        mae = mean_absolute_error(y_test_vals, preds['p50'])
        rmse = np.sqrt(mean_squared_error(y_test_vals, preds['p50']))
        smape_val = smape(y_test_vals, preds['p50'])
        pinball_10 = pinball_loss(y_test_vals, preds['p10'], 0.1)
        pinball_50 = pinball_loss(y_test_vals, preds['p50'], 0.5)
        pinball_90 = pinball_loss(y_test_vals, preds['p90'], 0.9)
        coverage = np.mean((y_test_vals >= preds['p10']) & (y_test_vals <= preds['p90']))
        
        # Overflow event recall (>90% capacity)
        threshold = 0.9 * capacity
        actual_overflow = (y_test_vals > threshold)
        pred_overflow = (preds['p90'] > threshold)
        if sum(actual_overflow) > 0:
            recall = sum(actual_overflow & pred_overflow) / sum(actual_overflow)
        else:
            recall = 1.0
            
        if sum(pred_overflow) > 0:
            false_alarm = sum((~actual_overflow) & pred_overflow) / sum(pred_overflow)
        else:
            false_alarm = 0.0

        self.metrics_summary.append({
            'ward_id': ward_id,
            'mae': mae,
            'rmse': rmse,
            'smape': smape_val,
            'coverage': coverage,
            'recall': recall,
            'false_alarm': false_alarm,
            'naive_mae': baseline_metrics['naive_yesterday_mae'],
            'sarima_mae': baseline_metrics['sarima_mae']
        })
        
        # Retrain on full historical data
        X_full, y_full = historical_df[features], historical_df['occupancy']
        for name in models:
            models[name].fit(X_full, y_full)
            
        # Forecast future
        X_future = future_df[features]
        # In reality, lags need to be generated sequentially. For this MVP, since we 
        # have "synthetic" future actuals in DB up to some extent, our feature builder 
        # might cheat slightly if occupancy is in the future. Wait, future occupancy is NOT in DB.
        # But wait, `load_data` loads `occupancy`. For future dates, `occupancy` is NaN.
        # So shift(1) etc will be NaN for days > today+1.
        # We need auto-regressive forecasting: predict day 1, update lag, predict day 2...
        
        # Auto-regressive forecast loop
        future_preds = {'p10': [], 'p50': [], 'p90': []}
        current_features = X_full.iloc[-1].copy()
        current_occ = y_full.iloc[-1]
        
        # We need to maintain a history of occupancy to compute rolling/lags
        occ_history = list(y_full.values)
        
        forecast_dates = [train_end_date + datetime.timedelta(days=i) for i in range(1, 8)]
        
        # Initialize SHAP explainer on full train data
        explainer = shap.TreeExplainer(models['p50'])
        
        for i, f_date in enumerate(forecast_dates):
            # Update current features for this date
            # Get external signals for f_date
            ext = future_df.loc[pd.to_datetime(f_date)]
            
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
            
            p10_val = models['p10'].predict(row)[0]
            p50_val = models['p50'].predict(row)[0]
            p90_val = models['p90'].predict(row)[0]
            
            future_preds['p10'].append(p10_val)
            future_preds['p50'].append(p50_val)
            future_preds['p90'].append(p90_val)
            
            # Save forecast to DB
            forecast = Forecast(
                run_date=today,
                target_date=f_date,
                ward_id=ward_id,
                p10=float(p10_val),
                p50=float(p50_val),
                p90=float(p90_val),
                model_version="lgbm_q_v1"
            )
            self.db.add(forecast)
            
            # Decision Engine & SHAP
            shap_values = explainer.shap_values(row)
            # Map features to shap values
            feature_importance = pd.Series(shap_values[0], index=features)
            top_features = feature_importance.abs().sort_values(ascending=False).head(3).index.tolist()
            
            # Severity logic
            severity = "LOW"
            if p90_val > 0.9 * capacity:
                severity = "HIGH"
            elif p50_val > 0.8 * capacity:
                severity = "MEDIUM"
                
            if severity in ["HIGH", "MEDIUM"]:
                # Map technical features to readable reasons
                reason_map = {
                    'occ_lag_1': 'Recent high occupancy',
                    'occ_lag_7': 'High occupancy same day last week',
                    'surgeries_next_3d': 'High volume of scheduled surgeries',
                    'flu_index': 'Seasonal flu surge',
                    'day_of_week': 'Typical weekday pattern',
                    'is_holiday': 'Holiday effect'
                }
                
                reasons = [reason_map.get(f, f"Elevated {f}") for f in top_features]
                while len(reasons) < 3:
                    reasons.append(None)
                    
                recommendation = "Review elective surgeries and staffing."
                if "surgeries" in reasons[0].lower():
                    recommendation = f"Review elective surgeries scheduled around {f_date.strftime('%Y-%m-%d')}."
                elif "flu" in reasons[0].lower():
                    recommendation = "Increase float pool nurses due to flu surge."
                    
                alert = Alert(
                    date=f_date,
                    ward_id=ward_id,
                    severity=severity,
                    reason_1=reasons[0],
                    reason_2=reasons[1],
                    reason_3=reasons[2],
                    recommendation=recommendation
                )
                self.db.add(alert)
                
            # Update history for next iteration
            occ_history.append(p50_val) # Use P50 as the actual for next lags
            
        self.db.commit()

def run_pipeline():
    db = SessionLocal()
    # Clear existing forecasts and alerts
    db.query(Forecast).delete()
    db.query(Alert).delete()
    db.commit()
    
    today = datetime.date.today()
    wards = db.query(Ward).all()
    
    pipeline = ModelPipeline(db)
    
    for w in wards:
        print(f"Running pipeline for ward: {w.name}")
        pipeline.run_for_ward(w.id, w.capacity, today)
        
    print("Metrics Summary:")
    print(pd.DataFrame(pipeline.metrics_summary))
    # Save metrics to a file to be loaded by API later
    pd.DataFrame(pipeline.metrics_summary).to_csv("model_metrics.csv", index=False)
    
    db.close()

if __name__ == "__main__":
    run_pipeline()
