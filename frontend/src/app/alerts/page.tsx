"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Check } from "lucide-react";
import Link from "next/link";

export default function Alerts() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [filterSeverity, setFilterSeverity] = useState("ALL");
  const [filterWard, setFilterWard] = useState("ALL");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [aRes, wRes] = await Promise.all([
          fetch("http://localhost:8000/alerts"),
          fetch("http://localhost:8000/wards")
        ]);
        setAlerts(await aRes.json());
        setWards(await wRes.json());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleAcknowledge = (id: number) => {
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
        <h1 className="text-2xl font-bold tracking-tight">System Alerts</h1>
        <div className="flex space-x-2">
          <select 
            value={filterSeverity}
            onChange={e => setFilterSeverity(e.target.value)}
            className="bg-(--surface) border border-(--border) rounded-md px-3 py-1.5 text-sm focus:outline-none"
          >
            <option value="ALL">All Severities</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
          </select>
          <select 
            value={filterWard}
            onChange={e => setFilterWard(e.target.value)}
            className="bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-1.5 text-sm focus:outline-none"
          >
            <option value="ALL">All Wards</option>
            {wards.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[var(--text-muted)] bg-[var(--surface-2)] border-b border-[var(--border)]">
              <tr>
                <th className="px-4 py-3 w-10"></th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Ward</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-[var(--text-muted)]">Loading alerts...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-[var(--text-muted)]">No alerts found.</td></tr>
              ) : (
                filtered.map(a => (
                  <React.Fragment key={a.id}>
                    <tr 
                      className={`border-b border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer ${a.is_acknowledged ? 'opacity-60' : ''}`}
                      onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                    >
                      <td className="px-4 py-3 text-[var(--text-muted)]">
                        {expandedId === a.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </td>
                      <td className="px-4 py-3"><Badge variant={a.severity}>{a.severity}</Badge></td>
                      <td className="px-4 py-3 font-mono">{format(new Date(a.date), "dd MMM yyyy")}</td>
                      <td className="px-4 py-3 font-medium">{wards.find(w => w.id === a.ward_id)?.name || a.ward_id}</td>
                      <td className="px-4 py-3 text-xs">
                        {a.is_acknowledged ? <span className="text-green-500 flex items-center"><Check className="w-3 h-3 mr-1"/> Ack'd</span> : "New"}
                      </td>
                    </tr>
                    {expandedId === a.id && (
                      <tr className="bg-[var(--surface-2)]/50">
                        <td colSpan={5} className="px-10 py-4 border-b border-[var(--border)]">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <h4 className="text-xs font-bold text-[var(--text-muted)] uppercase mb-2">Key Drivers</h4>
                              <ul className="list-disc pl-4 space-y-1 text-sm">
                                {a.reason_1 && <li>{a.reason_1}</li>}
                                {a.reason_2 && <li>{a.reason_2}</li>}
                                {a.reason_3 && <li>{a.reason_3}</li>}
                              </ul>
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-(--text-muted) uppercase mb-2">Recommended Action</h4>
                              <p className="text-sm font-medium text-(--primary) mb-4">
                                <Link href="/staffing" className="hover:underline">
                                  {a.recommendation}
                                </Link>
                              </p>
                              {!a.is_acknowledged && (
                                <div className="flex space-x-2">
                                  <Button onClick={() => handleAcknowledge(a.id)}>Acknowledge</Button>
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
