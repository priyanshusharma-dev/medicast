"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Check, AlertCircle } from "lucide-react";
import Link from "next/link";

interface Alert {
  id: number;
  severity: "HIGH" | "MEDIUM" | "LOW";
  date: string;
  ward_id: string;
  is_acknowledged: boolean;
  reason_1?: string;
  reason_2?: string;
  reason_3?: string;
  recommendation?: string;
}

interface Ward {
  id: string;
  name: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [filterSeverity, setFilterSeverity] = useState("ALL");
  const [filterWard, setFilterWard] = useState("ALL");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setError(null);
        const [aRes, wRes] = await Promise.all([
          fetch(`${API_BASE_URL}/alerts`),
          fetch(`${API_BASE_URL}/wards`)
        ]);
        
        if (!aRes.ok || !wRes.ok) {
          throw new Error("Failed to fetch data");
        }

        setAlerts(await aRes.json());
        setWards(await wRes.json());
      } catch (err) {
        console.error(err);
        setError("Unable to load alerts at this time. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleAcknowledge = async (id: number) => {
    // Optimistic UI update, would call API in real app
    setAlerts(alerts.map(a => a.id === id ? { ...a, is_acknowledged: true } : a));
  };

  const filtered = alerts.filter(a => {
    if (filterSeverity !== "ALL" && a.severity !== filterSeverity) return false;
    if (filterWard !== "ALL" && a.ward_id !== filterWard) return false;
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">System Alerts</h1>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
          <select 
            value={filterSeverity}
            onChange={e => setFilterSeverity(e.target.value)}
            className="bg-(--surface) border border-(--border) rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            aria-label="Filter by severity"
          >
            <option value="ALL">All Severities</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <select 
            value={filterWard}
            onChange={e => setFilterWard(e.target.value)}
            className="bg-(--surface) border border-(--border) rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            aria-label="Filter by ward"
          >
            <option value="ALL">All Wards</option>
            {wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-md bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-2" role="alert">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap" aria-label="Alerts table">
            <thead className="text-(--text-muted) bg-(--surface-2) border-b border-(--border)">
              <tr>
                <th scope="col" className="px-4 py-3 w-10"><span className="sr-only">Expand</span></th>
                <th scope="col" className="px-4 py-3 font-semibold">Severity</th>
                <th scope="col" className="px-4 py-3 font-semibold">Date</th>
                <th scope="col" className="px-4 py-3 font-semibold">Ward</th>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-(--border)">
                    <td className="px-4 py-4"><div className="h-4 w-4 bg-(--surface-2) animate-pulse rounded" /></td>
                    <td className="px-4 py-4"><div className="h-6 w-16 bg-(--surface-2) animate-pulse rounded-full" /></td>
                    <td className="px-4 py-4"><div className="h-4 w-24 bg-(--surface-2) animate-pulse rounded" /></td>
                    <td className="px-4 py-4"><div className="h-4 w-32 bg-(--surface-2) animate-pulse rounded" /></td>
                    <td className="px-4 py-4"><div className="h-4 w-12 bg-(--surface-2) animate-pulse rounded" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 && !error ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-(--text-muted)">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Check className="h-8 w-8 opacity-50" />
                      <p>No alerts found matching your criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(a => (
                  <React.Fragment key={a.id}>
                    <tr 
                      className={`border-b border-(--border) hover:bg-(--surface-2) transition-colors cursor-pointer group ${a.is_acknowledged ? 'opacity-70' : ''}`}
                      onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                      aria-expanded={expandedId === a.id}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setExpandedId(expandedId === a.id ? null : a.id);
                        }
                      }}
                    >
                      <td className="px-4 py-3 text-(--text-muted) group-hover:text-(--foreground) transition-colors">
                        {expandedId === a.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </td>
                      <td className="px-4 py-3"><Badge variant={a.severity as "LOW" | "MEDIUM" | "HIGH"}>{a.severity}</Badge></td>
                      <td className="px-4 py-3 font-mono text-(--text-muted)">{format(new Date(a.date), "dd MMM yyyy")}</td>
                      <td className="px-4 py-3 font-medium">{wards.find(w => w.id === a.ward_id)?.name || a.ward_id}</td>
                      <td className="px-4 py-3 text-xs">
                        {a.is_acknowledged ? (
                          <span className="text-green-500 flex items-center bg-green-500/10 px-2 py-1 rounded-full w-fit">
                            <Check className="w-3 h-3 mr-1"/> Ack&apos;d
                          </span>
                        ) : (
                          <span className="text-blue-500 font-medium bg-blue-500/10 px-2 py-1 rounded-full w-fit">
                            New
                          </span>
                        )}
                      </td>
                    </tr>
                    {expandedId === a.id && (
                      <tr className="bg-(--surface-2)/50">
                        <td colSpan={5} className="px-4 sm:px-10 py-6 border-b border-(--border)">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <h4 className="text-xs font-bold text-(--text-muted) uppercase mb-3 tracking-wider">Key Drivers</h4>
                              {a.reason_1 || a.reason_2 || a.reason_3 ? (
                                <ul className="space-y-2 text-sm text-(--text-muted)">
                                  {a.reason_1 && <li className="flex items-start"><span className="mr-2 mt-1 w-1.5 h-1.5 rounded-full bg-(--primary) opacity-50 shrink-0"></span>{a.reason_1}</li>}
                                  {a.reason_2 && <li className="flex items-start"><span className="mr-2 mt-1 w-1.5 h-1.5 rounded-full bg-(--primary) opacity-50 shrink-0"></span>{a.reason_2}</li>}
                                  {a.reason_3 && <li className="flex items-start"><span className="mr-2 mt-1 w-1.5 h-1.5 rounded-full bg-(--primary) opacity-50 shrink-0"></span>{a.reason_3}</li>}
                                </ul>
                              ) : (
                                <p className="text-sm text-(--text-muted) italic">No specific drivers listed.</p>
                              )}
                            </div>
                            <div className="flex flex-col h-full justify-between">
                              <div>
                                <h4 className="text-xs font-bold text-(--text-muted) uppercase mb-3 tracking-wider">Recommended Action</h4>
                                <p className="text-sm font-medium text-(--primary) mb-6 bg-(--primary)/5 p-3 rounded-md border border-(--primary)/10">
                                  {a.recommendation ? (
                                    <Link href="/staffing" className="hover:underline flex items-center group">
                                      {a.recommendation}
                                      <ChevronRight className="w-4 h-4 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </Link>
                                  ) : (
                                    "No specific action recommended."
                                  )}
                                </p>
                              </div>
                              {!a.is_acknowledged && (
                                <div className="flex flex-wrap gap-2 mt-auto">
                                  <Button onClick={() => handleAcknowledge(a.id)} className="shadow-sm">Acknowledge Alert</Button>
                                  <Button variant="outline" onClick={() => handleAcknowledge(a.id)}>Dismiss</Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
