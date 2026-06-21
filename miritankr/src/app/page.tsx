"use client";

import React, { useState, useEffect } from "react";
import Navbar from "../components/navbar";
import Hero from "../components/homepage/hero";
import { apiFetch } from "../lib/api-client";
import { useAuthSession } from "../hooks/use-auth-session";
import { useRouter } from "next/navigation";
import {
  Droplets,
  Clock,
  ShieldCheck,
  MapPin,
  Star,
  ArrowRight,
  Phone,
  Mail,
  ChevronDown,
  Award,
  CheckCircle,
  Truck,
  Activity,
  DollarSign,
  AlertCircle,
  HelpCircle,
  FileText
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
  price_per_litre: number;
}

export default function Home() {
  const router = useRouter();
  const { isLoggedIn, user } = useAuthSession();

  const [sources, setSources] = useState<WaterSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSource, setSelectedSource] = useState<WaterSource | null>(null);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const fallbackSources: WaterSource[] = [
    {
      id: "9th-mile",
      name: "9th Mile Water Treatment Plant",
      type: "TREATMENT_PLANT",
      verification_status: "VERIFIED",
      quality_grade: "A",
      address: "9th Mile Corner, Ngwo, Enugu State",
      latitude: 6.4253,
      longitude: 7.4042,
      price_per_litre: 2.0,
    },
    {
      id: "artisan-market",
      name: "Artisan Market Borehole Depot",
      type: "BOREHOLE",
      verification_status: "VERIFIED",
      quality_grade: "B",
      address: "Ogui Road, Asata, Enugu State",
      latitude: 6.4428,
      longitude: 7.5186,
      price_per_litre: 1.8,
    },
    {
      id: "independence-layout",
      name: "Independence Layout Reservoir",
      type: "RESERVOIR",
      verification_status: "PENDING",
      quality_grade: null,
      address: "Independence Layout, Enugu State",
      latitude: 6.4281,
      longitude: 7.5024,
      price_per_litre: 2.2,
    }
  ];

  useEffect(() => {
    async function fetchSources() {
      try {
        setLoading(true);
        const res = await apiFetch("/water-sources");
        if (res && res.success && Array.isArray(res.data)) {
          setSources(res.data);
        } else {
          setSources(fallbackSources);
        }
      } catch (err: any) {
        console.error("Error fetching water sources, using fallbacks:", err);
        setSources(fallbackSources);
      } finally {
        setLoading(false);
      }
    }
    fetchSources();
  }, []);

  const handleOrderRedirect = (source: WaterSource) => {
    if (isLoggedIn) {
      // Redirect to customer dashboard
      router.push(`/dashboard/customer?source_id=${source.id}`);
    } else {
      // Redirect to register page
      router.push(`/register?role=CUSTOMER&source_id=${source.id}`);
    }
  };

  const getSourceTypeLabel = (type: string) => {
    switch (type) {
      case "TREATMENT_PLANT": return "Treatment Plant";
      case "BOREHOLE": return "Borehole Depot";
      case "RESERVOIR": return "Municipal Reservoir";
      case "GOVERNMENT_FACILITY": return "Government Facility";
      case "COMMERCIAL_VENDOR": return "Commercial Vendor";
      default: return type.replace("_", " ");
    }
  };

  const steps = [
    {
      icon: <MapPin className="text-primary" size={24} />,
      title: "Pin Your Location",
      desc: "Specify your residential, commercial, or industrial location in Enugu. Our platform calculates transit distance automatically."
    },
    {
      icon: <Droplets className="text-primary" size={24} />,
      title: "Select Water Type",
      desc: "Choose Drinking water (guaranteed from A-grade verified sources) or Utility water (for construction, pools, or sanitation)."
    },
    {
      icon: <Clock className="text-primary" size={24} />,
      title: "Trace & Payout",
      desc: "Monitor your assigned tanker filling at the source and track transit in real time. Pay securely via Paystack."
    }
  ];

  const faqs = [
    {
      q: "What is water provenance tracking?",
      a: "Water provenance tracking is our core trust feature. Rather than buying anonymous water, customers receive a verified ledger showing exactly which treatment plant or borehole their water was sourced from, the last quality test date, and the direct transit route of the tanker."
    },
    {
      q: "How does regulated pricing work?",
      a: "In Enugu, water prices are often arbitrary and inflated by brokers. MiriTankr enforces a transparent pricing model consisting of a regulated base rate per-litre set by the source, plus a fixed per-kilometer transit rate, preventing seasonal price gouging."
    },
    {
      q: "What is the difference between Drinking and Utility water?",
      a: "Drinking water is sourced strictly from verified, Class-A water treatment facilities or reservoirs undergoing regular audits. Utility water is suitable for construction, cleaning, and gardening, and can be sourced from boreholes or unverified depots at lower rates."
    },
    {
      q: "How are water sources verified?",
      a: "Water sources register on our platform and submit water quality reports (pH, TDS, and turbidity). Our inspection team verifies facilities on-site. Only approved sources can supply water for Drinking Water orders."
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-800 font-sans">
      <Navbar />

      <main className="flex-grow">
        {/* Hero Section */}
        <Hero />

        {/* Dynamic Water Sources Section */}
        <section id="suppliers" className="py-24 bg-white relative">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-20">
              <span className="text-xs font-bold text-primary tracking-widest uppercase bg-blue-50 px-3 py-1.5 rounded-full">
                Verification Ledger
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
                Verified Enugu Water Sources
              </h2>
              <p className="mt-4 text-lg text-slate-500">
                Browse municipal depots, reservoirs, and approved boreholes. Tap on any source to view quality compliance details and order directly.
              </p>
            </div>

            {loading ? (
              <div className="flex flex-col justify-center items-center py-20 space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                <p className="text-sm text-slate-500 font-medium">Fetching verified source catalog...</p>
              </div>
            ) : (
              <div className="grid gap-8 md:grid-cols-3">
                {sources.map((source) => (
                  <div
                    key={source.id}
                    className={`bg-slate-50 rounded-2xl shadow-sm border transition-all flex flex-col justify-between overflow-hidden relative cursor-pointer hover:shadow-xl hover:-translate-y-1 ${selectedSource?.id === source.id
                      ? "border-primary ring-2 ring-primary/20 shadow-md scale-[1.01]"
                      : "border-slate-150 hover:border-blue-200"
                      }`}
                    onClick={() => setSelectedSource(source)}
                  >
                    {/* Quality Grade Badge */}
                    <div className="absolute top-4 right-4 flex gap-2">
                      {source.quality_grade && (
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                          Grade {source.quality_grade}
                        </span>
                      )}
                      <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full ${source.verification_status === "VERIFIED"
                        ? "bg-blue-100 text-primary border border-blue-200"
                        : "bg-amber-100 text-amber-700 border border-amber-200"
                        }`}>
                        {source.verification_status}
                      </span>
                    </div>

                    <div className="p-6 flex-grow">
                      <div className="flex items-center gap-2 text-primary mb-3">
                        <Droplets size={20} className="stroke-[2.5]" />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          {getSourceTypeLabel(source.type)}
                        </span>
                      </div>

                      <h3 className="text-xl font-extrabold text-slate-900 pr-16 leading-snug">{source.name}</h3>

                      <p className="mt-3 text-xs text-slate-500 flex items-start gap-1.5 leading-relaxed">
                        <MapPin size={14} className="shrink-0 text-slate-400 mt-0.5" />
                        <span>{source.address}</span>
                      </p>

                      <div className="mt-6 space-y-2.5 border-t border-slate-200/60 pt-5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-medium">Verification Audit:</span>
                          <span className="font-semibold text-slate-800 flex items-center gap-1">
                            <ShieldCheck size={12} className="text-emerald-600" /> Active
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-medium">Compliance Grade:</span>
                          <span className="font-semibold text-slate-800">
                            {source.quality_grade ? `Class ${source.quality_grade} Purity` : "Pending Inspection"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-medium">Location Telemetry:</span>
                          <span className="font-mono text-[10px] text-slate-650 bg-slate-100 px-1.5 py-0.5 rounded">
                            {source.latitude.toFixed(4)}°, {source.longitude.toFixed(4)}°
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Pricing and Action */}
                    <div className="bg-slate-100/80 px-6 py-4 border-t border-slate-200/60 flex items-center justify-between mt-auto">
                      <div>
                        <span className="text-[9px] text-slate-450 uppercase tracking-wider block font-bold">Controlled Base Price</span>
                        <span className="text-lg font-black text-slate-900">₦{source.price_per_litre.toFixed(2)}<span className="text-xs font-normal text-slate-500">/L</span></span>
                      </div>
                      {/* <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOrderRedirect(source);
                        }}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#2f43ff] hover:bg-[#1b2eff] text-white transition-all shadow-md active:scale-95 cursor-pointer"
                      >
                        Order Water
                      </button> */}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quick Informational Drawer/Modal */}
            {selectedSource && (
              <div className="mt-12 max-w-2xl mx-auto bg-slate-900 text-white rounded-3xl p-8 shadow-2xl border border-slate-800 animate-fade-in">
                <div className="flex justify-between items-start border-b border-slate-800 pb-5 mb-6">
                  <div>
                    <span className="text-xs font-extrabold text-primary uppercase tracking-widest">Selected Depot</span>
                    <h3 className="font-black text-white text-2xl mt-1">{selectedSource.name}</h3>
                    <p className="text-xs text-slate-400 mt-1">{selectedSource.address}</p>
                  </div>
                  <button
                    onClick={() => setSelectedSource(null)}
                    className="text-xs font-bold text-slate-450 hover:text-white bg-slate-800 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 text-sm">
                  <div className="space-y-4">
                    <h4 className="font-bold text-slate-300 text-xs uppercase tracking-wider">Provenance Log</h4>
                    <div className="space-y-3">
                      <div className="flex gap-2.5 items-start text-xs">
                        <CheckCircle size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-slate-200">Registered Facility</p>
                          <p className="text-slate-400 text-[11px]">Approved water source under Enugu State registry</p>
                        </div>
                      </div>
                      <div className="flex gap-2.5 items-start text-xs">
                        <CheckCircle size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-slate-200">Rigorous Lab Audit</p>
                          <p className="text-slate-400 text-[11px]">Chemical and microbiological check compliance</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-slate-400 text-[10px] uppercase tracking-wider mb-2">Price Breakdown</h4>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Regulated base cost of <strong className="text-white">₦{selectedSource.price_per_litre} per litre</strong>.
                        Transit surcharge is calculated dynamically based on distance to your delivery coordinates.
                      </p>
                    </div>
                    <button
                      onClick={() => handleOrderRedirect(selectedSource)}
                      className="mt-4 w-full py-3 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-lg transition-all hover:scale-[1.02] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Proceed to Order Page</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 text-center">
                  All transaction orders are matched with verified tankers containing calibrated meters to guarantee delivery quantity.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-24 bg-slate-50 border-t border-b border-slate-100">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-20">
              <span className="text-xs font-bold text-primary tracking-widest uppercase bg-blue-50 px-3 py-1.5 rounded-full">
                Simple Flow
              </span>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
                Unified Dispatch Workflow
              </h2>
              <p className="mt-4 text-lg text-slate-500">
                Ordering water shouldn't be a gamble. We make the entire verification, dispatch, and tracking process seamless.
              </p>
            </div>

            <div className="grid gap-10 md:grid-cols-3">
              {steps.map((step, idx) => (
                <div key={idx} className="relative group bg-white p-8 rounded-3xl border border-slate-150/60 hover:border-blue-200 transition-all hover:shadow-lg hover:-translate-y-1">
                  <div className="absolute top-6 right-6 text-5xl font-black text-slate-100 group-hover:text-blue-50 transition-colors">
                    0{idx + 1}
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 shadow-sm border border-slate-100 mb-6">
                    {step.icon}
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-900 mb-3">{step.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* NEW SECTION: Water Provenance Tracking */}
        <section id="provenance" className="py-24 bg-white overflow-hidden">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
              <div className="lg:col-span-6 flex flex-col justify-center">
                <span className="text-xs font-bold text-primary tracking-widest uppercase bg-blue-50 px-3 py-1.5 rounded-full w-fit">
                  Trust Network
                </span>
                <h2 className="mt-4 text-3xl font-black text-slate-900 sm:text-4xl leading-tight">
                  Water Provenance: <br />Know Your Source, Trust Your Drop
                </h2>
                <p className="mt-6 text-slate-550 leading-relaxed text-sm md:text-base">
                  Every order placed on MiriTankr acts as a transparent, immutable transaction log of clean water.
                  Rather than hoping the water is clean, you can trace it directly back to licensed treatment plants
                  with active safety certifications.
                </p>

                <div className="mt-8 space-y-4">
                  <div className="flex gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 border border-blue-100 text-primary shrink-0">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm">Source Verification & Lab Grade</h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Sources are audited for pH level, Total Dissolved Solids (TDS), and clarity parameters.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 border border-blue-100 text-primary shrink-0">
                      <Activity size={20} />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-sm">Real-time Telemetry Tracking</h4>
                      <p className="text-xs text-slate-500 mt-1">
                        Track the tanker from the moment it registers load-in at the depot until it arrives at your property.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Graphical workflow display */}
              <div className="lg:col-span-6 bg-slate-50 border border-slate-150 p-8 rounded-3xl relative">
                <h3 className="font-black text-slate-900 text-lg mb-6">Traceability Pipeline</h3>

                <div className="space-y-6 relative before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-[2px] before:bg-blue-100">
                  <div className="flex gap-4 relative z-10">
                    <div className="h-9 w-9 rounded-full bg-primary border-4 border-white text-white flex items-center justify-center text-xs font-bold">1</div>
                    <div>
                      <span className="text-[10px] font-bold text-primary uppercase block">Depot Stage</span>
                      <h4 className="font-bold text-slate-800 text-xs">Verify Source & Pricing</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">Water sourced from audited treatment reservoirs or certified boreholes.</p>
                    </div>
                  </div>

                  <div className="flex gap-4 relative z-10">
                    <div className="h-9 w-9 rounded-full bg-primary border-4 border-white text-white flex items-center justify-center text-xs font-bold">2</div>
                    <div>
                      <span className="text-[10px] font-bold text-primary uppercase block">Filling Stage</span>
                      <h4 className="font-bold text-slate-800 text-xs">Calibrated Meters Log Load-in</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">Tanker volumetric load is registered and verified on-site.</p>
                    </div>
                  </div>

                  <div className="flex gap-4 relative z-10">
                    <div className="h-9 w-9 rounded-full bg-primary border-4 border-white text-white flex items-center justify-center text-xs font-bold">3</div>
                    <div>
                      <span className="text-[10px] font-bold text-[#2f43ff] uppercase block">Transit Stage</span>
                      <h4 className="font-bold text-slate-800 text-xs">Active Route Telemetry</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">GPS location checks ensure no illegal siphoning or unapproved water replacement.</p>
                    </div>
                  </div>

                  <div className="flex gap-4 relative z-10">
                    <div className="h-9 w-9 rounded-full bg-emerald-500 border-4 border-white text-white flex items-center justify-center text-xs font-bold">✓</div>
                    <div>
                      <span className="text-[10px] font-bold text-emerald-600 uppercase block">Delivery Stage</span>
                      <h4 className="font-bold text-slate-850 text-xs">Secure Verification Pin</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">Customer validates tanker delivery volume, unlocking digital payment verification.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* NEW SECTION: Regulated Pricing */}
        <section id="regulated-pricing" className="py-24 bg-primary text-white overflow-hidden relative">
          <div className="absolute top-1/2 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
              <div className="lg:col-span-6 bg-slate-950 border border-slate-800 p-8 rounded-3xl order-last lg:order-first">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-10 w-10 bg-primary/20 text-primary rounded-xl flex items-center justify-center">
                    <DollarSign size={20} />
                  </div>
                  <h3 className="font-extrabold text-white text-lg">Regulated Price Breakdown</h3>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between border-b border-slate-800 pb-3 text-xs">
                    <span className="text-slate-400">Drinking Water Base Rate:</span>
                    <span className="font-mono text-white font-bold">₦2.00 / Litre</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-3 text-xs">
                    <span className="text-slate-400">Utility Water Base Rate:</span>
                    <span className="font-mono text-white font-bold">₦1.50 / Litre</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-800 pb-3 text-xs">
                    <span className="text-slate-400">Transit Rate (per km):</span>
                    <span className="font-mono text-white font-bold">₦150.00 / km</span>
                  </div>
                  <div className="flex justify-between pb-3 text-xs text-emerald-400 font-bold">
                    <span>Payment Gateway Integration:</span>
                    <span>Paystack Secure Checkout</span>
                  </div>
                </div>

                <div className="mt-8 bg-slate-900 p-4 rounded-xl text-[11px] text-slate-450 border border-slate-800">
                  <p className="leading-relaxed">
                    *Rates are regulated by system-wide smart matching algorithms to ensure tanker operators earn a decent margin while avoiding price gouging.
                  </p>
                </div>
              </div>

              <div className="lg:col-span-6 flex flex-col justify-center">
                <span className="text-xs font-bold text-primary tracking-widest uppercase bg-primary/10 px-3 py-1.5 rounded-full w-fit">
                  Fair Markets
                </span>
                <h2 className="mt-4 text-3xl font-black text-white sm:text-4xl leading-tight">
                  No More Informal Cartels. <br />Transparent, Fixed Pricing.
                </h2>
                <p className="mt-6 text-slate-300 leading-relaxed text-sm md:text-base">
                  Water prices in Enugu spike arbitrarily based on weather conditions, vehicle availability, and broker markups.
                  MiriTankr sets controlled per-litre base pricing directly from verified source depots, combined with automated distance calculations.
                </p>

                <ul className="mt-8 space-y-3.5 text-xs md:text-sm text-slate-350">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="text-white shrink-0" size={16} />
                    <span>Eliminate cash negotiation stress at delivery time</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="text-white shrink-0" size={16} />
                    <span>Clear invoice breakdowns separating water and transit costs</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="text-white shrink-0" size={16} />
                    <span>Instant refunds for cancelled dispatches or delivery failures</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="about" className="py-24 bg-white border-t border-slate-100">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
              {/* Left Column: Brief Brand Intro */}
              <div className="lg:col-span-5 flex flex-col justify-center">
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 border border-blue-100 px-3 py-1.5 text-xs font-semibold text-primary mb-6 w-fit">
                  <Award size={14} />
                  Enugu's Trusted Water Portal
                </div>
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl">
                  Transforming Water Infrastructure
                </h2>
                <p className="mt-4 text-slate-500 leading-relaxed text-sm">
                  MiriTankr was born out of a critical need: to provide quick, transparent, and dependable clean water delivery to homes and businesses across Enugu State.
                  We integrate safety, verification, and automated dispatch into a single logistics platform.
                </p>
                <div className="mt-8 space-y-4">
                  <div className="flex gap-3">
                    <CheckCircle className="text-primary shrink-0" size={20} />
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Sovereign Source Verification</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Water is only filled at active, certified depots.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle className="text-primary shrink-0" size={20} />
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm"> Calibrated Volumetric Audits</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Verification metrics guarantee you receive the exact amount purchased.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Interactive Accordion FAQs */}
              <div className="lg:col-span-7 flex flex-col justify-center">
                <h3 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <HelpCircle size={22} className="text-primary" />
                  <span>Frequently Asked Questions</span>
                </h3>
                <div className="space-y-4">
                  {faqs.map((faq, idx) => (
                    <div
                      key={idx}
                      className="border border-slate-150 rounded-2xl overflow-hidden bg-slate-50/50 hover:bg-slate-50 transition-colors"
                    >
                      <button
                        onClick={() => setActiveFaq(activeFaq === idx ? null : idx)}
                        className="w-full px-6 py-4 text-left flex justify-between items-center font-bold text-slate-800 text-sm focus:outline-none"
                      >
                        <span>{faq.q}</span>
                        <ChevronDown
                          size={18}
                          className={`text-slate-400 transition-transform duration-250 ${activeFaq === idx ? "rotate-180 text-primary" : ""}`}
                        />
                      </button>
                      <div
                        className={`transition-all duration-300 overflow-hidden ${activeFaq === idx ? "max-h-40 border-t border-slate-100 bg-white" : "max-h-0"
                          }`}
                      >
                        <p className="p-6 text-xs text-slate-550 leading-relaxed">
                          {faq.a}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer - Slate-900 (Non-black) Theme */}
      <footer className="bg-primary text-white py-16 border-t border-slate-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-4 pb-12 border-b border-slate-800">
            {/* Column 1: Brand */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2f43ff] font-bold text-white text-sm">
                  M
                </div>
                <span className="text-lg font-bold text-white">MiriTankr</span>
              </div>
              <p className="text-xs leading-relaxed max-w-xs text-gray-100">
                Enugu's trusted online logistics portal for verified, on-demand clean water delivery. Securing safety in every drop.
              </p>
            </div>

            {/* Column 2: Quick Links */}
            <div>
              <h4 className="text-white font-bold text-sm mb-4">Service Locations</h4>
              <ul className="space-y-2 text-xs">
                <li>9th Mile, Ngwo</li>
                <li>Artisan Market, Ogui</li>
                <li>Independence Layout</li>
                <li>Achara Layout & Asata</li>
              </ul>
            </div>

            {/* Column 3: Contact */}
            <div>
              <h4 className="text-white font-bold text-sm mb-4">Support</h4>
              <ul className="space-y-2 text-xs">
                <li className="flex items-center gap-2"><Phone size={12} /> +234 42 123 4567</li>
                <li className="flex items-center gap-2"><Mail size={12} /> support@miritankr.com</li>
              </ul>
            </div>

            {/* Column 4: Newsletter/Promo */}
            <div>
              <h4 className="text-white font-bold text-sm mb-4">Stay Notified</h4>
              <p className="text-xs mb-3 text-white">Subscribe to get local water updates & provenance announcements.</p>
              <div className="flex gap-2">
                <input type="email" placeholder="Email Address" className="bg-gray-100 text-white placeholder-gray-600 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary w-full" />
                <button className="bg-primary hover:bg-primary-hover text-white px-3.5 py-2 rounded-lg text-xs font-semibold shrink-0 cursor-pointer">Join</button>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center pt-8 text-[11px] text-slate-450">
            <p>&copy; {new Date().getFullYear()} MiriTankr. All rights reserved. Operating in Enugu State, Nigeria.</p>
            <div className="flex gap-4 mt-4 sm:mt-0">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
