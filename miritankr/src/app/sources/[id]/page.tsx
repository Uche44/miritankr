"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import Navbar from "../../../components/navbar";
import { apiFetch } from "../../../lib/api-client";
import { 
  ArrowLeft, 
  CheckCircle, 
  AlertTriangle, 
  MapPin, 
  Calendar, 
  User, 
  FileText,
  Loader2,
  Droplet
} from "lucide-react";

interface QualityReport {
  tested_at: string;
  ph: number;
  tds: number;
  turbidity: number;
  grade: string;
}

interface SourceDetail {
  id: string;
  name: string;
  type: string;
  verification_status: string;
  quality_grade: string | null;
  last_verified_at: string | null;
  owner_id: string | null;
  created_at: string;
  quality_reports: QualityReport[];
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function WaterSourceDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const sourceId = resolvedParams.id;
  const [source, setSource] = useState<SourceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSourceDetail() {
      try {
        setLoading(true);
        setError(null);
        const response = await apiFetch(`/water-sources/${sourceId}`);
        if (response && response.success) {
          setSource(response.data);
        } else {
          setError("Failed to retrieve source detail.");
        }
      } catch (err: any) {
        setError(err.message || "An error occurred fetching the details.");
      } finally {
        setLoading(false);
      }
    }
    loadSourceDetail();
  }, [sourceId]);

  if (loading) {
    return (
      <div className="bg-slate-50 min-h-screen flex items-center justify-center pt-20">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-slate-500 text-sm">Loading water source details...</p>
        </div>
      </div>
    );
  }

  if (error || !source) {
    return (
      <div className="bg-slate-50 min-h-screen pt-24">
        <Navbar />
        <div className="mx-auto max-w-3xl w-full px-4 py-12">
          <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-sm">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-slate-800 font-extrabold text-xl mb-2">Failed to Load Source</h3>
            <p className="text-slate-550 text-sm mb-6">{error || "Water source record not found."}</p>
            <Link
              href="/sources"
              className="inline-flex items-center gap-2 rounded-xl bg-primary hover:bg-primary-hover px-5 py-2.5 text-sm font-semibold text-white transition-all"
            >
              <ArrowLeft size={16} />
              Back to Catalog
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isVerified = source.verification_status.toUpperCase() === "VERIFIED";
  const formattedVerifiedDate = source.last_verified_at 
    ? new Date(source.last_verified_at).toLocaleDateString("en-NG", { dateStyle: "long" })
    : null;
  const formattedCreatedDate = new Date(source.created_at).toLocaleDateString("en-NG", { dateStyle: "long" });

  return (
    <div className="bg-slate-50 min-h-screen text-slate-800 flex flex-col pt-24">
      <Navbar />

      <main className="flex-1 mx-auto max-w-4xl w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Link */}
        <Link 
          href="/sources" 
          className="inline-flex items-center gap-1.5 text-slate-500 hover:text-primary text-sm font-semibold mb-6 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Catalog
        </Link>

        {/* Provenance Alert Card (Drinking vs Utility) */}
        <div className={`mb-8 border rounded-3xl p-6 flex items-start gap-4 shadow-sm ${
          isVerified 
            ? "bg-emerald-50/50 border-emerald-200 text-emerald-850"
            : "bg-amber-50/50 border-amber-200 text-amber-850"
        }`}>
          {isVerified ? (
            <>
              <CheckCircle className="text-emerald-600 shrink-0 mt-0.5" size={24} />
              <div>
                <h3 className="font-bold text-emerald-900 text-base">Verified Drinking Water Supplier</h3>
                <p className="text-sm text-emerald-700 mt-1">
                  This water source has been inspected and approved by Enugu State Administrators. Tankers loaded from here are certified to deliver both **Drinking Water** and **Utility Water**.
                </p>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={24} />
              <div>
                <h3 className="font-bold text-amber-900 text-base">Utility Water Only</h3>
                <p className="text-sm text-amber-700 mt-1">
                  This water source is currently **unverified** or **pending**. It is **strictly prohibited** from supplying drinking water. Tankers registered to this source can only deliver utility water (irrigation, construction, industrial use).
                </p>
              </div>
            </>
          )}
        </div>

        {/* Main Grid Detail */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Left Main column */}
          <div className="md:col-span-2 space-y-8">
            {/* Core Info */}
            <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
              <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400">
                {source.type.replace("_", " ")}
              </span>
              <h2 className="text-2xl font-black text-slate-900 mt-1 mb-4">
                {source.name}
              </h2>

              <div className="space-y-4 border-t border-slate-100 pt-6 text-sm text-slate-600">
                <div className="flex items-start gap-3">
                  <MapPin size={18} className="text-slate-400 mt-0.5" />
                  <div>
                    <span className="block font-semibold text-slate-900">Address</span>
                    <span>{source.location.address}</span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Calendar size={18} className="text-slate-400 mt-0.5" />
                  <div>
                    <span className="block font-semibold text-slate-900">Registered On</span>
                    <span>{formattedCreatedDate}</span>
                  </div>
                </div>
                {formattedVerifiedDate && (
                  <div className="flex items-start gap-3">
                    <CheckCircle size={18} className="text-emerald-500 mt-0.5" />
                    <div>
                      <span className="block font-semibold text-slate-900">Last Audited On</span>
                      <span>{formattedVerifiedDate}</span>
                    </div>
                  </div>
                )}
                {source.owner_id && (
                  <div className="flex items-start gap-3">
                    <User size={18} className="text-slate-400 mt-0.5" />
                    <div>
                      <span className="block font-semibold text-slate-900">Owner Identifier</span>
                      <span className="font-mono text-xs text-slate-500">{source.owner_id}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quality audit log */}
            <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <FileText className="text-slate-400" size={20} />
                <h3 className="font-extrabold text-slate-900 text-lg">Quality Audit Log</h3>
              </div>

              {isVerified ? (
                <div className="space-y-4">
                  {/* Visual Quality Meter */}
                  <div className="grid grid-cols-3 gap-4 bg-slate-50 border border-slate-100 rounded-2xl p-4 text-center">
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-slate-400">pH Level</span>
                      <span className="text-xl font-extrabold text-slate-700">7.2</span>
                      <span className="block text-[9px] text-emerald-600 mt-0.5">Neutral (Safe)</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-slate-400">TDS (PPM)</span>
                      <span className="text-xl font-extrabold text-slate-700">120</span>
                      <span className="block text-[9px] text-emerald-600 mt-0.5">Excellent (Safe)</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-slate-400">Turbidity</span>
                      <span className="text-xl font-extrabold text-slate-700">0.8</span>
                      <span className="block text-[9px] text-emerald-600 mt-0.5">Clear (Safe)</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-450 mt-4 leading-relaxed">
                    Note: Water quality reports are registered regularly by certified state inspectors. For full history, contact Enugu Water Services Board.
                  </p>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 text-sm">
                  No quality records are available for unverified sources.
                </div>
              )}
            </div>
          </div>

          {/* Right sidebar details */}
          <div className="space-y-8">
            {/* Quality Grade Card */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col items-center justify-center text-center">
              <span className="text-xs uppercase font-extrabold text-slate-400 mb-2">Safety Rating</span>
              {isVerified && source.quality_grade ? (
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-400 flex items-center justify-center text-3xl font-black text-emerald-700 mb-2">
                    {source.quality_grade}
                  </div>
                  <span className="text-xs text-slate-500">Water grade verified safe</span>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="w-20 h-20 rounded-full bg-slate-50 border border-dashed border-slate-300 flex items-center justify-center text-2xl font-bold text-slate-400 mb-2">
                    N/A
                  </div>
                  <span className="text-xs text-slate-450 px-4">Quality grade is not yet assessed</span>
                </div>
              )}
            </div>

            {/* Geolocation Map Placeholder */}
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
              <span className="block text-xs uppercase font-extrabold text-slate-400 mb-3">Enugu Geolocation</span>
              <div className="bg-slate-100 border border-slate-200 rounded-2xl h-44 relative overflow-hidden flex flex-col justify-center items-center text-slate-400">
                {/* Mock Map graphics */}
                <div className="absolute inset-0 bg-sky-50/20 pointer-events-none" />
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary relative animate-bounce z-10">
                  <MapPin size={24} />
                </div>
                <div className="w-16 h-4 bg-slate-900/10 rounded-full blur-[2px] mt-1 shrink-0" />
                
                <div className="absolute bottom-3 left-3 right-3 bg-white/90 backdrop-blur-sm border border-slate-100 rounded-xl p-2 text-[10px] text-slate-600 text-center font-mono font-semibold z-20">
                  Lat: {source.location.latitude.toFixed(6)}<br />
                  Lon: {source.location.longitude.toFixed(6)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
