"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { format, addDays } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function Staffing() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Since we don't have a direct /staff endpoint in this MVP, we simulate it
    // based on capacity/occupancy rule (ICU 1:2, General 1:6)
    const fetchData = async () => {
      try {
        const [wRes, fRes] = await Promise.all([
          fetch("http://localhost:8000/wards"),
          fetch("http://localhost:8000/forecast?ward=general&days=7")
        ]);
        const wards = await wRes.json();
        const forecasts = await fRes.json();
        
        const mockData = forecasts.map((f:any) => {
          const required = Math.ceil(f.p50 / 6); // 1:6 ratio for general
          const available = 15; // static mock baseline
          return {
            date: f.target_date,
            required,
            available,
            shortfall: Math.max(0, required - available)
          };
        });
        setData(mockData);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <h1 className="text-2xl font-bold tracking-tight">Staffing Demand (General Ward)</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Required vs Available Nurses (Day Shift)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] w-full">
            {loading ? (
              <div className="w-full h-full flex items-center justify-center text-[var(--text-muted)] animate-pulse">
                Loading staffing data...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{fontSize: 12, fill: 'var(--text-muted)'}} tickFormatter={(val) => format(new Date(val as string), "dd MMM")} />
                  <YAxis tick={{fontSize: 12, fill: 'var(--text-muted)'}} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px' }}
                    labelFormatter={(val) => format(new Date(val as string), "EEEE, dd MMM yyyy")}
                  />
                  <Legend />
                  <Bar dataKey="available" name="Available Nurses" fill="var(--surface-2)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="required" name="Required Nurses" radius={[4, 4, 0, 0]}>
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.shortfall > 0 ? '#DC2626' : 'var(--primary)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="mt-4 flex gap-4 text-sm text-[var(--text-muted)]">
            <div className="flex items-center"><div className="w-3 h-3 bg-[var(--surface-2)] mr-2"></div> Available</div>
            <div className="flex items-center"><div className="w-3 h-3 bg-[var(--primary)] mr-2"></div> Required (Sufficient)</div>
            <div className="flex items-center"><div className="w-3 h-3 bg-red-600 mr-2"></div> Required (Shortfall)</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
