"use client";

import Link from "next/link";
import { Activity, LayoutDashboard, Users, HeartPulse, BrainCircuit, AlertTriangle } from "lucide-react";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();
  
  const navItems = [
    { name: "Overview", href: "/", icon: LayoutDashboard },
    { name: "Forecasts", href: "/forecasts", icon: Activity },
    { name: "Alerts", href: "/alerts", icon: AlertTriangle },
    { name: "What-If", href: "/whatif", icon: BrainCircuit },
    { name: "Staffing", href: "/staffing", icon: Users },
    { name: "Model Health", href: "/health", icon: HeartPulse },
  ];

  return (
    <aside className="w-64 border-r border-(--border) bg-(--surface) flex flex-col md:flex transition-colors duration-150">
      <div className="h-16 flex items-center px-6 border-b border-(--border)">
        <Activity className="w-6 h-6 text-(--primary) mr-2" />
        <span className="font-bold text-lg text-(--text) tracking-tight">MediCast</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.name}>
                <Link href={item.href}>
                  <div className={`flex items-center px-3 py-2.5 rounded-lg transition-colors duration-150 ${
                    isActive 
                      ? "bg-(--primary-soft) text-(--primary) font-medium" 
                      : "text-(--text-muted) hover:bg-(--surface-2) hover:text-(--text)"
                  }`}>
                    <item.icon className="w-5 h-5 mr-3" />
                    {item.name}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
