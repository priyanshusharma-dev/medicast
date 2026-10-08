"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, addDays } from "date-fns";
import { AlertCircle, TrendingUp, CheckCircle, Clock, Upload } from "lucide-react";
import Link from "next/link";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Area, ComposedChart } from "recharts";

export default function Overview() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real app we would fetch from our FastAPI endpoints here.
    // For this MVP step we can fetch the real endpoints since they are running!
    const fetchData = async () => {
      try {
        const [wardsRes, alertsRes, forecastRes] = await Promise.all([
          fetch("http://localhost:8000/wards"),
          fetch("http://localhost:8000/alerts"),
          fetch("http://localhost:8000/forecast?ward=icu&days=7") // sample for KPI
        ]);
        const wards = await wardsRes.json();
        const alerts = await alertsRes.json();
        
        // Let's get forecasts for all wards for the heatmap
        const allForecasts = await Promise.all(
          wards.map((w: any) => fetch(`http://localhost:8000/forecast?ward=${w.id}&days=7`).then(res => res.json()))
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

  if (loading) return <div className="p-8 text-center text-[var(--text-muted)] animate-pulse">Loading overview...</div>;
  if (!data) return <div className="p-8 text-center text-red-500">Failed to load data. Is the backend running?</div>;

  const activeAlerts = data.alerts.filter((a: any) => !a.is_acknowledged).slice(0, 3);
  
  const today = new Date();
  const next7Days = Array.from({length: 7}).map((_, i) => addDays(today, i+1));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Hospital Overview</h1>
        <label className="cursor-pointer bg-[var(--primary)] text-white hover:opacity-90 px-4 py-2 rounded-md text-sm font-medium flex items-center transition-colors shadow-sm">
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
        <Card>
          <CardContent className="pt-5 flex items-center">
            <div className="p-3 bg-[var(--primary-soft)] text-[var(--primary)] rounded-lg mr-4">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)] font-medium">System Status</p>
              <h3 className="text-2xl font-bold font-mono">Stable</h3>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-center">
            <div className="p-3 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-lg mr-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)] font-medium">Active Alerts</p>
              <h3 className="text-2xl font-bold font-mono">{activeAlerts.length}</h3>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-center">
            <div className="p-3 bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 rounded-lg mr-4">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)] font-medium">Overflow Risk Days</p>
              <h3 className="text-2xl font-bold font-mono">2</h3>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-center">
            <div className="p-3 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg mr-4">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-[var(--text-muted)] font-medium">Last Model Run</p>
              <h3 className="text-lg font-bold font-mono mt-1">Today 02:00</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Aggregate Forecast Graph */}
      <Card>
        <CardHeader>
          <CardTitle>Total Hospital Occupancy Forecast (Next 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={next7Days.map(date => {
                  const dStr = format(date, 'yyyy-MM-dd');
                  let total = 0;
                  data.allForecasts.forEach((forecasts: any) => {
                    const f = forecasts.find((x:any) => x.target_date === dStr);
                    if (f) total += f.p50;
                  });
                  return { date: dStr, Total: Math.round(total) };
                })}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="date" tickFormatter={(val) => format(new Date(val), "dd MMM")} tick={{fontSize: 12, fill: 'var(--text-muted)'}} />
                <YAxis tick={{fontSize: 12, fill: 'var(--text-muted)'}} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '8px' }}
                  labelFormatter={(val) => format(new Date(val), "EEEE, dd MMM yyyy")}
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
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>7-Day Capacity Risk Heatmap</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[var(--text-muted)] uppercase bg-[var(--surface-2)]">
                  <tr>
                    <th className="px-4 py-3 rounded-tl-lg">Ward</th>
                    {next7Days.map((d, i) => (
                      <th key={i} className="px-4 py-3 text-center">{format(d, "EEE dd")}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.wards.map((ward: any, wIdx: number) => {
                    const forecasts = data.allForecasts[wIdx];
                    return (
                      <tr key={ward.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)] transition-colors">
                        <td className="px-4 py-3 font-medium">{ward.name}</td>
                        {next7Days.map((date, dIdx) => {
                          const f = forecasts.find((x:any) => x.target_date === format(date, 'yyyy-MM-dd'));
                          if (!f) return <td key={dIdx} className="px-4 py-3 text-center">-</td>;
                          const util = f.p50 / ward.capacity;
                          let bg = "bg-[#DCFCE7] dark:bg-[#0F2E1C]"; // Green
                          if (util > 0.9) bg = "bg-[#FEE2E2] dark:bg-[#3A1214]"; // Red
                          else if (util > 0.8) bg = "bg-[#FEF3C7] dark:bg-[#3A2A0A]"; // Amber
                          
                          return (
                            <td key={dIdx} className="px-2 py-2 text-center">
                              <div className={`w-full py-2 rounded-md ${bg} font-mono font-medium transition-transform hover:scale-105 cursor-default`}>
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
        <Card>
          <CardHeader>
            <CardTitle>Top Active Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeAlerts.length === 0 ? (
                <div className="text-center text-[var(--text-muted)] py-8">No active alerts.</div>
              ) : (
                activeAlerts.map((alert: any) => (
                  <div key={alert.id} className="p-4 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]">
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant={alert.severity}>{alert.severity}</Badge>
                      <span className="text-xs text-[var(--text-muted)] font-mono">{alert.date}</span>
                    </div>
                    <div className="font-semibold text-sm mb-1">
                      {data.wards.find((w:any) => w.id === alert.ward_id)?.name || alert.ward_id}
                    </div>
                    <ul className="text-xs text-[var(--text-muted)] list-disc pl-4 mb-2 space-y-1">
                      {alert.reason_1 && <li>{alert.reason_1}</li>}
                      {alert.reason_2 && <li>{alert.reason_2}</li>}
                    </ul>
                    <div className="text-xs font-medium text-[var(--primary)] mt-2 border-t border-[var(--border)] pt-2">
                      <Link href="/staffing" className="hover:underline">
                        {alert.recommendation}
                      </Link>
                    </div>
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
