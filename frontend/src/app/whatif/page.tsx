"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { format } from "date-fns";
import { Activity, AlertCircle } from "lucide-react";

interface Ward {
  id: string;
  name: string;
  capacity: number;
}

interface BaseForecast {
  target_date: string;
  p50: number;
}

interface SimForecast {
  target_date: string;
  p50_after: number;
}

interface ChartPoint {
  date: string;
  p50_before: number;
  p50_after: number | null;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function WhatIf() {
  const [wards, setWards] = useState<Ward[]>([]);
  const [selectedWard, setSelectedWard] = useState("icu");
  const [capacity, setCapacity] = useState(20);
  
  const [extraSurgeries, setExtraSurgeries] = useState(0);
  const [fluSurgePct, setFluSurgePct] = useState(0);
  
  const [baseChartData, setBaseChartData] = useState<ChartPoint[]>([]);
  const [simData, setSimData] = useState<SimForecast[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/wards`)
      .then(r => r.json())
      .then((w: Ward[]) => {
        setWards(w);
      })
      .catch(err => {
        console.error(err);
        setError("Failed to load wards.");
      });
  }, []);

  useEffect(() => {
    if (wards.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCapacity(wards.find(x => x.id === selectedWard)?.capacity || 20);
      setInitialLoading(true);
      setError(null);
      
      // Load base forecast
      fetch(`${API_BASE_URL}/forecast?ward=${selectedWard}&days=7`)
        .then(r => {
          if (!r.ok) throw new Error("Failed to fetch forecast");
          return r.json();
        })
        .then((f: BaseForecast[]) => {
          setBaseChartData(f.map(x => ({
            date: x.target_date,
            p50_before: x.p50,
            p50_after: null
          })));
          setSimData([]); // Reset simulation on ward change
        })
        .catch(err => {
          console.error(err);
          setError("Failed to load baseline forecast.");
        })
        .finally(() => {
          setInitialLoading(false);
        });
    }
  }, [selectedWard, wards]);

  const handleSimulate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/whatif`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ward: selectedWard,
          extra_surgeries: extraSurgeries,
          flu_surge_pct: fluSurgePct,
          staff_absent: 0
        })
      });
      if (!res.ok) throw new Error("Simulation failed");
      const data = await res.json();
      setSimData(data);
    } catch (e) {
      console.error(e);
      setError("Simulation request failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const chartData = baseChartData.map(b => {
    const s = simData.find(x => x.target_date === b.date);
    return {
      ...b,
      p50_after: s ? s.p50_after : null
    };
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">What-If Scenario Sandbox</h1>
      </div>

      {error && (
        <div className="p-4 rounded-md bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-2" role="alert">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="md:col-span-1 border-(--border)">
          <CardHeader className="bg-(--surface-2)/50 border-b border-(--border) pb-4">
            <CardTitle>Scenario Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div>
              <label htmlFor="ward-select" className="block text-sm font-medium mb-2 text-(--text-muted)">Target Ward</label>
              <select 
                id="ward-select"
                value={selectedWard}
                onChange={e => setSelectedWard(e.target.value)}
                className="w-full bg-(--surface) border border-(--border) rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--primary) focus:border-transparent transition-all"
                aria-label="Select Target Ward"
              >
                {wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            
            <div>
              <label htmlFor="surgeries-range" className="block text-sm font-medium mb-1 text-(--text-muted)">Extra Elective Surgeries/Day</label>
              <input 
                id="surgeries-range"
                type="range" 
                min="-10" 
                max="20" 
                step="1" 
                value={extraSurgeries} 
                onChange={e => setExtraSurgeries(parseInt(e.target.value))} 
                className="w-full mb-1 accent-(--primary)" 
                aria-label="Extra Elective Surgeries"
              />
              <div className="text-right text-xs font-mono font-medium text-foreground">{extraSurgeries > 0 ? `+${extraSurgeries}` : extraSurgeries}</div>
            </div>

            <div>
              <label htmlFor="flu-range" className="block text-sm font-medium mb-1 text-(--text-muted)">Flu Index Surge (%)</label>
              <input 
                id="flu-range"
                type="range" 
                min="-50" 
                max="100" 
                step="10" 
                value={fluSurgePct} 
                onChange={e => setFluSurgePct(parseInt(e.target.value))} 
                className="w-full mb-1 accent-(--primary)" 
                aria-label="Flu Index Surge"
              />
              <div className="text-right text-xs font-mono font-medium text-foreground">{fluSurgePct > 0 ? `+${fluSurgePct}%` : `${fluSurgePct}%`}</div>
            </div>

            <Button className="w-full" onClick={handleSimulate} disabled={loading || initialLoading} aria-live="polite">
              {loading ? "Simulating..." : "Run Simulation"}
              {!loading && <Activity className="w-4 h-4 ml-2" />}
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-3 border-(--border)">
          <CardHeader>
            <CardTitle>Forecast Comparison (Baseline vs Scenario)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-100 w-full relative" aria-label="Forecast comparison chart">
              {initialLoading ? (
                <div className="absolute inset-0 bg-(--surface-2) animate-pulse rounded-md opacity-50 flex items-center justify-center">
                  <span className="sr-only">Loading baseline data...</span>
                </div>
              ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{fontSize: 12, fill: 'var(--text-muted)'}} tickFormatter={(val) => format(new Date(val as string), "dd MMM")} />
                    <YAxis tick={{fontSize: 12, fill: 'var(--text-muted)'}} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--foreground)' }}
                      labelFormatter={(val) => format(new Date(val as string), "EEEE, dd MMM yyyy")}
                    />
                    <Legend />
                    
                    <ReferenceLine y={capacity} stroke="#DC2626" strokeDasharray="5 5" label={{ position: 'insideTopLeft', value: 'Capacity', fill: '#DC2626', fontSize: 12 }} />
                    
                    <Line type="monotone" dataKey="p50_before" name="Baseline P50" stroke="var(--accent)" strokeWidth={2} dot={false} strokeDasharray="4 4" />
                    {simData.length > 0 && (
                      <Line type="monotone" dataKey="p50_after" name="Scenario P50" stroke="#8B5CF6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-(--text-muted) italic">
                  No data available.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
