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
  FileText,
  User as UserIcon,
  ShoppingBag,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Calendar,
  Compass,
  ArrowRight,
  TrendingUp,
  Map,
  Truck,
  Activity,
  Phone,
  ChevronRight
} from "lucide-react";

// Form validation schema
const placeOrderSchema = z.object({
  driver_id: z.string().uuid("Please select a driver"),
  water_type: z.enum(["DRINKING", "UTILITY"]),
  quantity_litres: z.number().min(500, "Minimum quantity is 500 Litres").max(50000, "Maximum quantity is 50,000 Litres"),
  delivery_address: z.string().min(5, "Delivery address must be at least 5 characters"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  scheduled_at: z.string().optional(),
});

type PlaceOrderFormValues = z.infer<typeof placeOrderSchema>;

interface DriverUserDetail {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
}

interface DriverTankerDetail {
  id: string;
  plate_number: string;
  capacity_litres: number;
  is_eligible_for_drinking: boolean;
  status: string;
  default_source_id: string | null;
}

interface ActiveDriver {
  id: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  user: DriverUserDetail;
  tanker: DriverTankerDetail | null;
}

interface WaterSource {
  id: string;
  name: string;
  type: string;
  verification_status: string;
  quality_grade: string | null;
  address: string;
}

interface Order {
  id: string;
  customer_id: string;
  water_type: "DRINKING" | "UTILITY";
  quantity_litres: number;
  delivery_address: string;
  status: "PENDING" | "ACCEPTED" | "GOING_TO_SOURCE" | "LOADING_WATER" | "EN_ROUTE" | "ARRIVED" | "DELIVERED" | "CANCELLED";
  price: number;
  assigned_driver_id: string | null;
  assigned_tanker_id: string | null;
  source_id: string | null;
  created_at: string;
  scheduled_at: string | null;
}

interface TrackingEvent {
  id: string;
  event_type: string;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
  event_metadata: any;
}

interface TrackingSnapshot {
  order_id: string;
  order_status: string;
  driver_location: {
    latitude: number | null;
    longitude: number | null;
    last_updated_at: string | null;
  };
  source_location: {
    id: string | null;
    name: string | null;
    address: string | null;
    verification_status: string | null;
    quality_grade: string | null;
  };
  timeline: TrackingEvent[];
}

export default function CustomerDashboardPage() {
  const { user } = useAuthSession();
  const [activeTab, setActiveTab] = useState("overview");

  // States
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<ActiveDriver[]>([]);
  const [sources, setSources] = useState<WaterSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Selected Order Tracking state
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [trackingData, setTrackingData] = useState<TrackingSnapshot | null>(null);
  const [loadingTracking, setLoadingTracking] = useState(false);

  // Form hooks
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors: formErrors }
  } = useForm<PlaceOrderFormValues>({
    resolver: zodResolver(placeOrderSchema),
    defaultValues: {
      driver_id: "",
      water_type: "UTILITY",
      quantity_litres: 2000,
      delivery_address: "",
      latitude: 6.44,
      longitude: 7.50,
      scheduled_at: "",
    }
  });

  // Watch fields for dynamic pricing and driver checking
  const watchedDriverId = watch("driver_id");
  const watchedWaterType = watch("water_type");
  const watchedQuantity = watch("quantity_litres");

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch customer's orders
      const ordersRes = await apiFetch("/orders");
      if (ordersRes?.success) {
        setOrders(ordersRes.data);
      }

      // 2. Fetch available active drivers
      const driversRes = await apiFetch("/drivers/active");
      if (driversRes?.success) {
        setDrivers(driversRes.data);
      }

      // 3. Fetch water sources catalog for resolution
      const sourcesRes = await apiFetch("/water-sources");
      if (sourcesRes?.success) {
        setSources(sourcesRes.data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handlePlaceOrder = async (data: PlaceOrderFormValues) => {
    setSubmittingOrder(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        driver_id: data.driver_id,
        water_type: data.water_type,
        quantity_litres: data.quantity_litres,
        delivery_address: data.delivery_address,
        latitude: data.latitude,
        longitude: data.longitude,
        scheduled_at: data.scheduled_at ? new Date(data.scheduled_at).toISOString() : null,
      };

      const res = await apiFetch("/orders", {
        method: "POST",
        json: payload
      });

      if (res?.success) {
        setSuccess("Order placed successfully! Awaiting driver acceptance.");
        reset();
        setActiveTab("overview");
        loadDashboardData();
      }
    } catch (err: any) {
      setError(err.message || "Failed to place order.");
    } finally {
      setSubmittingOrder(false);
    }
  };

  const handleTrackOrder = async (order: Order) => {
    setSelectedOrder(order);
    setLoadingTracking(true);
    setTrackingData(null);
    try {
      const trkRes = await apiFetch(`/orders/${order.id}/tracking`);
      if (trkRes?.success) {
        setTrackingData(trkRes.data);
      }
    } catch (err: any) {
      console.error("Failed to load tracking data:", err);
    } finally {
      setLoadingTracking(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm("Are you sure you want to cancel this order?")) return;
    setError(null);
    setSuccess(null);
    try {
      const res = await apiFetch(`/orders/${orderId}/status`, {
        method: "PATCH",
        json: { status: "CANCELLED" }
      });
      if (res?.success) {
        setSuccess("Order cancelled successfully.");
        // Refresh orders list
        setOrders(prev => prev.map(o => o.id === orderId ? res.data : o));
        if (selectedOrder?.id === orderId) {
          setSelectedOrder(res.data);
          handleTrackOrder(res.data);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to cancel order.");
    }
  };

  // Resolving selected driver default source
  const selectedDriver = drivers.find(d => d.id === watchedDriverId);
  const selectedDriverSource = selectedDriver?.tanker?.default_source_id
    ? sources.find(s => s.id === selectedDriver.tanker?.default_source_id)
    : null;

  const isDrinkingAllowed = selectedDriverSource?.verification_status === "VERIFIED" && selectedDriver?.tanker?.is_eligible_for_drinking;

  // Auto-switch water type if selected driver is utility only
  useEffect(() => {
    if (watchedDriverId && !isDrinkingAllowed && watchedWaterType === "DRINKING") {
      setValue("water_type", "UTILITY");
    }
  }, [watchedDriverId, isDrinkingAllowed]);

  // Pricing calculations
  const baseRate = watchedWaterType === "DRINKING" ? 2.5 : 1.5;
  const computedPrice = watchedQuantity * baseRate;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DELIVERED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={10} />
            DELIVERED
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
            PENDING ACCEPTANCE
          </span>
        );
      case "ACCEPTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200">
            ACCEPTED
          </span>
        );
      case "CANCELLED":
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle size={10} />
            {status}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-sky-50 text-sky-700 border border-sky-200">
            <Activity size={10} className="animate-spin" />
            {status.replace("_", " ")}
          </span>
        );
    }
  };

  const tabs = [
    { label: "Overview", icon: <Layers size={16} />, value: "overview" },
    { label: "Order Water", icon: <ShoppingBag size={16} />, value: "order" },
    { label: "Order History", icon: <FileText size={16} />, value: "history" },
    { label: "My Profile", icon: <UserIcon size={16} />, value: "profile" }
  ];

  return (
    <DashboardLayout
      role="CUSTOMER"
      title="Customer Portal"
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      tabs={tabs}
    >
      {/* Toast Feedbacks */}
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
          <p className="text-sm font-semibold text-slate-500">Loading details...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-8 animate-fade-in">
              {/* Stats Card Rows */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="block text-xs font-bold text-gray-650 tracking-wider uppercase">Active Orders</span>
                    <span className="text-3xl font-black text-slate-900 block mt-1">
                      {orders.filter(o => !["DELIVERED", "CANCELLED", "REJECTED"].includes(o.status)).length}
                    </span>
                  </div>
                  <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Activity size={24} />
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="block text-xs font-bold text-gray-650 tracking-wider uppercase">Completed Orders</span>
                    <span className="text-3xl font-black text-slate-900 block mt-1">
                      {orders.filter(o => o.status === "DELIVERED").length}
                    </span>
                  </div>
                  <div className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 size={24} />
                  </div>
                </div>
              </div>

              {/* Active Orders List */}
              <div className="space-y-4">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Activity size={18} className="text-primary animate-pulse" />
                  Active Deliveries
                </h3>

                {orders.filter(o => !["DELIVERED", "CANCELLED", "REJECTED"].includes(o.status)).length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-450 shadow-sm">
                    <ShoppingBag size={36} className="mx-auto text-slate-300 mb-3" />
                    <p className="text-sm font-semibold">No active deliveries currently.</p>
                    <button
                      onClick={() => setActiveTab("order")}
                      className="mt-4 px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 hover:scale-[1.01]"
                    >
                      Place New Order
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {orders.filter(o => !["DELIVERED", "CANCELLED", "REJECTED"].includes(o.status)).map((order) => {
                      const driverObj = drivers.find(d => d.id === order.assigned_driver_id);
                      return (
                        <div key={order.id} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Order Reference ID</span>
                              <h4 className="font-extrabold text-slate-800 text-sm truncate max-w-[180px]">{order.id}</h4>
                            </div>
                            {getStatusBadge(order.status)}
                          </div>

                          <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
                            <div className="flex justify-between">
                              <span>Water Type:</span>
                              <span className="font-extrabold text-slate-800">{order.water_type}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Quantity:</span>
                              <span className="font-extrabold text-slate-800">{order.quantity_litres.toLocaleString()} L</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Delivery Address:</span>
                              <span className="font-semibold text-slate-850 truncate max-w-[200px]">{order.delivery_address}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Locked Quote:</span>
                              <span className="font-black text-primary">₦ {order.price.toLocaleString()}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                            <button
                              onClick={() => {
                                handleTrackOrder(order);
                                setActiveTab("history");
                              }}
                              className="flex-1 py-2 bg-primary-light hover:bg-[#2f43ff]/10 text-primary text-xs font-black rounded-xl transition-all"
                            >
                              Track & Audit Live
                            </button>
                            {order.status === "PENDING" && (
                              <button
                                onClick={() => handleCancelOrder(order.id)}
                                className="py-2 px-3 border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs font-bold rounded-xl transition-all"
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PLACE ORDER */}
          {activeTab === "order" && (
            <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-2xl mx-auto shadow-md">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <div className="h-10 w-10 rounded-xl bg-primary-light flex items-center justify-center text-primary">
                  <ShoppingBag size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Place Water Order</h3>
                  <p className="text-xs text-gray-650">Select a verified driver and lock your delivery pricing</p>
                </div>
              </div>

              {drivers.length === 0 ? (
                <div className="bg-slate-50 border border-slate-150 p-8 rounded-3xl text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                  <Info size={24} className="text-slate-350" />
                  <p className="font-semibold">No water tanker drivers are currently online in Enugu State.</p>
                  <p className="text-[10px]">Please check back later or contact support.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit(handlePlaceOrder)} className="space-y-6">
                  {/* Select Driver */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Available Tanker Driver</label>
                    <select
                      {...register("driver_id")}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary font-medium"
                    >
                      <option value="">-- Choose Online Driver --</option>
                      {drivers.map((drv) => {
                        const driverSource = drv.tanker?.default_source_id
                          ? sources.find(s => s.id === drv.tanker?.default_source_id)
                          : null;
                        return (
                          <option key={drv.id} value={drv.id}>
                            {drv.user.first_name} {drv.user.last_name} ({drv.tanker?.plate_number} - {drv.tanker?.capacity_litres.toLocaleString()}L) - Depot: {driverSource?.name || "Unverified"}
                          </option>
                        );
                      })}
                    </select>
                    {formErrors.driver_id && (
                      <p className="text-xs text-red-500 font-medium pl-1">{formErrors.driver_id.message}</p>
                    )}
                  </div>

                  {/* Driver Verification Status Info */}
                  {watchedDriverId && selectedDriver && (
                    <div className={`p-4 rounded-2xl border flex items-start gap-3 text-xs font-semibold ${
                      isDrinkingAllowed
                        ? "bg-emerald-50/50 border-emerald-100 text-emerald-950"
                        : "bg-amber-50/50 border-amber-100 text-amber-950"
                    }`}>
                      {isDrinkingAllowed ? (
                        <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-1">
                        <p className="font-extrabold text-slate-800">
                          {isDrinkingAllowed 
                            ? "Verified Drinking Water Supplier" 
                            : "Utility Supply Only (Default depot is not verified)"}
                        </p>
                        <p className="text-[11px] text-slate-500 font-normal">
                          {isDrinkingAllowed
                            ? `This driver normally sources from "${selectedDriverSource?.name}" (Grade ${selectedDriverSource?.quality_grade || "N/A"}), which is VERIFIED. Potable orders allowed.`
                            : `This driver sources from "${selectedDriverSource?.name || "Unverified Source"}" which is UNVERIFIED. Drinking-grade orders are suspended for this vehicle.`}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Water Type Radio Group */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Water Specification Type</label>
                    <div className="grid grid-cols-2 gap-4">
                      {/* DRINKING option */}
                      <label className={`border rounded-2xl p-4 flex items-start gap-3 cursor-pointer transition-all ${
                        !isDrinkingAllowed
                          ? "bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed"
                          : watchedWaterType === "DRINKING"
                          ? "border-[#2f43ff] bg-[#2f43ff]/5 ring-1 ring-[#2f43ff]"
                          : "border-slate-250 hover:bg-slate-50"
                      }`}>
                        <input
                          type="radio"
                          value="DRINKING"
                          disabled={!isDrinkingAllowed}
                          {...register("water_type")}
                          className="mt-1 accent-primary text-primary"
                        />
                        <div>
                          <span className="block font-extrabold text-sm text-slate-800">DRINKING WATER</span>
                          <span className="block text-[10px] text-slate-400 mt-0.5">Verified Depot Sourced (2.5 ₦/L)</span>
                        </div>
                      </label>

                      {/* UTILITY option */}
                      <label className={`border rounded-2xl p-4 flex items-start gap-3 cursor-pointer transition-all ${
                        watchedWaterType === "UTILITY"
                          ? "border-[#2f43ff] bg-[#2f43ff]/5 ring-1 ring-[#2f43ff]"
                          : "border-slate-250 hover:bg-slate-50"
                      }`}>
                        <input
                          type="radio"
                          value="UTILITY"
                          {...register("water_type")}
                          className="mt-1 accent-primary text-primary"
                        />
                        <div>
                          <span className="block font-extrabold text-sm text-slate-800">UTILITY WATER</span>
                          <span className="block text-[10px] text-slate-400 mt-0.5">Construction / Gardens (1.5 ₦/L)</span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Volume in Litres */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Volume (Litres)</label>
                      <input
                        type="number"
                        placeholder="e.g. 2000"
                        {...register("quantity_litres", { valueAsNumber: true })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary font-semibold"
                      />
                      {formErrors.quantity_litres && (
                        <p className="text-xs text-red-500 font-medium pl-1">{formErrors.quantity_litres.message}</p>
                      )}
                    </div>

                    {/* Schedule parameter */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Schedule Delivery Date/Time</label>
                      <input
                        type="datetime-local"
                        {...register("scheduled_at")}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary font-semibold"
                      />
                      <p className="text-[9px] text-slate-400 pl-1">Leave empty for immediate dispatch delivery.</p>
                    </div>
                  </div>

                  {/* Delivery Address */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Delivery Address</label>
                    <input
                      type="text"
                      placeholder="e.g. 40 Ogui Road, Enugu State"
                      {...register("delivery_address")}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary font-semibold"
                    />
                    {formErrors.delivery_address && (
                      <p className="text-xs text-red-500 font-medium pl-1">{formErrors.delivery_address.message}</p>
                    )}
                  </div>

                  {/* Enugu Coordinate inputs */}
                  <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-2xl border border-slate-150">
                    <div className="col-span-2 text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Compass size={14} className="text-primary" />
                      Enugu Coordinate mapping (For Dispatch Route)
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Latitude</label>
                      <input
                        type="number"
                        step="0.000001"
                        {...register("latitude", { valueAsNumber: true })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Longitude</label>
                      <input
                        type="number"
                        step="0.000001"
                        {...register("longitude", { valueAsNumber: true })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Locked Quote Summary Card */}
                  <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-md flex items-center justify-between">
                    <div>
                      <span className="block text-[10px] text-slate-400 uppercase tracking-widest font-extrabold">Total Locked Quote Price</span>
                      <span className="text-2xl font-black block mt-1 text-emerald-400">₦ {computedPrice.toLocaleString()}</span>
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] text-slate-450 uppercase font-semibold">Water Cost</span>
                      <span className="text-xs font-bold text-white block mt-0.5">{watchedQuantity.toLocaleString()}L @ {baseRate} ₦/L</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submittingOrder}
                    className="w-full py-4 bg-[#2f43ff] hover:bg-blue-600 text-white font-black text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    {submittingOrder ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <span>Place Water Order</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* TAB 3: ORDER HISTORY & AUDIT TIMELINE */}
          {activeTab === "history" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start animate-fade-in">
              {/* Left 2 Columns: Past Orders List */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-black uppercase text-gray-650 tracking-wider">
                          <th className="px-6 py-4">Order Reference</th>
                          <th className="px-6 py-4">Water Type</th>
                          <th className="px-6 py-4">Volume</th>
                          <th className="px-6 py-4">Price</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                        {orders.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                              <ShoppingBag size={32} className="mx-auto text-slate-350 mb-2" />
                              <span>You have not placed any orders yet.</span>
                            </td>
                          </tr>
                        ) : (
                          orders.map((o) => (
                            <tr
                              key={o.id}
                              className={`hover:bg-slate-50/50 transition-colors cursor-pointer ${
                                selectedOrder?.id === o.id ? "bg-slate-50" : ""
                              }`}
                              onClick={() => handleTrackOrder(o)}
                            >
                              <td className="px-6 py-4 font-bold text-slate-800 truncate max-w-[120px]">{o.id}</td>
                              <td className="px-6 py-4 font-bold text-slate-700">{o.water_type}</td>
                              <td className="px-6 py-4 text-slate-500">{o.quantity_litres.toLocaleString()} L</td>
                              <td className="px-6 py-4 text-primary">₦ {o.price.toLocaleString()}</td>
                              <td className="px-6 py-4">{getStatusBadge(o.status)}</td>
                              <td className="px-6 py-4 text-right">
                                <ChevronRight size={16} className="text-slate-400 ml-auto" />
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Right 1 Column: Provenance Traceability & Tracking Detail */}
              <div className="lg:col-span-1">
                {selectedOrder ? (
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-md space-y-6 animate-fade-in">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-slate-400 block tracking-widest">Active Audit Tracking</span>
                      <h3 className="text-base font-black text-slate-900 mt-1 truncate max-w-[200px]">{selectedOrder.id}</h3>
                      <div className="mt-2 flex items-center justify-between">
                        {getStatusBadge(selectedOrder.status)}
                        <span className="text-xs font-black text-primary">₦ {selectedOrder.price.toLocaleString()}</span>
                      </div>
                    </div>

                    {loadingTracking ? (
                      <div className="flex flex-col items-center justify-center py-12 gap-2 border-t border-slate-100">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                        <span className="text-xs font-semibold text-slate-450">Loading provenance layers...</span>
                      </div>
                    ) : trackingData ? (
                      <div className="space-y-6 border-t border-slate-100 pt-5">
                        
                        {/* 1. Source Provenance Details */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                            <Droplet size={14} className="text-primary" />
                            Water Source Provenance
                          </h4>
                          <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl space-y-2">
                            <div>
                              <span className="block text-[9px] font-bold text-slate-400 uppercase leading-none">Depot Depot</span>
                              <span className="text-sm font-bold text-slate-800 block mt-1">
                                {trackingData.source_location.name || "Unknown Source Depot"}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <div>
                                <span className="block text-[8px] font-bold text-slate-400 uppercase">Verification</span>
                                <span className="text-xs font-black text-emerald-600 uppercase tracking-wide">
                                  {trackingData.source_location.verification_status || "PENDING"}
                                </span>
                              </div>
                              <div>
                                <span className="block text-[8px] font-bold text-slate-400 uppercase">Lab Grade</span>
                                <span className="text-xs font-black text-slate-800 uppercase">
                                  {trackingData.source_location.quality_grade || "Pending"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 2. Timeline Logistics */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                            <MapPin size={14} className="text-primary animate-pulse" />
                            Delivery Event Log
                          </h4>
                          <div className="relative pl-6 space-y-4 border-l border-slate-200 ml-2 py-1">
                            {trackingData.timeline.map((evt, idx) => (
                              <div key={evt.id} className="relative">
                                {/* Bullet indicator */}
                                <div className={`absolute -left-[30px] top-0.5 h-3.5 w-3.5 rounded-full border-2 bg-white flex items-center justify-center ${
                                  idx === 0 ? "border-primary bg-primary/10" : "border-slate-300"
                                }`}>
                                  <div className={`h-1.5 w-1.5 rounded-full ${
                                    idx === 0 ? "bg-primary animate-pulse" : "bg-slate-350"
                                  }`} />
                                </div>
                                <div>
                                  <span className="block text-xs font-extrabold text-slate-800">{evt.event_type.replace("_", " ")}</span>
                                  <span className="block text-[9px] text-slate-400 mt-0.5">
                                    {new Date(evt.created_at).toLocaleTimeString()}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl text-center text-xs text-slate-400">
                        Failed to retrieve logistics tracking metadata.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 text-center text-slate-400 shadow-sm">
                    <Info size={24} className="mx-auto text-slate-350 mb-2" />
                    <p className="text-xs font-semibold">Select an order from the history list to trace its water provenance lab ratings and logistics delivery log.</p>
                  </div>
                )}
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
