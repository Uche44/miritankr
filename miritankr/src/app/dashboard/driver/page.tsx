"use client";

import React, { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "../../../components/navbar";
import ProtectedRoute from "../../../components/shared/protected-route";
import { apiFetch } from "../../../lib/api-client";
import {
  Truck,
  FileText,
  ImageIcon,
  MapPin,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Droplet,
  ArrowRight,
  Info,
  Radio,
  Compass,
  Activity,
  Wifi,
  Navigation,
  RefreshCw,
  LogOut
} from "lucide-react";

// Form Schema
const registerTankerSchema = z.object({
  plate_number: z.string()
    .min(3, "Plate number must be at least 3 characters")
    .max(50, "Plate number must be under 50 characters")
    .transform(v => v.trim().toUpperCase()),
  capacity_litres: z.number({ message: "Capacity is required" })
    .gt(0, "Capacity must be greater than 0"),
  default_source_id: z.string().uuid("Please select a valid water source"),
  license_documents: z.string()
    .min(5, "Please provide vehicle/license document URL or description"),
  tanker_image: z.string()
    .min(5, "Please provide tanker image URL or description"),
});

type RegisterTankerFormValues = z.infer<typeof registerTankerSchema>;

interface WaterSource {
  id: string;
  name: string;
  type: string;
  verification_status: string;
}

interface Tanker {
  id: string;
  plate_number: string;
  capacity_litres: number;
  default_source_id: string | null;
  license_documents: string;
  tanker_image: string;
  status: "PENDING" | "ACTIVE" | "OUT_OF_SERVICE";
  created_at: string;
  is_eligible_for_drinking: boolean;
}

interface Driver {
  id: string;
  tanker_id: string | null;
  status: "AVAILABLE" | "OFFLINE" | "BUSY";
  latitude: number | null;
  longitude: number | null;
  last_location_update: string | null;
  created_at: string;
}

// Preset locations in Enugu for simulation
const ENUGU_PRESETS = [
  { name: "Independence Layout (Govt House)", lat: 6.4281, lng: 7.5024 },
  { name: "New Haven (Commercial Hub)", lat: 6.4474, lng: 7.5109 },
  { name: "9th Mile Corner (Water Reservoir)", lat: 6.4253, lng: 7.4042 },
  { name: "Abakpa Nike (Residential)", lat: 6.4715, lng: 7.5385 },
  { name: "Trans Ekulu (Highlands)", lat: 6.4632, lng: 7.5055 },
];

export default function DriverDashboardPage() {
  const router = useRouter();
  
  // States
  const [tanker, setTanker] = useState<Tanker | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [sources, setSources] = useState<WaterSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // User Actions Feedback
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showRegForm, setShowRegForm] = useState(false);

  // Telemetry Simulation States
  const [simLat, setSimLat] = useState<number>(6.44);
  const [simLng, setSimLng] = useState<number>(7.50);
  const [updatingLocation, setUpdatingLocation] = useState(false);
  const [telemetrySyncActive, setTelemetrySyncActive] = useState(false);

  // Keep reference for background periodic telemetry
  const telemetryIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterTankerFormValues>({
    resolver: zodResolver(registerTankerSchema),
    defaultValues: {
      plate_number: "",
      capacity_litres: 10000,
      default_source_id: "",
      license_documents: "",
      tanker_image: "",
    }
  });

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch current driver tanker
      const tankerRes = await apiFetch("/tankers/me");
      if (tankerRes && tankerRes.success && tankerRes.data) {
        setTanker(tankerRes.data);
        setShowRegForm(false);

        // 2. Fetch driver telemetry profile
        const driverRes = await apiFetch("/drivers/me");
        if (driverRes && driverRes.success) {
          const dData = driverRes.data;
          setDriver(dData);
          if (dData.latitude) setSimLat(dData.latitude);
          if (dData.longitude) setSimLng(dData.longitude);
        }
      } else {
        setShowRegForm(true);
        await fetchWaterSources();
      }
    } catch (err: any) {
      const errMsg = err.message || "";
      const isNotFound = 
        errMsg.toLowerCase().includes("not found") || 
        errMsg.toLowerCase().includes("not registered") ||
        errMsg.toLowerCase().includes("no tanker");
      
      if (isNotFound) {
        setShowRegForm(true);
        await fetchWaterSources();
      } else {
        setError(errMsg || "Failed to load dashboard data.");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchWaterSources = async () => {
    try {
      const sourcesRes = await apiFetch("/water-sources");
      if (sourcesRes && sourcesRes.success) {
        setSources(sourcesRes.data);
      }
    } catch (err: any) {
      console.error("Failed to load water sources:", err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    // Cleanup interval on unmount
    return () => {
      if (telemetryIntervalRef.current) clearInterval(telemetryIntervalRef.current);
    };
  }, []);

  // Telemetry periodic simulation effect
  useEffect(() => {
    if (driver && driver.status === "AVAILABLE" && driver.tanker_id) {
      setTelemetrySyncActive(true);
      // Run location update every 30 seconds with minor variations to simulate driving
      telemetryIntervalRef.current = setInterval(() => {
        simulateSmallMovement();
      }, 30000);
    } else {
      setTelemetrySyncActive(false);
      if (telemetryIntervalRef.current) {
        clearInterval(telemetryIntervalRef.current);
        telemetryIntervalRef.current = null;
      }
    }

    return () => {
      if (telemetryIntervalRef.current) {
        clearInterval(telemetryIntervalRef.current);
        telemetryIntervalRef.current = null;
      }
    };
  }, [driver?.status, driver?.tanker_id]);

  const simulateSmallMovement = async () => {
    // Add tiny random delta: ~10-50 meters
    const latDelta = (Math.random() - 0.5) * 0.001;
    const lngDelta = (Math.random() - 0.5) * 0.001;
    
    setSimLat(prev => {
      const nextLat = prev + latDelta;
      setSimLng(prevLng => {
        const nextLng = prevLng + lngDelta;
        // Submit location in background
        apiFetch("/drivers/me/location", {
          method: "PUT",
          json: { latitude: nextLat, longitude: nextLng }
        }).catch(err => console.error("Telemetry auto-update failed:", err));
        return nextLng;
      });
      return nextLat;
    });
  };

  const onSubmit = async (data: RegisterTankerFormValues) => {
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const response = await apiFetch("/tankers", {
        method: "POST",
        json: data,
      });

      if (response && response.success) {
        setSuccessMsg("Tanker registered successfully! Pending Administrator approval.");
        setTimeout(() => {
          fetchDashboardData();
        }, 1500);
      } else {
        setError(response.message || "Failed to register tanker.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during registration.");
    } finally {
      setSubmitting(false);
    }
  };

  // Actions: Toggle Availability Status
  const handleToggleStatus = async (newStatus: "AVAILABLE" | "OFFLINE") => {
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await apiFetch("/drivers/me/status", {
        method: "PUT",
        json: { status: newStatus }
      });
      if (res && res.success) {
        setDriver(res.data);
        setSuccessMsg(`Status updated to ${newStatus === "AVAILABLE" ? "Online & Ready" : "Offline"}.`);
      }
    } catch (err: any) {
      setError(err.message || "Failed to update availability status.");
    }
  };

  // Actions: Assign Tanker to Profile
  const handleAssignTanker = async () => {
    if (!tanker) return;
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await apiFetch("/drivers/me/tanker", {
        method: "PUT",
        json: { tanker_id: tanker.id }
      });
      if (res && res.success) {
        setDriver(res.data);
        setSuccessMsg("Vehicle assigned to your active profile successfully!");
      }
    } catch (err: any) {
      setError(err.message || "Failed to assign vehicle.");
    }
  };

  // Actions: Unassign Tanker
  const handleUnassignTanker = async () => {
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await apiFetch("/drivers/me/tanker", {
        method: "PUT",
        json: { tanker_id: null }
      });
      if (res && res.success) {
        setDriver(res.data);
        setSuccessMsg("Vehicle unassigned successfully.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to unassign vehicle.");
    }
  };

  // Actions: Update simulated location
  const handleUpdateLocation = async () => {
    setError(null);
    setSuccessMsg(null);
    setUpdatingLocation(true);
    try {
      const res = await apiFetch("/drivers/me/location", {
        method: "PUT",
        json: { latitude: simLat, longitude: simLng }
      });
      if (res && res.success) {
        setDriver(res.data);
        setSuccessMsg("GPS Telemetry coordinates updated successfully.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to update location telemetry.");
    } finally {
      setUpdatingLocation(false);
    }
  };

  // Preset location selector helper
  const handlePresetSelect = (presetIndex: string) => {
    if (presetIndex === "") return;
    const preset = ENUGU_PRESETS[parseInt(presetIndex)];
    setSimLat(preset.lat);
    setSimLng(preset.lng);
  };

  // Detect using browser Geolocation
  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSimLat(parseFloat(position.coords.latitude.toFixed(6)));
        setSimLng(parseFloat(position.coords.longitude.toFixed(6)));
        setSuccessMsg("GPS location detected successfully. Click update to sync.");
      },
      (err) => {
        setError(`Failed to retrieve device location: ${err.message}`);
      }
    );
  };

  const getStatusBadge = (status: Tanker["status"]) => {
    switch (status) {
      case "ACTIVE":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
            <CheckCircle size={12} />
            Approved
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-sm">
            <AlertTriangle size={12} />
            Pending Verification
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-sm">
            <AlertCircle size={12} />
            Suspended
          </span>
        );
    }
  };

  const renderSelectedSourceName = () => {
    if (!tanker || !tanker.default_source_id) return "None selected";
    const selectedSource = sources.find(s => s.id === tanker.default_source_id);
    return selectedSource ? selectedSource.name : "Registered Source";
  };

  const isLink = (val: string) => {
    return val.startsWith("http://") || val.startsWith("https://");
  };

  if (loading) {
    return (
      <div className="bg-gray-100 min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm font-semibold text-slate-500">Loading your Driver dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["DRIVER"]}>
      <div className="bg-gray-100 min-h-screen text-slate-800 flex flex-col pt-24">
        <Navbar />

        <main className="flex-1 mx-auto max-w-4xl w-full px-4 py-8">
          {/* Header Info */}
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900">
                Driver <span className="text-primary">Dashboard</span>
              </h1>
              <p className="text-slate-500 mt-1">Manage your tanker registration, telemetry, and online dispatch</p>
            </div>
            {tanker && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Tanker Approval:</span>
                {getStatusBadge(tanker.status)}
              </div>
            )}
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl text-sm shadow-sm">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-6 flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 rounded-2xl text-sm shadow-sm">
              <CheckCircle size={18} className="shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Registration Form */}
          {showRegForm ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xl">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <div className="h-10 w-10 rounded-xl bg-primary-light flex items-center justify-center text-primary">
                  <Truck size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Register Your Water Tanker</h2>
                  <p className="text-xs text-slate-400">Complete registration to begin receiving delivery tasks</p>
                </div>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Plate Number */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 tracking-wider uppercase" htmlFor="plate_number">
                      Plate Number
                    </label>
                    <input
                      id="plate_number"
                      type="text"
                      placeholder="e.g. ENU-123-AA"
                      {...register("plate_number")}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all font-semibold uppercase"
                    />
                    {errors.plate_number && (
                      <p className="text-xs text-red-500 font-medium pl-1">{errors.plate_number.message}</p>
                    )}
                  </div>

                  {/* Capacity in Litres */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 tracking-wider uppercase" htmlFor="capacity_litres">
                      Capacity (Litres)
                    </label>
                    <input
                      id="capacity_litres"
                      type="number"
                      placeholder="e.g. 10000"
                      {...register("capacity_litres", { valueAsNumber: true })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all font-semibold"
                    />
                    {errors.capacity_litres && (
                      <p className="text-xs text-red-500 font-medium pl-1">{errors.capacity_litres.message}</p>
                    )}
                  </div>
                </div>

                {/* Default Water Source Dropdown */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-500 tracking-wider uppercase" htmlFor="default_source_id">
                    Default Water Source Depot
                  </label>
                  <select
                    id="default_source_id"
                    {...register("default_source_id")}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all font-medium"
                  >
                    <option value="">-- Choose a Water Factory or Depot --</option>
                    {sources.map((src) => (
                      <option key={src.id} value={src.id}>
                        {src.verification_status === "VERIFIED" ? "✓ [VERIFIED] " : "[UNVERIFIED] "}
                        {src.name} ({src.type.replace("_", " ")})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 pl-1 flex items-center gap-1">
                    <Info size={12} className="text-primary shrink-0" />
                    Drivers must register with a default source. Note: Drinking water delivery requires a Verified source.
                  </p>
                  {errors.default_source_id && (
                    <p className="text-xs text-red-500 font-medium pl-1">{errors.default_source_id.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* License Documents */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 tracking-wider uppercase" htmlFor="license_documents">
                      Vehicle License Documents
                    </label>
                    <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl focus-within:border-primary transition-all">
                      <FileText size={16} className="absolute left-4 text-slate-400" />
                      <input
                        id="license_documents"
                        type="text"
                        placeholder="Link to PDF/Document or text description"
                        {...register("license_documents")}
                        className="w-full pl-12 pr-4 py-3 bg-transparent text-sm focus:outline-none font-medium text-slate-700"
                      />
                    </div>
                    {errors.license_documents && (
                      <p className="text-xs text-red-500 font-medium pl-1">{errors.license_documents.message}</p>
                    )}
                  </div>

                  {/* Tanker Image */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 tracking-wider uppercase" htmlFor="tanker_image">
                      Tanker Image Link
                    </label>
                    <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl focus-within:border-primary transition-all">
                      <ImageIcon size={16} className="absolute left-4 text-slate-400" />
                      <input
                        id="tanker_image"
                        type="text"
                        placeholder="URL/Link to tanker photo or description"
                        {...register("tanker_image")}
                        className="w-full pl-12 pr-4 py-3 bg-transparent text-sm focus:outline-none font-medium text-slate-700"
                      />
                    </div>
                    {errors.tanker_image && (
                      <p className="text-xs text-red-500 font-medium pl-1">{errors.tanker_image.message}</p>
                    )}
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-hover py-3.5 font-bold text-sm text-white shadow-lg shadow-primary/20 transition-all hover:scale-[1.005] active:scale-[0.995] disabled:opacity-50 disabled:pointer-events-none"
                >
                  {submitting ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      <span>Submit Tanker Registration</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            /* Tanker Details & Telemetry Dashboard */
            <div className="space-y-6">
              
              {/* Vehicle Association Check Action */}
              {tanker && tanker.status === "ACTIVE" && driver && driver.tanker_id !== tanker.id && (
                <div className="bg-primary/5 border border-primary/20 p-6 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-white shrink-0">
                      <Wifi size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">Tanker Verified & Ready!</h4>
                      <p className="text-xs text-slate-500">Associate your verified vehicle with your active driver profile to go online.</p>
                    </div>
                  </div>
                  <button
                    onClick={handleAssignTanker}
                    className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95"
                  >
                    Assign Tanker as Active Vehicle
                  </button>
                </div>
              )}

              {/* Status Control Card */}
              {driver && (
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-3">
                    <div className={`h-12 w-12 rounded-2xl flex items-center justify-center text-white shrink-0 ${
                      driver.status === "AVAILABLE" ? "bg-emerald-500" : "bg-slate-400"
                    }`}>
                      <Radio size={24} className={driver.status === "AVAILABLE" ? "animate-pulse" : ""} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                        Availability Status: 
                        <span className={driver.status === "AVAILABLE" ? "text-emerald-600" : "text-slate-500"}>
                          {driver.status === "AVAILABLE" ? "Online & Ready" : "Offline"}
                        </span>
                      </h3>
                      <p className="text-xs text-slate-400">
                        {driver.status === "AVAILABLE" 
                          ? "You are visible to customers and ready to receive dispatch requests."
                          : "You are currently offline. Assign a verified vehicle and go online to receive orders."}
                      </p>
                    </div>
                  </div>

                  {/* Toggle Controls */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleStatus("OFFLINE")}
                      disabled={driver.status === "OFFLINE"}
                      className={`px-5 py-3 text-xs font-bold rounded-xl border transition-all ${
                        driver.status === "OFFLINE"
                          ? "bg-slate-100 border-slate-200 text-slate-400 pointer-events-none"
                          : "bg-white hover:bg-slate-50 border-slate-250 text-slate-700 shadow-sm active:scale-95"
                      }`}
                    >
                      Go Offline
                    </button>
                    <button
                      onClick={() => handleToggleStatus("AVAILABLE")}
                      disabled={driver.status === "AVAILABLE" || !driver.tanker_id}
                      className={`px-5 py-3 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 ${
                        driver.status === "AVAILABLE"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700 pointer-events-none"
                          : !driver.tanker_id
                          ? "bg-slate-100 border-slate-200 text-slate-350 cursor-not-allowed"
                          : "bg-primary hover:bg-primary-hover border-transparent text-white shadow-md active:scale-95 hover:scale-[1.01]"
                      }`}
                    >
                      <Activity size={14} className={driver.status === "AVAILABLE" ? "animate-pulse" : ""} />
                      Go Online
                    </button>
                  </div>
                </div>
              )}

              {/* Eligibility Alert Card */}
              {tanker && (
                <div className={`p-6 rounded-3xl border shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4 transition-all duration-300 ${
                  tanker.is_eligible_for_drinking
                    ? "bg-emerald-50/50 border-emerald-100 text-emerald-950"
                    : "bg-amber-50/50 border-amber-100 text-amber-950"
                }`}>
                  <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                    tanker.is_eligible_for_drinking
                      ? "bg-emerald-500 text-white"
                      : "bg-amber-500 text-white"
                  }`}>
                    {tanker.is_eligible_for_drinking ? <CheckCircle size={24} /> : <AlertTriangle size={24} />}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-base">
                      {tanker.is_eligible_for_drinking
                        ? "Drinking Water Supply Approved"
                        : "Drinking Water Supply Suspended / Ineligible"}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {tanker.is_eligible_for_drinking
                        ? "Your vehicle and source water certifications are active. You can now distribute drinking-grade water."
                        : "To deliver drinking water, your tanker must be verified ACTIVE by the admin AND your default source must be a VERIFIED facility."}
                    </p>
                  </div>
                  <div className="px-3 py-1 rounded-xl font-bold text-xs shrink-0 self-end sm:self-center bg-white shadow-sm border border-slate-100">
                    {tanker.is_eligible_for_drinking ? "Drinking Water: YES" : "Drinking Water: NO"}
                  </div>
                </div>
              )}

              {/* GPS Telemetry panel */}
              {driver && driver.tanker_id && (
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                      <Compass size={18} className="text-primary" />
                      GPS Telemetry Simulation
                    </h3>
                    {telemetrySyncActive && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary-light text-primary animate-pulse">
                        <Navigation size={8} className="animate-spin" />
                        Auto-Sync Active (30s)
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Live Telemetry coordinates */}
                    <div className="space-y-4">
                      <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4">
                        <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Current Broadcast Location</span>
                        <div className="mt-2 flex items-center justify-between">
                          <div>
                            <span className="text-xs font-semibold text-slate-400 block">Latitude</span>
                            <span className="text-lg font-black text-slate-800">{driver.latitude?.toFixed(6) || "None"}</span>
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-slate-400 block">Longitude</span>
                            <span className="text-lg font-black text-slate-800">{driver.longitude?.toFixed(6) || "None"}</span>
                          </div>
                        </div>
                        <span className="block text-[9px] text-slate-400 mt-3 flex items-center gap-1">
                          <RefreshCw size={10} />
                          Last updated: {driver.last_location_update ? new Date(driver.last_location_update).toLocaleTimeString() : "Never"}
                        </span>
                      </div>

                      {/* Presets Select Dropdown */}
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-500 tracking-wider uppercase">
                          Simulate Preset Landmark (Enugu)
                        </label>
                        <select
                          onChange={(e) => handlePresetSelect(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-medium focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                        >
                          <option value="">-- Choose Preset Location --</option>
                          {ENUGU_PRESETS.map((preset, index) => (
                            <option key={preset.name} value={index}>
                              {preset.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Manual Telemetry Controls */}
                    <div className="space-y-4 flex flex-col justify-between">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-slate-500 tracking-wider uppercase">Latitude</label>
                          <input
                            type="number"
                            step="0.000001"
                            value={simLat}
                            onChange={(e) => setSimLat(parseFloat(e.target.value))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-bold text-slate-500 tracking-wider uppercase">Longitude</label>
                          <input
                            type="number"
                            step="0.000001"
                            value={simLng}
                            onChange={(e) => setSimLng(parseFloat(e.target.value))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex gap-3 mt-4">
                        <button
                          type="button"
                          onClick={handleDetectGPS}
                          className="flex-1 py-3 border border-slate-250 text-slate-700 bg-white hover:bg-slate-50 font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                        >
                          <MapPin size={14} className="text-slate-400" />
                          Detect GPS
                        </button>
                        <button
                          type="button"
                          disabled={updatingLocation}
                          onClick={handleUpdateLocation}
                          className="flex-1 py-3 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
                        >
                          {updatingLocation ? (
                            <div className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                          ) : (
                            <>
                              <Navigation size={14} />
                              Sync GPS
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tanker Info details */}
              {tanker && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Core Vehicle Specifications */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md md:col-span-2 space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <Truck size={18} className="text-primary" />
                        Vehicle Information
                      </h3>
                      {driver && driver.tanker_id === tanker.id ? (
                        <button
                          onClick={handleUnassignTanker}
                          className="text-[10px] text-red-500 font-bold border border-red-200 px-2.5 py-1 rounded-lg hover:bg-red-50 transition-all"
                        >
                          Unassign Vehicle
                        </button>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-2 gap-y-6 gap-x-4">
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Plate Number</span>
                        <span className="text-lg font-black text-slate-800 uppercase tracking-wide">{tanker.plate_number}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Tanker Capacity</span>
                        <span className="text-lg font-black text-slate-800">
                          {tanker.capacity_litres.toLocaleString()} <span className="text-sm font-semibold text-slate-400">Litres</span>
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">Documents Submitted</span>
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-150 text-xs">
                            <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                              <FileText size={14} className="text-slate-400" />
                              Vehicle License
                            </span>
                            {isLink(tanker.license_documents) ? (
                              <a
                                href={tanker.license_documents}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary font-bold hover:underline flex items-center gap-0.5"
                              >
                                View Doc <ExternalLink size={10} />
                              </a>
                            ) : (
                              <span className="text-slate-500 italic max-w-[180px] truncate">{tanker.license_documents}</span>
                            )}
                          </div>

                          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-150 text-xs">
                            <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                              <ImageIcon size={14} className="text-slate-400" />
                              Tanker Photo
                            </span>
                            {isLink(tanker.tanker_image) ? (
                              <a
                                href={tanker.tanker_image}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary font-bold hover:underline flex items-center gap-0.5"
                              >
                                View Photo <ExternalLink size={10} />
                              </a>
                            ) : (
                              <span className="text-slate-500 italic max-w-[180px] truncate">{tanker.tanker_image}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Water Source details */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md space-y-6">
                    <h3 className="font-bold text-lg text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
                      <Droplet size={18} className="text-primary" />
                      Water Depot
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Default Source</span>
                        <span className="text-base font-bold text-slate-800 block mt-0.5">
                          {renderSelectedSourceName()}
                        </span>
                      </div>

                      {tanker.default_source_id ? (
                        <div className="pt-2">
                          <Link
                            href={`/sources/${tanker.default_source_id}`}
                            className="inline-flex items-center gap-1.5 text-xs text-primary font-bold hover:underline bg-primary-light px-3.5 py-2 rounded-xl transition-all"
                          >
                            <span>Verify Water Grade</span>
                            <ExternalLink size={12} />
                          </Link>
                        </div>
                      ) : (
                        <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                          Please associate a default water source to begin tracing water provenance.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
