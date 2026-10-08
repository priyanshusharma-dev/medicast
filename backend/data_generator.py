import pandas as pd
import numpy as np
from datetime import timedelta, date
from sqlalchemy.orm import Session
from database import engine, Base, SessionLocal
from models import Ward, DailyCensus, ExternalSignals, OTSchedule, StaffRoster

def reset_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

def generate_data():
    np.random.seed(42)
    reset_db()
    
    db = SessionLocal()
    
    # Create Wards
    wards_data = [
        {"id": "icu", "name": "Intensive Care Unit", "capacity": 20},
        {"id": "general", "name": "General Ward", "capacity": 120},
        {"id": "ed", "name": "Emergency Department", "capacity": 40},
        {"id": "maternity", "name": "Maternity Ward", "capacity": 30},
    ]
    for w in wards_data:
        db.add(Ward(**w))
    
    # Date range: 2 years back from today, to +14 days future
    today = date.today()
    start_date = today - timedelta(days=2*365)
    end_date = today + timedelta(days=14)
    dates = pd.date_range(start_date, end_date)
    
    # 1. External Signals & OT Schedule
    for i, d in enumerate(dates):
        d_val = d.date()
        # Seasonal wave (flu/monsoon) - higher in winter/monsoon
        day_of_year = d.dayofyear
        flu_idx = 0.5 + 0.5 * np.sin(2 * np.pi * (day_of_year - 30) / 365.0) + np.random.normal(0, 0.1)
        flu_idx = max(0, min(1, flu_idx))
        
        temp = 25.0 + 10.0 * np.sin(2 * np.pi * (day_of_year - 150) / 365.0) + np.random.normal(0, 2)
        aqi = 100.0 + 50.0 * np.sin(2 * np.pi * (day_of_year - 300) / 365.0) + np.random.normal(0, 20)
        
        is_hol = np.random.rand() < 0.05
        
        sig = ExternalSignals(
            date=d_val,
            temperature=float(temp),
            aqi=float(aqi),
            is_holiday=is_hol,
            flu_index=float(flu_idx)
        )
        db.add(sig)
        
        # OT Schedule (mostly weekdays)
        is_weekend = d.weekday() >= 5
        elective = int(np.random.normal(20, 5)) if not is_weekend and not is_hol else int(np.random.normal(2, 2))
        elective = max(0, elective)
        emergency = int(np.random.normal(5, 2))
        emergency = max(0, emergency)
        
        ot = OTSchedule(
            date=d_val,
            elective_surgeries=elective,
            emergency_surgeries=emergency
        )
        db.add(ot)
        
    db.commit()
    
    # 2. Daily Census and Staff Roster (up to today for census, future for staff)
    historical_dates = pd.date_range(start_date, today)
    
    nurse_ratios = {"icu": 2, "general": 6, "ed": 4, "maternity": 4}
    
    for w in wards_data:
        base_occ = w["capacity"] * 0.75 # 75% average base
        
        for d in historical_dates:
            d_val = d.date()
            # Weekend effect
            is_weekend = d.weekday() >= 5
            weekend_adj = -0.1 * base_occ if is_weekend else 0.05 * base_occ
            
            # Monday/Tuesday surge
            surge_adj = 0.1 * base_occ if d.weekday() in [0, 1] else 0
            
            # Seasonal effect via a bit of math matching flu index
            day_of_year = d.dayofyear
            flu_idx = 0.5 + 0.5 * np.sin(2 * np.pi * (day_of_year - 30) / 365.0)
            
            seasonal_adj = flu_idx * 0.15 * base_occ
            
            # Random events
            random_surge = np.random.normal(0, base_occ * 0.1)
            
            occ = base_occ + weekend_adj + surge_adj + seasonal_adj + random_surge
            occ = int(round(occ))
            occ = max(0, min(w["capacity"] + int(w["capacity"] * 0.2), occ)) # Cap at 120%
            
            db.add(DailyCensus(
                date=d_val,
                ward_id=w["id"],
                occupancy=occ
            ))
            
    # Generate Staffing for all dates
    for w in wards_data:
        ratio = nurse_ratios[w["id"]]
        for d in dates:
            d_val = d.date()
            # Assign base staff expecting ~80% occupancy
            expected_occ = w["capacity"] * 0.8
            nurses_needed = int(np.ceil(expected_occ / ratio))
            
            # Day shift
            db.add(StaffRoster(
                date=d_val,
                ward_id=w["id"],
                shift="day",
                nurses_assigned=nurses_needed,
                nurses_absent=int(np.random.choice([0, 0, 0, 1, 1, 2]))
            ))
            # Night shift
            db.add(StaffRoster(
                date=d_val,
                ward_id=w["id"],
                shift="night",
                nurses_assigned=max(1, int(nurses_needed * 0.7)), # Fewer nurses at night usually, just as an example
                nurses_absent=int(np.random.choice([0, 0, 0, 0, 1]))
            ))
    
    db.commit()
    db.close()
    print("Database seeded successfully with 2 years of synthetic data.")

if __name__ == "__main__":
    generate_data()
