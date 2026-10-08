"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, ComposedChart, ReferenceLine, Scatter, BarChart, Bar, Cell } from "recharts";
import { format, addDays } from "date-fns";

export default function Forecasts() {
  const [wards, setWards] = useState<any[]>([]);
  const [selectedWard, setSelectedWard] = useState("icu");
  const [horizon, setHorizon] = useState(7);
  const [chartData, setChartData] = useState<any[]>([]);
  const [capacity, setCapacity] = useState(20);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    fetch("http://localhost:8000/wards")
      .then(r => r.json())
      .then(w => {
        setWards(w);
        if (w.length > 0) setCapacity(w.find((x:any) => x.id === selectedWard)?.capacity || 20);
      });
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [actualsRes, forecastRes] = await Promise.all([
          fetch(`http://localhost:8000/actuals?ward=${selectedWard}&days=7`),
          fetch(`http://localhost:8000/forecast?ward=${selectedWard}&days=${horizon}`)
        ]);
        const actuals = await actualsRes.json();
        const forecasts = await forecastRes.json();
        
        // Merge for Recharts
        // Recharts ComposedChart can plot dots for actuals and areas for forecasts
        const merged: any[] = [];
        
        actuals.forEach((a: any) => {
          merged.push({
            date: a.date,
            actual: a.occupancy,
            p50: null,
            range: null
          });
        });
        
        forecasts.forEach((f: any) => {
          merged.push({
            date: f.target_date,
            actual: null,
            p50: f.p50,
            range: [f.p10, f.p90],
            p10: f.p10,
            p90: f.p90
          });
        });
        
        setChartData(merged);
        if (forecasts.length > 0) {
          setSelectedDate(forecasts[0].target_date);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    if (selectedWard) fetchData();
  }, [selectedWard, horizon]);

  const handleWardChange = (e: any) => {
    const wId = e.target.value;
    setSelectedWard(wId);
    setCapacity(wards.find((x:any) => x.id === wId)?.capacity || 20);
  };

  const mockShapData = useMemo(() => {
    if (!selectedDate) return [];
    // Just mock some SHAP values that change based on date string hash for the MVP
    const hash = selectedDate.charCodeAt(selectedDate.length - 1);
    const sign = hash % 2 === 0 ? 1 : -1;
    return [
      { feature: "occ_lag_1", value: 3.2 * sign },
      { feature: "surgeries_next_3d", value: 1.8 },
      { feature: "day_of_week", value: -1.2 * sign },
      { feature: "flu_index", value: 0.9 },
      { feature: "occ_lag_7", value: 0.5 },
    ].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  }, [selectedDate]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Capacity Forecasts</h1>
        <div className="flex items-center space-x-4">
          <select 
            value={selectedWard}
            onChange={handleWardChange}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--primary)]"
          >
            {wards.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          
          <div className="flex bg-[var(--surface-2)] rounded-md p-1">
            {[3, 7, 14].map(days => (
              <button 
                key={days}
                onClick={() => setHorizon(days)}
                className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${horizon === days ? 'bg-[var(--surface)] shadow-sm text-[var(--text)]' : 'text-[var(--text-muted)] hover:text-[var(--text)]'}`}
              >
                {days}D
              </button>
            ))}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Forecast & Confidence Interval</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] animate-pulse">
                Loading forecast data...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart 
                  data={chartData} 
                  margin={{ top: 20, right: 20, bottom: 20, left: 0 }}
                  onClick={(e) => {
                    if (e && e.activeLabel !== undefined) setSelectedDate(String(e.activeLabel));
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{fontSize: 12, fill: 'var(--text-muted)'}} tickFormatter={(val) => format(new Date(val as string), "dd MMM")} />
                  <YAxis tick={{fontSize: 12, fill: 'var(--text-muted)'}} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px' }}
                    labelFormatter={(val) => format(new Date(val as string), "EEEE, dd MMM yyyy")}
                  />
                  <Legend />
                  
                  {/* Capacity Lines */}
                  <ReferenceLine y={capacity} stroke="#DC2626" strokeDasharray="5 5" label={{ position: 'insideTopLeft', value: 'Capacity', fill: '#DC2626', fontSize: 12 }} />
                  <ReferenceLine y={capacity * 0.9} stroke="#F59E0B" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: '90% Risk', fill: '#F59E0B', fontSize: 12 }} />
                  
                  {/* Confidence Interval Band */}
                  <Area type="monotone" dataKey="range" stroke="none" fill="var(--accent)" fillOpacity={0.15} name="P10 - P90 Band" />
                  
                  {/* P50 Line */}
                  <Line type="monotone" dataKey="p50" stroke="var(--accent)" strokeWidth={2.5} dot={false} name="Forecast (P50)" />
                  
                  {/* Actuals as Dots */}
                  <Scatter dataKey="actual" fill="var(--text)" name="Actual Census" />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* SHAP Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Decision Drivers (SHAP) - {selectedDate ? format(new Date(selectedDate), "dd MMM yyyy") : 'Select a date'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] w-full max-w-3xl">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mockShapData} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border)" />
                <XAxis type="number" hide />
                <YAxis dataKey="feature" type="category" tick={{fontSize: 12, fill: 'var(--text-muted)'}} width={120} />
                <Tooltip cursor={{fill: 'var(--surface-2)'}} contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px' }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {mockShapData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.value > 0 ? '#EF4444' : '#22C55E'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-2 italic">
            Positive values (Red) increase predicted occupancy. Negative values (Green) decrease it.
          </p>
        </CardContent>
      </Card>

    </div>
  );
}
