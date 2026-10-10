"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { format } from "date-fns";
import { AlertCircle } from "lucide-react";

interface StaffingData {
  date: string;
  required: number;
  available: number;
  shortfall: number;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Staffing() {
  const [data, setData] = useState<StaffingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Since we don't have a direct /staff endpoint in this MVP, we simulate it
    // based on capacity/occupancy rule (ICU 1:2, General 1:6)
    const fetchData = async () => {
      try {
        setError(null);
        const [wRes, fRes] = await Promise.all([
          fetch(`${API_BASE_URL}/wards`),
          fetch(`${API_BASE_URL}/forecast?ward=general&days=7`)
        ]);
        
        if (!wRes.ok || !fRes.ok) {
          throw new Error("Failed to fetch staffing data");
        }
        
        // Wards isn't actually used here, but we fetch it to simulate the structure
        await wRes.json();
        const forecasts = await fRes.json();
        
        const mockData: StaffingData[] = forecasts.map((f: { target_date: string; p50: number }) => {
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
        setError("Unable to load staffing forecasts at this time.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Staffing Demand (General Ward)</h1>
      
      {error && (
        <div className="p-4 rounded-md bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-2" role="alert">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Required vs Available Nurses (Day Shift)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-100 w-full" aria-label="Staffing chart">
            {loading ? (
              <div className="w-full h-full bg-(--surface-2) animate-pulse rounded-md opacity-50 flex items-center justify-center">
                 <span className="sr-only">Loading staffing data...</span>
              </div>
            ) : !error && data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{fontSize: 12, fill: 'var(--text-muted)'}} tickFormatter={(val) => format(new Date(val as string), "dd MMM")} />
                  <YAxis tick={{fontSize: 12, fill: 'var(--text-muted)'}} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--foreground)' }}
                    labelFormatter={(val) => format(new Date(val as string), "EEEE, dd MMM yyyy")}
                    cursor={{fill: 'var(--surface-2)'}}
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
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-(--text-muted)">
            <div className="flex items-center"><div className="w-3 h-3 bg-(--surface-2) mr-2 rounded-sm border border-(--border)"></div> Available</div>
            <div className="flex items-center"><div className="w-3 h-3 bg-(--primary) mr-2 rounded-sm"></div> Required (Sufficient)</div>
            <div className="flex items-center"><div className="w-3 h-3 bg-red-600 mr-2 rounded-sm"></div> Required (Shortfall)</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
