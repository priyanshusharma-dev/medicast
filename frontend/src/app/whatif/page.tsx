"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { format } from "date-fns";
import { Activity } from "lucide-react";

export default function WhatIf() {
  const [wards, setWards] = useState<any[]>([]);
  const [selectedWard, setSelectedWard] = useState("icu");
  const [capacity, setCapacity] = useState(20);
  
  const [extraSurgeries, setExtraSurgeries] = useState(0);
  const [fluSurgePct, setFluSurgePct] = useState(0);
  
  const [baseChartData, setBaseChartData] = useState<any[]>([]);
  const [simData, setSimData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("http://localhost:8000/wards")
      .then(r => r.json())
      .then(w => {
        setWards(w);
      });
  }, []);

  useEffect(() => {
    if (wards.length > 0) {
      setCapacity(wards.find((x:any) => x.id === selectedWard)?.capacity || 20);
      
      // Load base forecast
      fetch(`http://localhost:8000/forecast?ward=${selectedWard}&days=7`)
        .then(r => r.json())
        .then(f => {
          setBaseChartData(f.map((x:any) => ({
            date: x.target_date,
            p50_before: x.p50
          })));
        });
    }
  }, [selectedWard, wards]);

  const handleSimulate = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:8000/whatif", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ward: selectedWard,
          extra_surgeries: extraSurgeries,
          flu_surge_pct: fluSurgePct,
          staff_absent: 0
        })
      });
      const data = await res.json();
      setSimData(data);
    } catch (e) {
      console.error(e);
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
        <h1 className="text-2xl font-bold tracking-tight">What-If Scenario Sandbox</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Scenario Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2 text-[var(--text-muted)]">Target Ward</label>
              <select 
                value={selectedWard}
                onChange={e => setSelectedWard(e.target.value)}
                className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-2 text-sm focus:outline-none"
              >
                {wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--text-muted)]">Extra Elective Surgeries/Day</label>
              <input type="range" min="-10" max="20" step="1" value={extraSurgeries} onChange={e => setExtraSurgeries(parseInt(e.target.value))} className="w-full mb-1" />
              <div className="text-right text-xs font-mono font-medium">{extraSurgeries > 0 ? `+${extraSurgeries}` : extraSurgeries}</div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-[var(--text-muted)]">Flu Index Surge (%)</label>
              <input type="range" min="-50" max="100" step="10" value={fluSurgePct} onChange={e => setFluSurgePct(parseInt(e.target.value))} className="w-full mb-1" />
              <div className="text-right text-xs font-mono font-medium">{fluSurgePct > 0 ? `+${fluSurgePct}%` : `${fluSurgePct}%`}</div>
            </div>

            <Button className="w-full" onClick={handleSimulate} disabled={loading}>
              {loading ? "Simulating..." : "Run Simulation"}
              {!loading && <Activity className="w-4 h-4 ml-2" />}
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Forecast Comparison (Baseline vs Scenario)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{fontSize: 12, fill: 'var(--text-muted)'}} tickFormatter={(val) => format(new Date(val as string), "dd MMM")} />
                  <YAxis tick={{fontSize: 12, fill: 'var(--text-muted)'}} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px' }}
                    labelFormatter={(val) => format(new Date(val as string), "EEEE, dd MMM yyyy")}
                  />
                  <Legend />
                  
                  <ReferenceLine y={capacity} stroke="#DC2626" strokeDasharray="5 5" label={{ position: 'insideTopLeft', value: 'Capacity', fill: '#DC2626', fontSize: 12 }} />
                  
                  <Line type="monotone" dataKey="p50_before" name="Baseline P50" stroke="var(--accent)" strokeWidth={2} dot={false} strokeDasharray="4 4" />
                  {simData.length > 0 && (
                    <Line type="monotone" dataKey="p50_after" name="Scenario P50" stroke="#8B5CF6" strokeWidth={3} dot={true} />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
