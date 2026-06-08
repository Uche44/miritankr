"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "../../components/navbar";
import { useAuthSession } from "../../hooks/use-auth-session";
import { apiFetch } from "../../lib/api-client";
import { 
  Search, 
  Filter, 
  Plus, 
  CheckCircle, 
  AlertCircle, 
  MapPin, 
  Activity, 
  HelpCircle,
  ExternalLink,
  Loader2
} from "lucide-react";

interface WaterSource {
  id: string;
  name: string;
  type: string;
  verification_status: string;
  quality_grade: string | null;
  address: string;
  latitude: number;
  longitude: number;
  last_verified_at: string | null;
}

export default function WaterSourcesPage() {
  const { user, isLoggedIn, isReady } = useAuthSession();
  const [sources, setSources] = useState<WaterSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");

  useEffect(() => {
    async function loadSources() {
      try {
        setLoading(true);
        setError(null);
        const response = await apiFetch("/water-sources");
        if (response && response.success) {
          setSources(response.data);
        } else {
          setSources([]);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load water sources catalog.");
      } finally {
        setLoading(false);
      }
    }
    loadSources();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case "VERIFIED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 border border-emerald-250 text-emerald-700">
            <CheckCircle size={12} />
            Verified
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-50 border border-amber-250 text-amber-700">
            <Activity size={12} className="animate-pulse" />
            Pending Verification
          </span>
        );
      case "SUSPENDED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-50 border border-rose-250 text-rose-700">
            <AlertCircle size={12} />
            Suspended
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-50 border border-red-250 text-red-700">
            <AlertCircle size={12} />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
            <HelpCircle size={12} />
            {status}
          </span>
        );
    }
  };

  const getGradeBadge = (grade: string | null) => {
    if (!grade) return null;
    return (
      <span className="inline-flex items-center px-2 py-0.5 text-xs font-bold rounded bg-primary-light text-primary border border-primary/20">
        Grade {grade}
      </span>
    );
  };

  // Filter logic
  const filteredSources = sources.filter((source) => {
    const matchesSearch = 
      source.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      source.address.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = selectedType === "ALL" || source.type === selectedType;
    const matchesStatus = selectedStatus === "ALL" || source.verification_status === selectedStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  const canRegister = isLoggedIn && user && (user.role === "FACILITY" || user.role === "ADMIN");

  return (
    <div className="bg-slate-50 min-h-screen text-slate-800 flex flex-col pt-24">
      <Navbar />

      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Block */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
              Water Sources Catalog
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Verify water provenance and safety levels across Enugu State depots.
            </p>
          </div>
          {canRegister && (
            <Link
              href="/sources/register"
              className="flex items-center gap-2 rounded-xl bg-primary hover:bg-primary-hover px-5 py-3 font-semibold text-sm text-white shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus size={16} />
              Register Water Source
            </Link>
          )}
        </div>

        {/* Filters and Search panel */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search Input */}
            <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all">
              <Search size={18} className="absolute left-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by source name or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-transparent text-sm text-slate-700 placeholder-slate-400 focus:outline-none"
              />
            </div>

            {/* Filter by Type */}
            <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl focus-within:border-primary transition-all">
              <Filter size={18} className="absolute left-4 text-slate-400" />
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-transparent text-sm text-slate-700 focus:outline-none appearance-none cursor-pointer"
              >
                <option value="ALL">All Water Types</option>
                <option value="BOREHOLE">Borehole</option>
                <option value="TREATMENT_PLANT">Treatment Plant</option>
                <option value="RESERVOIR">Reservoir</option>
                <option value="GOVERNMENT_FACILITY">Government Facility</option>
                <option value="COMMERCIAL_VENDOR">Commercial Vendor</option>
              </select>
            </div>

            {/* Filter by Status */}
            <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl focus-within:border-primary transition-all">
              <CheckCircle size={18} className="absolute left-4 text-slate-400" />
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-transparent text-sm text-slate-700 focus:outline-none appearance-none cursor-pointer"
              >
                <option value="ALL">All Verification Statuses</option>
                <option value="VERIFIED">Verified Only</option>
                <option value="PENDING">Pending Only</option>
                <option value="SUSPENDED">Suspended Only</option>
                <option value="REJECTED">Rejected Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Catalog Body */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-slate-500 text-sm mt-3">Loading water sources data...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-2" />
            <h3 className="text-red-800 font-bold">Error Loading Data</h3>
            <p className="text-red-650 text-sm mt-1">{error}</p>
          </div>
        ) : filteredSources.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-sm">
            <MapPin className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-slate-700 font-bold text-lg">No Water Sources Found</h3>
            <p className="text-slate-400 text-sm mt-1 max-w-md mx-auto">
              We couldn't find any registered water sources matching your search criteria. Register a source to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSources.map((source) => (
              <div 
                key={source.id} 
                className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md hover:border-slate-300/80 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start gap-2 mb-4">
                    <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">
                      {source.type.replace("_", " ")}
                    </span>
                    <div className="flex gap-1.5 items-center">
                      {getGradeBadge(source.quality_grade)}
                      {getStatusBadge(source.verification_status)}
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 line-clamp-1 mb-2">
                    {source.name}
                  </h3>

                  <div className="flex items-start gap-2 text-slate-500 text-sm mb-4">
                    <MapPin size={16} className="shrink-0 mt-0.5 text-slate-400" />
                    <p className="line-clamp-2">{source.address}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex flex-col">
                    <span>GPS Coordinates</span>
                    <span className="font-semibold text-slate-600">
                      {source.latitude.toFixed(4)}° N, {source.longitude.toFixed(4)}° E
                    </span>
                  </div>

                  <Link
                    href={`/sources/${source.id}`}
                    className="flex items-center gap-1 text-primary hover:text-primary-hover font-bold"
                  >
                    <span>View Details</span>
                    <ExternalLink size={14} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
