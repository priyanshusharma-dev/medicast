"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Send, Bot } from "lucide-react";

export default function Health() {
  const [metrics, setMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [chatHistory, setChatHistory] = useState<{role: 'user'|'assistant', text: string}[]>([
    { role: 'assistant', text: "Hello! I am MediCast Assistant. I have access to the latest forecast metrics and SHAP values. Ask me anything about the hospital's expected load." }
  ]);
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    fetch("http://localhost:8000/model/health")
      .then(r => r.json())
      .then(d => {
        setMetrics(d);
        setLoading(false);
      });
  }, []);

  const handleRetrain = async () => {
    await fetch("http://localhost:8000/retrain", { method: "POST" });
    alert("Retraining triggered in the background.");
  };

  const handleSend = async () => {
    if (!query.trim()) return;
    const newHistory = [...chatHistory, { role: 'user' as const, text: query }];
    setChatHistory(newHistory);
    setQuery("");
    setChatLoading(true);

    try {
      const res = await fetch("http://localhost:8000/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: newHistory[newHistory.length-1].text })
      });
      const data = await res.json();
      setChatHistory(h => [...h, { role: 'assistant', text: data.answer }]);
    } catch (e) {
      console.error(e);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Model Health & Assistant</h1>
        <Button variant="outline" onClick={handleRetrain}>Trigger Retraining</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Forecast Performance (Test Set)</CardTitle>
                <Badge variant="LOW">Stable</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-[var(--text-muted)] bg-[var(--surface-2)]">
                    <tr>
                      <th className="px-4 py-3 rounded-tl-lg">Ward</th>
                      <th className="px-4 py-3">LGBM MAE</th>
                      <th className="px-4 py-3">SARIMA MAE</th>
                      <th className="px-4 py-3">Naive MAE</th>
                      <th className="px-4 py-3">Coverage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={5} className="p-4 text-center">Loading...</td></tr>
                    ) : metrics.map(m => (
                      <tr key={m.ward_id} className="border-b border-[var(--border)] font-mono">
                        <td className="px-4 py-3 font-medium font-sans uppercase">{m.ward_id}</td>
                        <td className="px-4 py-3 text-[var(--primary)] font-bold">{m.mae.toFixed(2)}</td>
                        <td className="px-4 py-3 text-[var(--text-muted)]">{m.sarima_mae.toFixed(2)}</td>
                        <td className="px-4 py-3 text-[var(--text-muted)]">{m.naive_mae.toFixed(2)}</td>
                        <td className="px-4 py-3">{(m.coverage * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="flex flex-col h-[600px]">
          <CardHeader className="border-b border-[var(--border)]">
            <CardTitle className="flex items-center">
              <Bot className="w-5 h-5 mr-2 text-[var(--primary)]" />
              MediCast AI Assistant
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col pt-4 overflow-hidden">
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-4">
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-lg px-4 py-3 text-sm ${
                    msg.role === 'user' 
                      ? 'bg-[var(--primary)] text-white' 
                      : 'bg-[var(--surface-2)] text-[var(--text)]'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-[var(--surface-2)] text-[var(--text-muted)] rounded-lg px-4 py-3 text-sm animate-pulse">
                    Thinking...
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-auto">
              <div className="flex flex-wrap gap-2 mb-3">
                <button onClick={() => setQuery("Why is ICU risky on Thursday?")} className="text-xs bg-[var(--surface-2)] hover:bg-[var(--border)] rounded-full px-3 py-1 transition-colors">
                  "Why is ICU risky on Thursday?"
                </button>
                <button onClick={() => setQuery("What is the staffing situation this weekend?")} className="text-xs bg-[var(--surface-2)] hover:bg-[var(--border)] rounded-full px-3 py-1 transition-colors">
                  "Staffing this weekend?"
                </button>
              </div>
              <div className="flex space-x-2">
                <input 
                  type="text" 
                  className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[var(--primary)]"
                  placeholder="Ask about forecasts, alerts, or drivers..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                />
                <Button onClick={handleSend} disabled={!query.trim() || chatLoading}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
