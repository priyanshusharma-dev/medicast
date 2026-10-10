"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Send, Bot, AlertCircle } from "lucide-react";

interface Metric {
  ward_id: string;
  mae: number;
  sarima_mae: number;
  naive_mae: number;
  coverage: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Health() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { role: 'assistant', text: "Hello! I am MediCast Assistant. I have access to the latest forecast metrics and SHAP values. Ask me anything about the hospital's expected load." }
  ]);
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setError(null);
        const res = await fetch(`${API_BASE_URL}/model/health`);
        if (!res.ok) throw new Error("Failed to load model health metrics");
        const data = await res.json();
        setMetrics(data);
      } catch (err) {
        console.error(err);
        setError("Unable to load metrics at this time.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchMetrics();
  }, []);

  const handleRetrain = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/retrain`, { method: "POST" });
      if (!res.ok) throw new Error("Retraining failed to start");
      alert("Retraining triggered in the background.");
    } catch (err) {
      console.error(err);
      alert("Failed to trigger retraining. Please check the server.");
    }
  };

  const handleSend = async () => {
    if (!query.trim()) return;
    const newHistory = [...chatHistory, { role: 'user' as const, text: query }];
    setChatHistory(newHistory);
    setQuery("");
    setChatLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: newHistory[newHistory.length-1].text })
      });
      if (!res.ok) throw new Error("Assistant response failed");
      const data = await res.json();
      setChatHistory(h => [...h, { role: 'assistant', text: data.answer }]);
    } catch (e) {
      console.error(e);
      setChatHistory(h => [...h, { role: 'assistant', text: "I'm sorry, I'm having trouble connecting to the server right now." }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Model Health & Assistant</h1>
        <Button variant="outline" onClick={handleRetrain} aria-label="Trigger model retraining">
          Trigger Retraining
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Forecast Performance (Test Set)</CardTitle>
                <Badge variant="LOW" className="bg-green-500/10 text-green-600 border-green-500/20">Stable</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {error ? (
                <div className="p-4 rounded-md bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-2 mb-4" role="alert">
                  <AlertCircle className="h-5 w-5" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left whitespace-nowrap" aria-label="Model metrics table">
                    <thead className="text-(--text-muted) bg-(--surface-2)">
                      <tr>
                        <th scope="col" className="px-4 py-3 rounded-tl-lg font-semibold">Ward</th>
                        <th scope="col" className="px-4 py-3 font-semibold">LGBM MAE</th>
                        <th scope="col" className="px-4 py-3 font-semibold">SARIMA MAE</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Naive MAE</th>
                        <th scope="col" className="px-4 py-3 rounded-tr-lg font-semibold">Coverage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                          <tr key={i} className="border-b border-(--border)">
                            <td className="px-4 py-4"><div className="h-4 w-16 bg-(--surface-2) animate-pulse rounded" /></td>
                            <td className="px-4 py-4"><div className="h-4 w-12 bg-(--surface-2) animate-pulse rounded" /></td>
                            <td className="px-4 py-4"><div className="h-4 w-12 bg-(--surface-2) animate-pulse rounded" /></td>
                            <td className="px-4 py-4"><div className="h-4 w-12 bg-(--surface-2) animate-pulse rounded" /></td>
                            <td className="px-4 py-4"><div className="h-4 w-12 bg-(--surface-2) animate-pulse rounded" /></td>
                          </tr>
                        ))
                      ) : metrics.length === 0 ? (
                        <tr><td colSpan={5} className="p-8 text-center text-(--text-muted)">No metrics available.</td></tr>
                      ) : (
                        metrics.map(m => (
                          <tr key={m.ward_id} className="border-b border-(--border) font-mono hover:bg-(--surface-2) transition-colors">
                            <td className="px-4 py-3 font-medium font-sans uppercase">{m.ward_id}</td>
                            <td className="px-4 py-3 text-(--primary) font-bold">{m.mae.toFixed(2)}</td>
                            <td className="px-4 py-3 text-(--text-muted)">{m.sarima_mae.toFixed(2)}</td>
                            <td className="px-4 py-3 text-(--text-muted)">{m.naive_mae.toFixed(2)}</td>
                            <td className="px-4 py-3">{(m.coverage * 100).toFixed(1)}%</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="flex flex-col h-150 border-(--border)">
          <CardHeader className="border-b border-(--border) bg-(--surface-2)/50">
            <CardTitle className="flex items-center">
              <Bot className="w-5 h-5 mr-2 text-(--primary)" aria-hidden="true" />
              MediCast AI Assistant
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col pt-4 overflow-hidden relative">
            <div className="flex-1 overflow-y-auto space-y-6 pr-2 pb-4 scroll-smooth" role="log" aria-live="polite">
              {chatHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-(--primary) text-primary-foreground rounded-tr-sm' 
                      : 'bg-(--surface-2) text-foreground border border-(--border) rounded-tl-sm'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-(--surface-2) text-(--text-muted) border border-(--border) rounded-2xl rounded-tl-sm px-4 py-3 text-sm flex items-center space-x-1 shadow-sm">
                    <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                    <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                    <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-auto pt-4 border-t border-(--border) bg-background">
              <div className="flex flex-wrap gap-2 mb-3">
                <button 
                  onClick={() => setQuery("Why is ICU risky on Thursday?")} 
                  className="text-xs bg-(--surface-2) hover:bg-(--border) text-(--text-muted) hover:text-foreground rounded-full px-3 py-1.5 transition-colors border border-transparent hover:border-(--border)"
                >
                  &quot;Why is ICU risky on Thursday?&quot;
                </button>
                <button 
                  onClick={() => setQuery("What is the staffing situation this weekend?")} 
                  className="text-xs bg-(--surface-2) hover:bg-(--border) text-(--text-muted) hover:text-foreground rounded-full px-3 py-1.5 transition-colors border border-transparent hover:border-(--border)"
                >
                  &quot;Staffing this weekend?&quot;
                </button>
              </div>
              <div className="flex space-x-2">
                <input 
                  type="text" 
                  className="flex-1 bg-(--surface) border border-(--border) rounded-md px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--primary) focus:border-transparent transition-all"
                  placeholder="Ask about forecasts, alerts, or drivers..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  aria-label="Message assistant"
                />
                <Button onClick={handleSend} disabled={!query.trim() || chatLoading} aria-label="Send message">
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
