"use client";

import React, { useState, useEffect } from "react";
import DashboardLayout from "../../../components/dashboard/dashboard-layout";
import { apiFetch } from "../../../lib/api-client";
import { useAuthSession } from "../../../hooks/use-auth-session";
import { 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  FileSpreadsheet, 
  Truck, 
  Compass, 
  User as UserIcon,
  Search,
  Droplet,
  Info,
  Layers,
  ChevronRight,
  TrendingUp,
  Calendar,
  Sliders,
  MapPin
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
  owner_id: string | null;
  created_at: string;
}

interface QualityReport {
  id: string;
  tested_at: string;
  ph: number;
  tds: number;
  turbidity: number;
  grade: string;
  inspector_id: string;
}

interface Tanker {
  id: string;
  plate_number: string;
  capacity_litres: number;
  default_source_id: string | null;
  license_documents: string;
  tanker_image: string;
  status: "PENDING" | "ACTIVE" | "OUT_OF_SERVICE";
  is_eligible_for_drinking: boolean;
}

export default function AdminDashboardPage() {
  const { user } = useAuthSession();
  const [activeTab, setActiveTab] = useState("overview");

  // Data states
  const [sources, setSources] = useState<WaterSource[]>([]);
  const [tankers, setTankers] = useState<Tanker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Search/Filters
  const [sourceSearch, setSourceSearch] = useState("");
  const [sourceFilterStatus, setSourceFilterStatus] = useState("");
  const [tankerSearch, setTankerSearch] = useState("");
  const [tankerFilterStatus, setTankerFilterStatus] = useState("");

  // Detailed selected items
  const [selectedSource, setSelectedSource] = useState<WaterSource | null>(null);
  const [selectedSourceReports, setSelectedSourceReports] = useState<QualityReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);

  // Status updating forms
  const [updateStatus, setUpdateStatus] = useState("PENDING");
  const [updateGrade, setUpdateGrade] = useState("A");
  const [updatingSourceId, setUpdatingSourceId] = useState<string | null>(null);

  // Tanker status updating states
  const [updatingTankerId, setUpdatingTankerId] = useState<string | null>(null);
  const [newTankerStatus, setNewTankerStatus] = useState<string>("");

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const sourcesRes = await apiFetch("/water-sources");
      if (sourcesRes?.success) {
        setSources(sourcesRes.data);
      }

      const tankersRes = await apiFetch("/admin/tankers");
      if (tankersRes?.success) {
        setTankers(tankersRes.data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load admin dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectSource = async (source: WaterSource) => {
    setSelectedSource(source);
    setUpdateStatus(source.verification_status);
    setUpdateGrade(source.quality_grade || "A");
    setLoadingReports(true);
    setSelectedSourceReports([]);
    try {
      const reportsRes = await apiFetch(`/water-sources/${source.id}/quality-reports`);
      if (reportsRes?.success) {
        setSelectedSourceReports(reportsRes.data);
      }
    } catch (err: any) {
      console.error("Failed to load reports for source:", err);
    } finally {
      setLoadingReports(false);
    }
  };

  const handleVerifySource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSource) return;
    setError(null);
    setSuccess(null);
    setUpdatingSourceId(selectedSource.id);
    try {
      const payload = {
        verification_status: updateStatus,
        quality_grade: updateStatus === "VERIFIED" ? updateGrade : null
      };

      const res = await apiFetch(`/admin/water-sources/${selectedSource.id}/verify`, {
        method: "PUT",
        json: payload
      });

      if (res?.success) {
        setSuccess(`Water source "${selectedSource.name}" updated successfully!`);
        // Refresh detail view
        setSelectedSource(res.data);
        // Refresh main list
        setSources(prev => prev.map(s => s.id === selectedSource.id ? res.data : s));
      }
    } catch (err: any) {
      setError(err.message || "Failed to update water source status.");
    } finally {
      setUpdatingSourceId(null);
    }
  };

  const handleUpdateTankerStatus = async (tankerId: string, status: string) => {
    setError(null);
    setSuccess(null);
    setUpdatingTankerId(tankerId);
    try {
      const res = await apiFetch(`/admin/tankers/${tankerId}/status`, {
        method: "PUT",
        json: { status }
      });
      if (res?.success) {
        setSuccess("Tanker status updated successfully!");
        setTankers(prev => prev.map(t => t.id === tankerId ? res.data : t));
      }
    } catch (err: any) {
      setError(err.message || "Failed to update tanker status.");
    } finally {
      setUpdatingTankerId(null);
    }
  };

  // Badges styling helpers
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "VERIFIED":
      case "ACTIVE":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={10} />
            {status}
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle size={10} />
            PENDING
          </span>
        );
      case "SUSPENDED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-orange-50 text-orange-700 border border-orange-200">
            <ShieldAlert size={10} />
            SUSPENDED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle size={10} />
            {status}
          </span>
        );
    }
  };

  const tabs = [
    { label: "Overview", icon: <Layers size={16} />, value: "overview" },
    { label: "Water Sources", icon: <Droplet size={16} />, value: "sources" },
    { label: "Tankers Approval", icon: <Truck size={16} />, value: "tankers" },
    { label: "My Profile", icon: <UserIcon size={16} />, value: "profile" }
  ];

  // Filters
  const filteredSources = sources.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(sourceSearch.toLowerCase()) || 
                          s.address.toLowerCase().includes(sourceSearch.toLowerCase());
    const matchesStatus = sourceFilterStatus ? s.verification_status === sourceFilterStatus : true;
    return matchesSearch && matchesStatus;
  });

  const filteredTankers = tankers.filter(t => {
    const matchesSearch = t.plate_number.toLowerCase().includes(tankerSearch.toLowerCase());
    const matchesStatus = tankerFilterStatus ? t.status === tankerFilterStatus : true;
    return matchesSearch && matchesStatus;
  });

  return (
    <DashboardLayout
      role="ADMIN"
      title="Administrator Panel"
      subtitle="Verify water sources, authorize tankers, and audit telemetry safety layers"
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      tabs={tabs}
    >
      {/* Toast Feedbacks */}
      {error && (
        <div className="mb-6 flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-sm shadow-sm">
          <ShieldAlert size={18} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="mb-6 flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-2xl text-sm shadow-sm">
          <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm font-semibold text-slate-500">Loading details...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-8">
              {/* Stats Cards Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="block text-xs font-bold text-gray-650 tracking-wider uppercase">Water Sources</span>
                    <span className="text-3xl font-black text-slate-900 block mt-1">{sources.length}</span>
                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 mt-2">
                      <TrendingUp size={12} />
                      {sources.filter(s => s.verification_status === "VERIFIED").length} Verified
                    </span>
                  </div>
                  <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Droplet size={24} />
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="block text-xs font-bold text-gray-650 tracking-wider uppercase">Registered Tankers</span>
                    <span className="text-3xl font-black text-slate-900 block mt-1">{tankers.length}</span>
                    <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1 mt-2">
                      <AlertTriangle size={12} />
                      {tankers.filter(t => t.status === "PENDING").length} Pending approval
                    </span>
                  </div>
                  <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Truck size={24} />
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="block text-xs font-bold text-gray-650 tracking-wider uppercase">Drinking Eligible Vehicles</span>
                    <span className="text-3xl font-black text-slate-900 block mt-1">
                      {tankers.filter(t => t.is_eligible_for_drinking).length}
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold block mt-2">
                      Authorized for clean water supply
                    </span>
                  </div>
                  <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 size={24} />
                  </div>
                </div>
              </div>

              {/* Action Banner */}
              <div className="bg-gradient-to-r from-[#2f43ff] to-blue-600 text-white rounded-3xl p-8 shadow-md">
                <h3 className="text-2xl font-black">Audit & Compliance Engine</h3>
                <p className="text-white/80 text-sm mt-2 max-w-2xl">
                  Enugu State enforces strict water source traceability. Check pending borehole certifications and authorize tankers to begin utility or drinking supply deliveries.
                </p>
                <button 
                  onClick={() => setActiveTab("sources")}
                  className="mt-6 px-6 py-3 bg-white text-[#2f43ff] hover:bg-slate-50 text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all active:scale-95"
                >
                  Review Water Sources
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: WATER SOURCES */}
          {activeTab === "sources" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              
              {/* Left 2 Columns: Sources list */}
              <div className="lg:col-span-2 space-y-4">
                
                {/* Search Bar */}
                <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <div className="relative w-full sm:max-w-xs flex items-center">
                    <Search size={16} className="absolute left-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search depot name or address..."
                      value={sourceSearch}
                      onChange={(e) => setSourceSearch(e.target.value)}
                      className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary font-medium"
                    />
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-xs font-bold text-gray-650 shrink-0 uppercase tracking-wider">Status:</span>
                    <select
                      value={sourceFilterStatus}
                      onChange={(e) => setSourceFilterStatus(e.target.value)}
                      className="w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none"
                    >
                      <option value="">All Statuses</option>
                      <option value="PENDING">PENDING</option>
                      <option value="VERIFIED">VERIFIED</option>
                      <option value="SUSPENDED">SUSPENDED</option>
                      <option value="REJECTED">REJECTED</option>
                    </select>
                  </div>
                </div>

                {/* Sources list cards */}
                <div className="space-y-3">
                  {filteredSources.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-400">
                      <Droplet size={36} className="mx-auto text-slate-300 mb-3" />
                      <p className="text-sm font-semibold">No registered water sources found.</p>
                    </div>
                  ) : (
                    filteredSources.map((source) => {
                      const isSelected = selectedSource?.id === source.id;
                      return (
                        <div
                          key={source.id}
                          onClick={() => handleSelectSource(source)}
                          className={`bg-white border rounded-3xl p-5 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-4 ${
                            isSelected ? "border-[#2f43ff] ring-1 ring-[#2f43ff]" : "border-slate-200"
                          }`}
                        >
                          <div className="space-y-1">
                            <h4 className="font-bold text-slate-900 text-base">{source.name}</h4>
                            <p className="text-xs text-gray-650 font-medium flex items-center gap-1">
                              <MapPin size={12} className="text-slate-400" />
                              {source.address}
                            </p>
                            <div className="flex items-center gap-2 pt-2">
                              <span className="text-[10px] font-bold text-slate-400 uppercase">{source.type.replace("_", " ")}</span>
                              <span className="h-1 w-1 bg-slate-300 rounded-full" />
                              <span className="text-[10px] font-bold text-slate-400">Grade: {source.quality_grade || "N/A"}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {getStatusBadge(source.verification_status)}
                            <ChevronRight size={18} className="text-slate-400" />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right 1 Column: Detail & Quality Reports Review */}
              <div className="lg:col-span-1">
                {selectedSource ? (
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md space-y-6">
                    <div>
                      <h3 className="text-lg font-black text-slate-900">{selectedSource.name}</h3>
                      <span className="inline-block mt-1">{getStatusBadge(selectedSource.verification_status)}</span>
                    </div>

                    {/* Verification Action Form */}
                    <form onSubmit={handleVerifySource} className="border-t border-slate-100 pt-5 space-y-4">
                      <h4 className="text-xs font-bold text-slate-500 tracking-wider uppercase flex items-center gap-1.5">
                        <Sliders size={14} className="text-primary" />
                        Verification status & Quality Grade
                      </h4>

                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Verification Status</label>
                          <select
                            value={updateStatus}
                            onChange={(e) => setUpdateStatus(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-xs font-semibold focus:outline-none"
                          >
                            <option value="PENDING">PENDING (Unverified)</option>
                            <option value="VERIFIED">VERIFIED (Eligible)</option>
                            <option value="SUSPENDED">SUSPENDED (Temporary Hold)</option>
                            <option value="REJECTED">REJECTED (Declined)</option>
                          </select>
                        </div>

                        {updateStatus === "VERIFIED" && (
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Assigned Water Quality Grade</label>
                            <select
                              value={updateGrade}
                              onChange={(e) => setUpdateGrade(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-xs font-semibold focus:outline-none"
                            >
                              <option value="A">Grade A (Pure / Treatment Plant)</option>
                              <option value="B">Grade B (High Quality Borehole)</option>
                              <option value="C">Grade C (Sufficient Quality)</option>
                              <option value="D">Grade D (Utility Water Only)</option>
                              <option value="E">Grade E (Low Quality)</option>
                              <option value="F">Grade F (Contaminated)</option>
                            </select>
                          </div>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={updatingSourceId === selectedSource.id}
                        className="w-full py-3 bg-[#2f43ff] hover:bg-blue-600 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {updatingSourceId === selectedSource.id ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          "Apply Decision"
                        )}
                      </button>
                    </form>

                    {/* Scientific Quality Reports History Section */}
                    <div className="border-t border-slate-100 pt-5 space-y-4">
                      <h4 className="text-xs font-bold text-slate-500 tracking-wider uppercase flex items-center gap-1.5">
                        <FileSpreadsheet size={14} className="text-primary" />
                        Laboratory reports history
                      </h4>

                      {loadingReports ? (
                        <div className="flex items-center justify-center py-6 gap-2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                          <span className="text-xs font-semibold text-slate-400">Loading reports...</span>
                        </div>
                      ) : selectedSourceReports.length === 0 ? (
                        <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl text-center text-xs text-slate-400 flex items-center gap-2">
                          <Info size={14} className="text-slate-400 shrink-0" />
                          <span>No laboratory analysis reports submitted for this water depot.</span>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                          {selectedSourceReports.map((report) => (
                            <div key={report.id} className="bg-slate-50 border border-slate-150 p-3.5 rounded-2xl space-y-2 relative">
                              <div className="flex items-center justify-between">
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-primary-light text-primary text-[9px] font-black uppercase">
                                  Grade {report.grade}
                                </span>
                                <span className="text-[9px] text-slate-400 font-bold flex items-center gap-1">
                                  <Calendar size={10} />
                                  {new Date(report.tested_at).toLocaleDateString()}
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-[10px] pt-1">
                                <div className="bg-white border border-slate-100 p-1.5 rounded-lg text-center">
                                  <span className="block text-slate-400 font-bold">pH</span>
                                  <span className="font-extrabold text-slate-800">{report.ph}</span>
                                </div>
                                <div className="bg-white border border-slate-100 p-1.5 rounded-lg text-center">
                                  <span className="block text-slate-400 font-bold">TDS</span>
                                  <span className="font-extrabold text-slate-800">{report.tds}</span>
                                </div>
                                <div className="bg-white border border-slate-100 p-1.5 rounded-lg text-center">
                                  <span className="block text-slate-400 font-bold">Turbidity</span>
                                  <span className="font-extrabold text-slate-800">{report.turbidity}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 text-center text-slate-400 shadow-sm">
                    <Info size={24} className="mx-auto text-slate-350 mb-2" />
                    <p className="text-xs font-semibold">Select a water source depot from the list to review detailed metrics and update verification status.</p>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 3: TANKERS APPROVAL */}
          {activeTab === "tankers" && (
            <div className="space-y-4">
              {/* Search / filter header */}
              <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:max-w-xs flex items-center">
                  <Search size={16} className="absolute left-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search plate number..."
                    value={tankerSearch}
                    onChange={(e) => setTankerSearch(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary font-medium"
                  />
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs font-bold text-gray-650 shrink-0 uppercase tracking-wider">Status:</span>
                  <select
                    value={tankerFilterStatus}
                    onChange={(e) => setTankerFilterStatus(e.target.value)}
                    className="w-full sm:w-auto bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none"
                  >
                    <option value="">All Statuses</option>
                    <option value="PENDING">PENDING</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="OUT_OF_SERVICE">OUT OF SERVICE</option>
                  </select>
                </div>
              </div>

              {/* Tankers list table */}
              <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase text-gray-650 tracking-wider">
                        <th className="px-6 py-4">Plate Number</th>
                        <th className="px-6 py-4">Capacity</th>
                        <th className="px-6 py-4">Verification Status</th>
                        <th className="px-6 py-4">Drinking Eligibility</th>
                        <th className="px-6 py-4 text-right">Approve Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                      {filteredTankers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                            <Truck size={32} className="mx-auto text-slate-300 mb-2" />
                            <span>No tankers registered yet.</span>
                          </td>
                        </tr>
                      ) : (
                        filteredTankers.map((t) => (
                          <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 font-bold text-slate-900">{t.plate_number}</td>
                            <td className="px-6 py-4 text-slate-600">{t.capacity_litres.toLocaleString()} L</td>
                            <td className="px-6 py-4">{getStatusBadge(t.status)}</td>
                            <td className="px-6 py-4">
                              {t.is_eligible_for_drinking ? (
                                <span className="text-emerald-600 font-bold flex items-center gap-1">
                                  <CheckCircle2 size={12} /> Eligible
                                </span>
                              ) : (
                                <span className="text-slate-400 flex items-center gap-1">
                                  <Info size={12} /> Utility Only
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <select
                                  disabled={updatingTankerId === t.id}
                                  onChange={(e) => handleUpdateTankerStatus(t.id, e.target.value)}
                                  defaultValue={t.status}
                                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] font-bold focus:outline-none"
                                >
                                  <option value="PENDING">PENDING</option>
                                  <option value="ACTIVE">ACTIVE (Approve)</option>
                                  <option value="OUT_OF_SERVICE">OUT OF SERVICE</option>
                                </select>
                                {updatingTankerId === t.id && (
                                  <div className="h-3 w-3 animate-spin rounded-full border border-primary border-t-transparent" />
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PROFILE */}
          {activeTab === "profile" && (
            <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-xl mx-auto shadow-md">
              <div className="flex items-center gap-4 border-b border-slate-100 pb-5 mb-5">
                <div className="h-14 w-14 rounded-2xl bg-[#2f43ff] text-white flex items-center justify-center">
                  <UserIcon size={28} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">{user?.first_name} {user?.last_name}</h3>
                  <span className="text-xs font-bold text-gray-650 tracking-wide uppercase">{user?.role} Profile</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase">First Name</span>
                    <span className="text-sm font-bold text-slate-800">{user?.first_name}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase">Last Name</span>
                    <span className="text-sm font-bold text-slate-800">{user?.last_name}</span>
                  </div>
                </div>

                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Email Address</span>
                  <span className="text-sm font-bold text-slate-800">{user?.email}</span>
                </div>

                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Phone Number</span>
                  <span className="text-sm font-bold text-slate-800">{user?.phone}</span>
                </div>

                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Account Status</span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 mt-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 size={12} />
                    Active Account
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
