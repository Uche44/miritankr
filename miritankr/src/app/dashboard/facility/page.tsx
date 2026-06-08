"use client";

import React, { useState, useEffect } from "react";
import DashboardLayout from "../../../components/dashboard/dashboard-layout";
import { apiFetch } from "../../../lib/api-client";
import { useAuthSession } from "../../../hooks/use-auth-session";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Layers,
  Droplet,
  FileSpreadsheet,
  User as UserIcon,
  PlusCircle,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Calendar,
  Compass,
  ArrowRight,
  TrendingUp,
  Database
} from "lucide-react";

// Water source registration schema (similar to Milestones 4-5)
const registerSourceSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(255),
  type: z.string().min(1, "Please select a water source type"),
  address: z.string().min(5, "Address must be at least 5 characters"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

type RegisterSourceFormValues = z.infer<typeof registerSourceSchema>;

// Quality report submission schema
const submitReportSchema = z.object({
  source_id: z.string().uuid("Please select a valid water source"),
  tested_at: z.string().min(1, "Please select the laboratory test date"),
  ph: z.number().min(0, "pH must be between 0 and 14").max(14, "pH must be between 0 and 14"),
  tds: z.number().nonnegative("TDS level must be positive"),
  turbidity: z.number().nonnegative("Turbidity level must be positive"),
  grade: z.string().min(1, "Please select a water grade"),
});

type SubmitReportFormValues = z.infer<typeof submitReportSchema>;

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

export default function FacilityDashboardPage() {
  const { user } = useAuthSession();
  const [activeTab, setActiveTab] = useState("overview");

  // States
  const [sources, setSources] = useState<WaterSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submittingSource, setSubmittingSource] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);

  // Forms
  const {
    register: registerSource,
    handleSubmit: handleSourceSubmit,
    reset: resetSourceForm,
    formState: { errors: sourceErrors },
  } = useForm<RegisterSourceFormValues>({
    resolver: zodResolver(registerSourceSchema),
    defaultValues: {
      name: "",
      type: "BOREHOLE",
      address: "",
      latitude: 6.443, // Enugu default
      longitude: 7.505, // Enugu default
    }
  });

  const {
    register: registerReport,
    handleSubmit: handleReportSubmit,
    reset: resetReportForm,
    formState: { errors: reportErrors },
  } = useForm<SubmitReportFormValues>({
    resolver: zodResolver(submitReportSchema),
    defaultValues: {
      source_id: "",
      tested_at: new Date().toISOString().split("T")[0],
      ph: 7.0,
      tds: 120,
      turbidity: 1.0,
      grade: "A",
    }
  });

  const loadSources = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/water-sources");
      if (res?.success) {
        // Filter sources owned by this facility operator
        const mySources = res.data.filter((s: WaterSource) => s.owner_id === user?.id);
        setSources(mySources);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load water sources.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadSources();
    }
  }, [user?.id]);

  const onRegisterSource = async (data: RegisterSourceFormValues) => {
    setSubmittingSource(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiFetch("/water-sources", {
        method: "POST",
        json: data
      });

      if (res?.success) {
        setSuccess(`Water source "${data.name}" registered successfully! Awaiting Admin verification.`);
        resetSourceForm();
        setActiveTab("overview");
        loadSources();
      }
    } catch (err: any) {
      setError(err.message || "Failed to register water source.");
    } finally {
      setSubmittingSource(false);
    }
  };

  const onSubmitReport = async (data: SubmitReportFormValues) => {
    setSubmittingReport(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        tested_at: new Date(data.tested_at).toISOString(),
        ph: data.ph,
        tds: data.tds,
        turbidity: data.turbidity,
        grade: data.grade,
      };

      const res = await apiFetch(`/water-sources/${data.source_id}/quality-reports`, {
        method: "POST",
        json: payload
      });

      if (res?.success) {
        setSuccess("Laboratory quality report submitted successfully! Water source grade updated.");
        resetReportForm();
        setActiveTab("overview");
        loadSources();
      }
    } catch (err: any) {
      setError(err.message || "Failed to submit laboratory report.");
    } finally {
      setSubmittingReport(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "VERIFIED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={10} />
            VERIFIED
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle size={10} />
            PENDING VERIFICATION
          </span>
        );
      case "SUSPENDED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-orange-50 text-orange-700 border border-orange-200">
            <AlertTriangle size={10} />
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
    { label: "Register Source", icon: <PlusCircle size={16} />, value: "register" },
    { label: "Submit Lab Report", icon: <FileSpreadsheet size={16} />, value: "quality" },
    { label: "My Profile", icon: <UserIcon size={16} />, value: "profile" }
  ];

  return (
    <DashboardLayout
      role="FACILITY"
      title="Facility Operator Panel"
      subtitle="Manage your boreholes/treatment depots and submit lab verification data"
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      tabs={tabs}
    >
      {/* Toast Alert Feedbacks */}
      {error && (
        <div className="mb-6 flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-sm shadow-sm animate-fade-in">
          <XCircle size={18} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="mb-6 flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-2xl text-sm shadow-sm animate-fade-in">
          <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm font-semibold text-slate-500">Loading sources...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              
              {/* Header metrics info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="block text-xs font-bold text-gray-650 tracking-wider uppercase">Active Depots</span>
                    <span className="text-3xl font-black text-slate-900 block mt-1">{sources.length}</span>
                  </div>
                  <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Droplet size={24} />
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="block text-xs font-bold text-gray-650 tracking-wider uppercase">Verified drinking sources</span>
                    <span className="text-3xl font-black text-slate-900 block mt-1">
                      {sources.filter(s => s.verification_status === "VERIFIED" && s.quality_grade && ["A", "B", "C"].includes(s.quality_grade.toUpperCase())).length}
                    </span>
                  </div>
                  <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 size={24} />
                  </div>
                </div>
              </div>

              {/* registered sources list */}
              <div className="space-y-4">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Database size={18} className="text-primary" />
                  Your Registered Water Sources
                </h3>

                {sources.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-400">
                    <Droplet size={36} className="mx-auto text-slate-300 mb-3" />
                    <p className="text-sm font-semibold">You have not registered any water sources yet.</p>
                    <button
                      onClick={() => setActiveTab("register")}
                      className="mt-4 px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95"
                    >
                      Register First Source
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {sources.map((source) => {
                      const isDrinkingEligible = source.verification_status === "VERIFIED";
                      return (
                        <div key={source.id} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-extrabold text-slate-900 text-lg leading-snug">{source.name}</h4>
                              <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-[9px] font-bold text-slate-500 uppercase mt-1">
                                {source.type.replace("_", " ")}
                              </span>
                            </div>
                            <span className="shrink-0">{getStatusBadge(source.verification_status)}</span>
                          </div>

                          <div className="space-y-1.5 text-xs text-gray-650 border-t border-slate-100 pt-4">
                            <p className="flex items-center gap-1.5 font-medium">
                              <MapPin size={14} className="text-slate-400 shrink-0" />
                              <span className="truncate">{source.address}</span>
                            </p>
                            <p className="flex items-center gap-1.5 font-medium">
                              <Calendar size={14} className="text-slate-400 shrink-0" />
                              Registered: {new Date(source.created_at).toLocaleDateString()}
                            </p>
                            <p className="flex items-center gap-1.5 font-medium">
                              <TrendingUp size={14} className="text-slate-400 shrink-0" />
                              Grade: <span className="font-black text-slate-800">{source.quality_grade || "Pending Analysis"}</span>
                            </p>
                          </div>

                          {/* drinking eligibility alert banner */}
                          <div className={`p-4 rounded-2xl border flex items-center gap-3 text-xs font-semibold ${
                            isDrinkingEligible 
                              ? "bg-emerald-50/50 border-emerald-100 text-emerald-950"
                              : "bg-amber-50/50 border-amber-100 text-amber-950"
                          }`}>
                            {isDrinkingEligible ? (
                              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                            ) : (
                              <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                            )}
                            <p className="leading-snug">
                              {isDrinkingEligible
                                ? "This water depot is verified and authorized to supply Drinking Water."
                                : "Awaiting verification. Currently authorized for Utility Water deliveries only."}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 2: REGISTER WATER SOURCE */}
          {activeTab === "register" && (
            <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-2xl mx-auto shadow-md">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <div className="h-10 w-10 rounded-xl bg-primary-light flex items-center justify-center text-primary">
                  <PlusCircle size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Register New Depot Depot</h3>
                  <p className="text-xs text-gray-650">Submit details for verification and mapping layers</p>
                </div>
              </div>

              <form onSubmit={handleSourceSubmit(onRegisterSource)} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Name */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Depot Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Enugu Central Borehole"
                      {...registerSource("name")}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary font-semibold"
                    />
                    {sourceErrors.name && (
                      <p className="text-xs text-red-500 font-medium pl-1">{sourceErrors.name.message}</p>
                    )}
                  </div>

                  {/* Type */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Source Depot Type</label>
                    <select
                      {...registerSource("type")}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary font-medium"
                    >
                      <option value="BOREHOLE">BOREHOLE</option>
                      <option value="TREATMENT_PLANT">TREATMENT PLANT</option>
                      <option value="RESERVOIR">RESERVOIR</option>
                      <option value="GOVERNMENT_FACILITY">GOVERNMENT FACILITY</option>
                      <option value="COMMERCIAL_VENDOR">COMMERCIAL VENDOR</option>
                    </select>
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Physical Address</label>
                  <input
                    type="text"
                    placeholder="e.g. 10 Independence Layout, Enugu State"
                    {...registerSource("address")}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary font-semibold"
                  />
                  {sourceErrors.address && (
                    <p className="text-xs text-red-500 font-medium pl-1">{sourceErrors.address.message}</p>
                  )}
                </div>

                {/* GPS Telemetry coordinates */}
                <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-2xl border border-slate-150">
                  <div className="col-span-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Compass size={14} className="text-primary" />
                    Simulated Enugu Location Mapping
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Latitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      {...registerSource("latitude", { valueAsNumber: true })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Longitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      {...registerSource("longitude", { valueAsNumber: true })}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submittingSource}
                  className="w-full py-3.5 bg-primary hover:bg-primary-hover text-white font-bold text-sm rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
                >
                  {submittingSource ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <span>Register Water Source</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: SUBMIT QUALITY REPORT */}
          {activeTab === "quality" && (
            <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-2xl mx-auto shadow-md">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <div className="h-10 w-10 rounded-xl bg-primary-light flex items-center justify-center text-primary">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Submit Laboratory Quality Analysis</h3>
                  <p className="text-xs text-gray-650">Input chemical safety metrics to synchronize quality verification</p>
                </div>
              </div>

              {sources.length === 0 ? (
                <div className="bg-slate-50 border border-slate-150 p-6 rounded-2xl text-center text-xs text-slate-500 flex items-center gap-2 justify-center">
                  <Info size={16} className="text-slate-400" />
                  <span>You must register a water source depot before submitting quality reports.</span>
                </div>
              ) : (
                <form onSubmit={handleReportSubmit(onSubmitReport)} className="space-y-6">
                  {/* Water Source Dropdown */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Select Water Source</label>
                    <select
                      {...registerReport("source_id")}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary font-medium"
                    >
                      <option value="">-- Choose Water Depot --</option>
                      {sources.map((src) => (
                        <option key={src.id} value={src.id}>
                          {src.name} ({src.verification_status})
                        </option>
                      ))}
                    </select>
                    {reportErrors.source_id && (
                      <p className="text-xs text-red-500 font-medium pl-1">{reportErrors.source_id.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Tested At */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Laboratory Test Date</label>
                      <input
                        type="date"
                        {...registerReport("tested_at")}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary font-semibold"
                      />
                      {reportErrors.tested_at && (
                        <p className="text-xs text-red-500 font-medium pl-1">{reportErrors.tested_at.message}</p>
                      )}
                    </div>

                    {/* Quality Grade Dropdown */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Assessed Water Grade</label>
                      <select
                        {...registerReport("grade")}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary font-medium"
                      >
                        <option value="A">Grade A (Ideal drinking water)</option>
                        <option value="B">Grade B (Borehole drinking water)</option>
                        <option value="C">Grade C (Sufficient utility/drinking)</option>
                        <option value="D">Grade D (Utility water only)</option>
                        <option value="E">Grade E (Low quality / non-drinking)</option>
                        <option value="F">Grade F (Non-potable)</option>
                      </select>
                    </div>
                  </div>

                  {/* Chemical Indicators Inputs */}
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-150 space-y-4">
                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Chemical Indicators Metrics</span>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      {/* pH Input */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">pH (Acidity level)</label>
                        <input
                          type="number"
                          step="0.1"
                          {...registerReport("ph", { valueAsNumber: true })}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none"
                        />
                        <p className="text-[9px] text-slate-450 pl-1">Ideal: 6.5 - 8.5</p>
                        {reportErrors.ph && (
                          <p className="text-xs text-red-500 font-medium pl-1">{reportErrors.ph.message}</p>
                        )}
                      </div>

                      {/* TDS Input */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">TDS (mg/L)</label>
                        <input
                          type="number"
                          {...registerReport("tds", { valueAsNumber: true })}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none"
                        />
                        <p className="text-[9px] text-slate-450 pl-1">Ideal: &lt; 500 mg/L</p>
                        {reportErrors.tds && (
                          <p className="text-xs text-red-500 font-medium pl-1">{reportErrors.tds.message}</p>
                        )}
                      </div>

                      {/* Turbidity Input */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">Turbidity (NTU)</label>
                        <input
                          type="number"
                          step="0.1"
                          {...registerReport("turbidity", { valueAsNumber: true })}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold focus:outline-none"
                        />
                        <p className="text-[9px] text-slate-450 pl-1">Ideal: &lt; 5.0 NTU</p>
                        {reportErrors.turbidity && (
                          <p className="text-xs text-red-500 font-medium pl-1">{reportErrors.turbidity.message}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingReport}
                    className="w-full py-3.5 bg-[#2f43ff] hover:bg-blue-600 text-white font-bold text-sm rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
                  >
                    {submittingReport ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <span>Submit Lab Analysis</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>
              )}
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
