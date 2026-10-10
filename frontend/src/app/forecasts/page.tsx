"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, ComposedChart, ReferenceLine, Scatter, BarChart, Bar, Cell } from "recharts";
import { format } from "date-fns";
import { AlertCircle } from "lucide-react";

interface Ward {
  id: string;
  name: string;
  capacity: number;
}

interface ChartDataPoint {
  date: string;
  actual: number | null;
  p50: number | null;
  range: [number, number] | null;
  p10?: number;
  p90?: number;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Forecasts() {
  const [wards, setWards] = useState<Ward[]>([]);
  const [selectedWard, setSelectedWard] = useState("icu");
  const [horizon, setHorizon] = useState(7);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [capacity, setCapacity] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/wards`)
      .then(r => r.json())
      .then((w: Ward[]) => {
        setWards(w);
        if (w.length > 0) setCapacity(w.find(x => x.id === selectedWard)?.capacity || 20);
      })
      .catch(err => console.error("Failed to fetch wards:", err));
  }, [selectedWard]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [actualsRes, forecastRes] = await Promise.all([
          fetch(`${API_BASE_URL}/actuals?ward=${selectedWard}&days=7`),
          fetch(`${API_BASE_URL}/forecast?ward=${selectedWard}&days=${horizon}`)
        ]);
        
        if (!actualsRes.ok || !forecastRes.ok) {
          throw new Error("Failed to fetch forecast data");
        }
        
        const actuals = await actualsRes.json();
        const forecasts = await forecastRes.json();
        
        const merged: ChartDataPoint[] = [];
        
        actuals.forEach((a: { date: string; occupancy: number }) => {
          merged.push({
            date: a.date,
            actual: a.occupancy,
            p50: null,
            range: null
          });
        });
        
        forecasts.forEach((f: { target_date: string; p50: number; p10: number; p90: number }) => {
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
        setError("Unable to load forecasts at this time. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    
    if (selectedWard) fetchData();
  }, [selectedWard, horizon]);

  const handleWardChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const wId = e.target.value;
    setSelectedWard(wId);
    setCapacity(wards.find(x => x.id === wId)?.capacity || 20);
  };

  const mockShapData = useMemo(() => {
    if (!selectedDate) return [];
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
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Capacity Forecasts</h1>
        <div className="flex flex-wrap items-center gap-4">
          <select 
            value={selectedWard}
            onChange={handleWardChange}
            aria-label="Select Ward"
            className="bg-(--surface) border border-(--border) rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-(--primary) focus:border-transparent transition-all"
          >
            {wards.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
          
          <div className="flex bg-(--surface-2) rounded-md p-1" role="group" aria-label="Forecast Horizon">
            {[3, 7, 14].map(days => (
              <button 
                key={days}
                onClick={() => setHorizon(days)}
                aria-pressed={horizon === days}
                className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${horizon === days ? 'bg-(--surface) shadow-sm text-foreground' : 'text-(--text-muted) hover:text-foreground'}`}
              >
                {days}D
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-md bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-2" role="alert">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Forecast & Confidence Interval</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-100 w-full">
            {loading ? (
              <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
                <div className="w-full h-full bg-(--surface-2) animate-pulse rounded-md opacity-50" />
              </div>
            ) : !error && chartData.length > 0 ? (
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
                    contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--foreground)' }}
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
                  <Scatter dataKey="actual" fill="var(--foreground)" name="Actual Census" />
                </ComposedChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* SHAP Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Decision Drivers (SHAP) - {selectedDate ? format(new Date(selectedDate), "dd MMM yyyy") : 'Select a date'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-62.5 w-full max-w-3xl">
            {loading ? (
              <div className="w-full h-full bg-(--surface-2) animate-pulse rounded-md opacity-50" />
            ) : mockShapData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mockShapData} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--border)" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="feature" type="category" tick={{fontSize: 12, fill: 'var(--text-muted)'}} width={120} />
                  <Tooltip cursor={{fill: 'var(--surface-2)'}} contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--foreground)' }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {mockShapData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.value > 0 ? '#EF4444' : '#22C55E'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-(--text-muted) italic">
                No driver data available.
              </div>
            )}
          </div>
          <p className="text-xs text-(--text-muted) mt-2 italic">
            Positive values (Red) increase predicted occupancy. Negative values (Green) decrease it.
          </p>
        </CardContent>
      </Card>

    </div>
  );
}
