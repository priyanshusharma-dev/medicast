from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, Boolean
from database import Base

class Ward(Base):
    __tablename__ = "wards"
    id = Column(String, primary_key=True, index=True) # e.g. "icu", "general", "ed", "maternity"
    name = Column(String)
    capacity = Column(Integer)

class DailyCensus(Base):
    __tablename__ = "daily_census"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, index=True)
    ward_id = Column(String, ForeignKey("wards.id"))
    occupancy = Column(Integer)

class ExternalSignals(Base):
    __tablename__ = "external_signals"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, index=True, unique=True)
    temperature = Column(Float)
    aqi = Column(Float)
    is_holiday = Column(Boolean)
    flu_index = Column(Float)

class OTSchedule(Base):
    __tablename__ = "ot_schedule"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, index=True)
    elective_surgeries = Column(Integer)
    emergency_surgeries = Column(Integer)

class StaffRoster(Base):
    __tablename__ = "staff_roster"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, index=True)
    ward_id = Column(String, ForeignKey("wards.id"))
    shift = Column(String) # "day", "night"
    nurses_assigned = Column(Integer)
    nurses_absent = Column(Integer)

class Forecast(Base):
    __tablename__ = "forecasts"
    id = Column(Integer, primary_key=True, index=True)
    run_date = Column(Date, index=True)
    target_date = Column(Date, index=True)
    ward_id = Column(String, ForeignKey("wards.id"))
    p10 = Column(Float)
    p50 = Column(Float)
    p90 = Column(Float)
    model_version = Column(String)

class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, index=True)
    ward_id = Column(String, ForeignKey("wards.id"))
    severity = Column(String) # LOW, MEDIUM, HIGH, CRITICAL
    reason_1 = Column(String, nullable=True)
    reason_2 = Column(String, nullable=True)
    reason_3 = Column(String, nullable=True)
    recommendation = Column(String, nullable=True)
    is_acknowledged = Column(Boolean, default=False)
