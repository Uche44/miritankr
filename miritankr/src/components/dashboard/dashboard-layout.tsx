"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthSession } from "../../hooks/use-auth-session";
import ProtectedRoute from "../shared/protected-route";
import { apiFetch } from "../../lib/api-client";
import { 
  Menu, 
  X, 
  LogOut, 
  User as UserIcon, 
  Compass, 
  Truck, 
  FileText, 
  Home, 
  Settings, 
  Droplet,
  ClipboardList,
  ShieldCheck,
  MapPin,
  Clock,
  Layers,
  Bell,
  CheckCheck
} from "lucide-react";

interface NavItem {
  label: string;
  icon: React.ReactNode;
  value: string;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  role: "CUSTOMER" | "DRIVER" | "FACILITY" | "ADMIN";
  title: string;
  subtitle?: string;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  tabs: NavItem[];
}

export default function DashboardLayout({
  children,
  role,
  title,
  subtitle,
  activeTab,
  setActiveTab,
  tabs
}: DashboardLayoutProps) {
  const router = useRouter();
  const { user, token, clearAuth } = useAuthSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await apiFetch("/notifications");
      if (res.success && res.data) {
        setNotifications(res.data);
      }
    } catch (err) {
      console.error("Error fetching notifications:", err);
    }
  };

  useEffect(() => {
    if (user && token) {
      // Fetch initial notifications list
      fetchNotifications();

      // Setup Server-Sent Events (SSE) connection
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
      const sseUrl = `${API_BASE_URL}/notifications/stream?token=${encodeURIComponent(token)}`;
      const eventSource = new EventSource(sseUrl);

      eventSource.onmessage = (event) => {
        try {
          const newNotification = JSON.parse(event.data);
          setNotifications(prev => {
            // Avoid duplicate items
            if (prev.some(n => n.id === newNotification.id)) {
              return prev;
            }
            return [newNotification, ...prev];
          });
        } catch (err) {
          console.error("Error parsing SSE notification:", err);
        }
      };

      eventSource.onerror = (err) => {
        console.error("SSE connection error. Reconnecting...", err);
      };

      return () => {
        eventSource.close();
      };
    }
  }, [user, token]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotificationsDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      const res = await apiFetch(`/notifications/${id}/read`, { method: "PUT" });
      if (res.success) {
        setNotifications(prev =>
          prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
        );
      }
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const res = await apiFetch("/notifications/read-all", { method: "PUT" });
      if (res.success) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      }
    } catch (err) {
      console.error("Error marking all notifications as read:", err);
    }
  };

  const getRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${diffDay}d ago`;
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleLogout = () => {
    clearAuth();
    router.push("/login");
  };

  const getRoleLabel = (r: string) => {
    switch (r) {
      case "ADMIN":
        return "System Admin";
      case "FACILITY":
        return "Facility Manager";
      case "DRIVER":
        return "Tanker Operator";
      default:
        return "Customer";
    }
  };

  return (
    <ProtectedRoute allowedRoles={[role]}>
      <div className="min-h-screen bg-gray-100 flex text-slate-800 font-sans">
        
        {/* SIDEBAR - Desktop */}
        <aside className="hidden md:flex flex-col w-64 bg-[#2f43ff] text-white shrink-0 shadow-xl relative z-10">
          {/* Brand Logo Header */}
          <div className="h-20 flex items-center gap-3 px-6 border-b border-white/10 bg-black/10">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white font-black text-[#2f43ff] text-lg shadow-md">
              M
            </div>
            <div>
              <span className="text-lg font-black tracking-wider uppercase block leading-none">MiriTankr</span>
              <span className="text-[10px] text-white/60 tracking-widest uppercase block mt-1 font-bold">Trust Network</span>
            </div>
          </div>

          {/* User Status Bar */}
          <div className="px-6 py-5 border-b border-white/10 bg-black/5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center text-white border border-white/10">
                <UserIcon size={18} />
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold truncate leading-tight">{user?.first_name} {user?.last_name}</p>
                <span className="inline-block px-2 py-0.5 mt-1 rounded bg-white/10 border border-white/10 text-[9px] font-extrabold uppercase tracking-wide text-white/90">
                  {getRoleLabel(role)}
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                    isActive
                      ? "bg-white text-[#2f43ff] shadow-lg shadow-black/10"
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className={isActive ? "text-[#2f43ff]" : "text-white/60"}>
                    {tab.icon}
                  </span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer / Logout */}
          <div className="p-4 border-t border-white/10 bg-black/10">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider text-white/75 hover:bg-rose-500 hover:text-white hover:shadow-lg hover:shadow-rose-500/10 transition-all"
            >
              <LogOut size={16} className="text-white/60 group-hover:text-white" />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* SIDEBAR - Mobile (Drawer overlay) */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 md:hidden flex">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
            
            {/* Drawer */}
            <aside className="relative flex flex-col w-64 max-w-xs bg-[#2f43ff] text-white shadow-2xl z-50 animate-slide-in">
              <div className="h-20 flex items-center justify-between px-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white font-black text-[#2f43ff]">
                    M
                  </div>
                  <span className="text-lg font-black tracking-wider uppercase">MiriTankr</span>
                </div>
                <button 
                  onClick={() => setMobileOpen(false)} 
                  className="p-1 rounded bg-white/10 border border-white/10"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="px-6 py-5 border-b border-white/10 bg-black/5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center text-white">
                    <UserIcon size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold truncate">{user?.first_name} {user?.last_name}</p>
                    <span className="text-[9px] font-bold text-white/60 tracking-wider uppercase">
                      {getRoleLabel(role)}
                    </span>
                  </div>
                </div>
              </div>

              <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.value;
                  return (
                    <button
                      key={tab.value}
                      onClick={() => {
                        setActiveTab(tab.value);
                        setMobileOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                        isActive
                          ? "bg-white text-[#2f43ff] shadow-md"
                          : "text-white/70 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span>{tab.icon}</span>
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="p-4 border-t border-white/10">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider text-white/75 hover:bg-rose-500 hover:text-white transition-all"
                >
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* MAIN PAGE CONTAINER */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          
          {/* HEADER - Global Top bar */}
          <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 shadow-sm relative z-30">
            {/* Left side: Hamburger (Mobile) or Welcome */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setMobileOpen(true)}
                className="md:hidden p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Menu size={20} />
              </button>
              
              <div className="hidden sm:block">
                <h2 className="text-xl font-black text-slate-900 leading-tight">{title}</h2>
                {subtitle && <p className="text-xs text-gray-600 mt-0.5">{subtitle}</p>}
              </div>
            </div>

            {/* Right side: User navigation / helper */}
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-650 hover:bg-slate-50 transition-colors"
              >
                <Home size={12} />
                <span>Visit Homepage</span>
              </Link>
              
              <div className="h-8 w-[1px] bg-slate-200 hidden md:block"></div>

              {/* Notification Bell & Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
                  className="relative p-2 text-slate-650 hover:bg-slate-50 border border-slate-200 rounded-xl transition-all duration-200 focus:outline-none"
                  aria-label="Toggle notifications"
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white ring-2 ring-white animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotificationsDropdown && (
                  <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-150 z-50 overflow-hidden animate-slide-up transform origin-top-right">
                    {/* Header */}
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-800">Notifications</span>
                      {unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllAsRead}
                          className="flex items-center gap-1 text-[10px] font-bold text-[#2f43ff] hover:text-[#1d2ec7] uppercase tracking-wide transition-colors"
                        >
                          <CheckCheck size={12} />
                          Mark all as read
                        </button>
                      )}
                    </div>

                    {/* Notification List */}
                    <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                          <Bell size={24} className="stroke-slate-300" />
                          <p>No notifications yet</p>
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => !n.is_read && handleMarkAsRead(n.id)}
                            className={`p-4 flex gap-3 cursor-pointer transition-all ${
                              n.is_read ? "bg-white hover:bg-slate-50/50" : "bg-blue-50/40 hover:bg-blue-50/80 border-l-4 border-l-[#2f43ff]"
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-1.5">
                                <p className={`text-xs font-extrabold text-slate-900 ${!n.is_read ? "text-[#2f43ff]" : ""}`}>
                                  {n.title}
                                </p>
                                <span className="text-[9px] text-slate-400 font-bold whitespace-nowrap shrink-0 mt-0.5">
                                  {getRelativeTime(n.created_at)}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 mt-1 font-medium leading-relaxed">
                                {n.message}
                              </p>
                            </div>
                            {!n.is_read && (
                              <div className="h-2 w-2 rounded-full bg-[#2f43ff] shrink-0 mt-1.5 self-start" />
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="h-8 w-[1px] bg-slate-200"></div>
              
              <div className="flex items-center gap-3">
                <span className="text-xs font-black text-slate-900">{user?.first_name} {user?.last_name}</span>
                <div className="h-9 w-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
                  <UserIcon size={16} />
                </div>
              </div>
            </div>
          </header>

          {/* MAIN PAGE VIEW CONTENT */}
          <main className="flex-1 overflow-y-auto bg-gray-100 p-6">
            <div className="max-w-6xl mx-auto animate-fade-in">
              
              {/* Header Title (Mobile only since hidden on Desktop topbar) */}
              <div className="sm:hidden mb-6">
                <h2 className="text-2xl font-black text-slate-900">{title}</h2>
                {subtitle && <p className="text-xs text-gray-600 mt-0.5">{subtitle}</p>}
              </div>

              {children}
            </div>
          </main>
        </div>

      </div>
    </ProtectedRoute>
  );
}
