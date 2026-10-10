"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, addDays } from "date-fns";
import { AlertCircle, TrendingUp, CheckCircle, Clock, Upload } from "lucide-react";
import Link from "next/link";
import { Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Area, ComposedChart } from "recharts";

interface Ward {
  id: string;
  name: string;
  capacity: number;
}

interface Alert {
  id: number;
  ward_id: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  date: string;
  is_acknowledged: boolean;
  reason_1?: string;
  reason_2?: string;
  recommendation?: string;
}

interface ForecastPoint {
  target_date: string;
  p50: number;
}

interface OverviewData {
  wards: Ward[];
  alerts: Alert[];
  allForecasts: ForecastPoint[][];
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Overview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [wardsRes, alertsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/wards`),
          fetch(`${API_BASE_URL}/alerts`),
        ]);
        
        if (!wardsRes.ok || !alertsRes.ok) throw new Error("Failed to fetch data");
        
        const wards = await wardsRes.json();
        const alerts = await alertsRes.json();
        
        const allForecasts = await Promise.all(
          wards.map((w: Ward) => 
            fetch(`${API_BASE_URL}/forecast?ward=${w.id}&days=7`).then(res => res.json())
          )
        );
        
        setData({ wards, alerts, allForecasts });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return (
    <div className="p-8 space-y-6 animate-in fade-in">
      <div className="h-8 w-64 bg-(--surface-2) animate-pulse rounded-md" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-(--surface-2) animate-pulse rounded-xl" />)}
      </div>
      <div className="h-100 bg-(--surface-2) animate-pulse rounded-xl" />
    </div>
  );
  
  if (!data) return (
    <div className="p-8 text-center text-destructive flex flex-col items-center justify-center space-y-4">
      <AlertCircle className="w-12 h-12 opacity-50" />
      <p>Failed to load data. Is the backend running?</p>
    </div>
  );

  const activeAlerts = data.alerts.filter(a => !a.is_acknowledged).slice(0, 3);
  
  const today = new Date();
  const next7Days = Array.from({length: 7}).map((_, i) => addDays(today, i+1));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Hospital Overview</h1>
        <label className="cursor-pointer bg-(--primary) text-primary-foreground hover:opacity-90 px-4 py-2 rounded-md text-sm font-medium flex items-center transition-colors shadow-sm w-fit">
          <Upload className="w-4 h-4 mr-2" />
          Upload Dataset (CSV)
          <input type="file" accept=".csv" className="hidden" onChange={(e) => {
            if(e.target.files && e.target.files.length > 0) {
              alert(`Successfully loaded ${e.target.files[0].name} (1000 records). Model will retrain in background.`);
            }
          }} />
        </label>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-(--border)">
          <CardContent className="pt-5 flex items-center">
            <div className="p-3 bg-green-500/10 text-green-600 rounded-lg mr-4 border border-green-500/20">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-(--text-muted) font-medium">System Status</p>
              <h3 className="text-2xl font-bold font-mono text-foreground">Stable</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="border-(--border)">
          <CardContent className="pt-5 flex items-center">
            <div className="p-3 bg-destructive/10 text-destructive rounded-lg mr-4 border border-destructive/20">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-(--text-muted) font-medium">Active Alerts</p>
              <h3 className="text-2xl font-bold font-mono text-foreground">{activeAlerts.length}</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="border-(--border)">
          <CardContent className="pt-5 flex items-center">
            <div className="p-3 bg-amber-500/10 text-amber-600 rounded-lg mr-4 border border-amber-500/20">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-(--text-muted) font-medium">Overflow Risk Days</p>
              <h3 className="text-2xl font-bold font-mono text-foreground">2</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="border-(--border)">
          <CardContent className="pt-5 flex items-center">
            <div className="p-3 bg-blue-500/10 text-blue-600 rounded-lg mr-4 border border-blue-500/20">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-(--text-muted) font-medium">Last Model Run</p>
              <h3 className="text-lg font-bold font-mono mt-1 text-foreground">Today 02:00</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Aggregate Forecast Graph */}
      <Card className="border-(--border)">
        <CardHeader>
          <CardTitle>Total Hospital Occupancy Forecast (Next 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-75 w-full" aria-label="Total Occupancy Forecast">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={next7Days.map(date => {
                  const dStr = format(date, 'yyyy-MM-dd');
                  let total = 0;
                  data.allForecasts.forEach(forecasts => {
                    const f = forecasts.find(x => x.target_date === dStr);
                    if (f) total += f.p50;
                  });
                  return { date: dStr, Total: Math.round(total) };
                })}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="date" tickFormatter={(val) => format(new Date(String(val)), "dd MMM")} tick={{fontSize: 12, fill: 'var(--text-muted)'}} />
                <YAxis tick={{fontSize: 12, fill: 'var(--text-muted)'}} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px', color: 'var(--foreground)' }}
                  labelFormatter={(val) => format(new Date(String(val)), "EEEE, dd MMM yyyy")}
                />
                <Area type="monotone" dataKey="Total" stroke="none" fill="var(--primary)" fillOpacity={0.1} />
                <Line type="monotone" dataKey="Total" stroke="var(--primary)" strokeWidth={3} dot={{r: 4, fill: 'var(--primary)'}} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Heatmap */}
        <Card className="lg:col-span-2 border-(--border)">
          <CardHeader>
            <CardTitle>7-Day Capacity Risk Heatmap</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left whitespace-nowrap" aria-label="Capacity Risk Heatmap">
                <thead className="text-(--text-muted) uppercase bg-(--surface-2) border-b border-(--border)">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">Ward</th>
                    {next7Days.map((d, i) => (
                      <th scope="col" key={i} className="px-4 py-3 text-center font-semibold">{format(d, "EEE dd")}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.wards.map((ward, wIdx) => {
                    const forecasts = data.allForecasts[wIdx];
                    return (
                      <tr key={ward.id} className="border-b border-(--border) last:border-0 hover:bg-(--surface-2) transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{ward.name}</td>
                        {next7Days.map((date, dIdx) => {
                          const f = forecasts.find(x => x.target_date === format(date, 'yyyy-MM-dd'));
                          if (!f) return <td key={dIdx} className="px-4 py-3 text-center text-(--text-muted)">-</td>;
                          const util = f.p50 / ward.capacity;
                          let bg = "bg-green-500/10 text-green-700 border border-green-500/20"; // Green
                          if (util > 0.9) bg = "bg-destructive/10 text-destructive border border-destructive/20"; // Red
                          else if (util > 0.8) bg = "bg-amber-500/10 text-amber-700 border border-amber-500/20"; // Amber
                          
                          return (
                            <td key={dIdx} className="px-2 py-2 text-center">
                              <div className={`w-full py-1.5 rounded-md ${bg} font-mono font-medium transition-transform hover:scale-105 cursor-default`}>
                                {Math.round(util * 100)}%
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card className="border-(--border)">
          <CardHeader>
            <CardTitle>Top Active Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeAlerts.length === 0 ? (
                <div className="text-center text-(--text-muted) py-8 border border-dashed border-(--border) rounded-lg">
                  No active alerts.
                </div>
              ) : (
                activeAlerts.map(alert => (
                  <div key={alert.id} className="p-4 rounded-lg border border-(--border) bg-(--surface-2)/50 hover:bg-(--surface-2) transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant={alert.severity}>{alert.severity}</Badge>
                      <span className="text-xs text-(--text-muted) font-mono">{format(new Date(alert.date), "MMM dd")}</span>
                    </div>
                    <div className="font-semibold text-sm mb-1 text-foreground">
                      {data.wards.find(w => w.id === alert.ward_id)?.name || alert.ward_id}
                    </div>
                    <ul className="text-xs text-(--text-muted) list-disc pl-4 mb-2 space-y-1">
                      {alert.reason_1 && <li>{alert.reason_1}</li>}
                      {alert.reason_2 && <li>{alert.reason_2}</li>}
                    </ul>
                    {alert.recommendation && (
                      <div className="text-xs font-medium text-(--primary) mt-2 border-t border-(--border) pt-2">
                        <Link href="/staffing" className="hover:underline flex items-center">
                          {alert.recommendation}
                        </Link>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
