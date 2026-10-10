"use client"
import { Bell, Moon, Sun, User, Settings, LogOut } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function Topbar() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  return (
    <header className="h-16 border-b border-(--border) bg-(--surface) flex items-center justify-between px-6 transition-colors duration-150">
      <div className="flex items-center">
        <h2 className="text-lg font-semibold md:hidden">MediCast</h2>
        <div className="hidden md:flex items-center space-x-2">
          <span className="text-sm text-(--text-muted)">Hospital:</span>
          <select className="bg-transparent border border-(--border) rounded-md px-2 py-1 text-sm focus:outline-none focus:border-(--primary)">
            <option>Central City Hospital</option>
            <option>Northside Medical Center</option>
            <option>South Park General</option>
            <option>East Wing Clinic</option>
          </select>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <button 
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-full hover:bg-(--surface-2) text-(--text-muted) transition-colors"
        >
          {mounted && theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        <button className="relative p-2 rounded-full hover:bg-(--surface-2) text-(--text-muted) transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-(--surface)"></span>
        </button>
        <div className="relative">
          <button 
            onClick={() => setProfileOpen(!profileOpen)}
            className="w-8 h-8 rounded-full bg-(--primary-soft) text-(--primary) flex items-center justify-center font-semibold text-sm hover:ring-2 hover:ring-(--primary) transition-all"
          >
            JD
          </button>
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-(--surface) border border-(--border) rounded-md shadow-lg py-1 z-50">
              <Link href="#" className="flex items-center px-4 py-2 text-sm text-(--text) hover:bg-(--surface-2)">
                <User className="w-4 h-4 mr-2" /> Profile
              </Link>
              <Link href="#" className="flex items-center px-4 py-2 text-sm text-(--text) hover:bg-(--surface-2)">
                <Settings className="w-4 h-4 mr-2" /> Settings
              </Link>
              <div className="border-t border-(--border) my-1"></div>
              <Link href="#" className="flex items-center px-4 py-2 text-sm text-red-500 hover:bg-(--surface-2)">
                <LogOut className="w-4 h-4 mr-2" /> Logout
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
