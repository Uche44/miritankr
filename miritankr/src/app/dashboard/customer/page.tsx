"use client";

import React, { useState, useEffect } from "react";
import Script from "next/script";
import DashboardLayout from "../../../components/dashboard/dashboard-layout";
import { apiFetch } from "../../../lib/api-client";
import { useAuthSession } from "../../../hooks/use-auth-session";
import { useAuthStore } from "../../../stores/auth-store";
import { useForm } from "react-hook-form";
import MapComponent from "../../../components/map/map-component";
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
  ChevronRight,
  LocateFixed,
  Loader2
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
  latitude: number;
  longitude: number;
  status: "PENDING" | "ACCEPTED" | "GOING_TO_SOURCE" | "LOADING_WATER" | "EN_ROUTE" | "ARRIVED" | "DELIVERED" | "CANCELLED" | "REJECTED";
  price: number;
  assigned_driver_id: string | null;
  assigned_tanker_id: string | null;
  source_id: string | null;
  created_at: string;
  scheduled_at: string | null;
  payment_status?: string | null;
  payment_reference?: string | null;
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
    latitude: number | null;
    longitude: number | null;
  };
  timeline: TrackingEvent[];
}

function StarRatingInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (val: number) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[11px] font-bold text-slate-650">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="focus:outline-none transition-transform active:scale-90 hover:scale-110"
          >
            <svg
              className={`h-4.5 w-4.5 ${
                star <= value ? "text-amber-400 fill-amber-400" : "text-slate-350"
              }`}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ width: "18px", height: "18px" }}
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}

function StarRatingDisplay({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`h-3 w-3 ${
            star <= value ? "text-amber-400 fill-amber-400" : "text-slate-200"
          }`}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ width: "12px", height: "12px" }}
        >
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </div>
  );
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

  // Geolocation states
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [locateSuccess, setLocateSuccess] = useState<string | null>(null);

  // Selected Order Tracking state
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [trackingData, setTrackingData] = useState<TrackingSnapshot | null>(null);
  const [loadingTracking, setLoadingTracking] = useState(false);

  // Payment Simulation States
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState<string | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);

  // Driver overall ratings state (mapping driver_id to overall_average rating)
  const [driverRatings, setDriverRatings] = useState<Record<string, number>>({});

  // Selected Order Rating states
  const [selectedOrderRating, setSelectedOrderRating] = useState<any | null>(null);
  const [loadingRating, setLoadingRating] = useState(false);
  const [selectedDriverRatingSummary, setSelectedDriverRatingSummary] = useState<any | null>(null);

  // Rating Submission states
  const [rateWaterQuality, setRateWaterQuality] = useState(5);
  const [rateDeliverySpeed, setRateDeliverySpeed] = useState(5);
  const [rateDriverProf, setRateDriverProf] = useState(5);
  const [rateComments, setRateComments] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [ratingSuccess, setRatingSuccess] = useState<string | null>(null);

  const calculateDistance = (lat1: number | null, lon1: number | null, lat2: number | null, lon2: number | null): string => {
    if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return "N/A";
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const d = R * c; // Distance in km
    if (d < 1) {
      return (d * 1000).toFixed(0) + " meters";
    }
    return d.toFixed(2) + " km";
  };

  const getRawDistance = (lat1: number | null, lon1: number | null, lat2: number | null, lon2: number | null): number => {
    if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return Infinity;
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c; // Distance in km
  };

  // Geolocation auto-detect handler
  const autoDetectLocation = async () => {
    setLocateError(null);
    setLocateSuccess(null);
    if (!navigator.geolocation) {
      setLocateError("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setValue("latitude", parseFloat(latitude.toFixed(6)));
        setValue("longitude", parseFloat(longitude.toFixed(6)));
        // Reverse-geocode using Nominatim (OpenStreetMap – free, no key required)
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { "Accept-Language": "en" } }
          );
          const geo = await res.json();
          const addr = geo?.display_name as string | undefined;
          if (addr) {
            setValue("delivery_address", addr);
            setLocateSuccess("Location detected and address filled ✓");
          } else {
            setLocateSuccess(`Coordinates set: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
          }
        } catch {
          // Still show coords even if reverse-geocoding fails
          setLocateSuccess(`Coordinates set: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        if (err.code === 1) setLocateError("Location permission denied. Please allow access in your browser.");
        else if (err.code === 2) setLocateError("Location unavailable. Check your device's GPS or network.");
        else setLocateError("Timed out waiting for your location. Please try again.");
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

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
  const watchedLatitude = watch("latitude");
  const watchedLongitude = watch("longitude");

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
        const activeDrivers = driversRes.data;
        setDrivers(activeDrivers);
        
        // Fetch rating summaries for all active drivers in parallel
        try {
          const ratingPromises = activeDrivers.map((d: any) => apiFetch(`/drivers/${d.id}/ratings`));
          const summaries = await Promise.all(ratingPromises);
          const ratingsMap: Record<string, number> = {};
          summaries.forEach((sum: any, idx: number) => {
            if (sum?.success) {
              ratingsMap[activeDrivers[idx].id] = sum.data.overall_average;
            }
          });
          setDriverRatings(ratingsMap);
        } catch (err) {
          console.error("Failed to load driver ratings:", err);
        }
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

  // WebSocket live telemetry tracking connection
  useEffect(() => {
    if (!selectedOrder) {
      setTrackingData(null);
      return;
    }

    const { token } = useAuthStore.getState();
    if (!token) return;

    let isMounted = true;
    setLoadingTracking(true);

    const loadSnapshot = async () => {
      try {
        const trkRes = await apiFetch(`/orders/${selectedOrder.id}/tracking`);
        if (trkRes?.success && isMounted) {
          setTrackingData(trkRes.data);
        }
      } catch (err) {
        console.error("Failed to load initial tracking data:", err);
      } finally {
        if (isMounted) {
          setLoadingTracking(false);
        }
      }
    };
    loadSnapshot();

    // Establish WebSocket Connection
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
    const wsProto = base.startsWith("https") ? "wss" : "ws";
    const wsHost = base.replace(/^https?:\/\//, "");
    const wsUrl = `${wsProto}://${wsHost}/ws/orders/${selectedOrder.id}/tracking?token=${token}`;
    
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.event === "DRIVER_LOCATION_UPDATED") {
          setTrackingData((prev) => {
            if (!prev || prev.order_id !== msg.data.order_id) return prev;
            return {
              ...prev,
              driver_location: {
                latitude: msg.data.latitude,
                longitude: msg.data.longitude,
                last_updated_at: new Date().toISOString(),
              },
            };
          });
        } else if (msg.event === "ORDER_STATUS_CHANGED") {
          // Update selectedOrder status
          setSelectedOrder((prev) => {
            if (!prev || prev.id !== msg.data.order_id) return prev;
            return { ...prev, status: msg.data.status };
          });
          // Update orders list status
          setOrders((prev) =>
            prev.map((o) =>
              o.id === msg.data.order_id ? { ...o, status: msg.data.status } : o
            )
          );
          // Reload tracking snapshot to get the new event timeline
          loadSnapshot();
        }
      } catch (err) {
        console.error("Error parsing WebSocket message:", err);
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket tracking connection error:", err);
    };

    return () => {
      isMounted = false;
      ws.close();
    };
  }, [selectedOrder?.id]);

  const handleOpenPaymentModal = async (order: Order) => {
    setPaymentOrder(order);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiFetch("/payments/initialize", {
        method: "POST",
        json: { order_id: order.id }
      });
      if (res?.success) {
        const { checkout_url, reference, public_key } = res.data;
        setPaymentUrl(checkout_url);
        setPaymentReference(reference);
        
        const paystackKey = public_key || process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || "pk_test_d3a3c2ce526017b2b7e5f32b8509c2a381cd3d99";

        if (window.PaystackPop) {
          const handler = window.PaystackPop.setup({
            key: paystackKey,
            email: user?.email || "customer@example.com",
            amount: Math.round(order.price * 100), // amount in kobo
            ref: reference,
            callback: function(response: any) {
              const verify = async () => {
                setProcessingPayment(true);
                try {
                  const verifyRes = await apiFetch(`/payments/verify/${response.reference}`);
                  if (verifyRes?.success && verifyRes.data.status === "SUCCESSFUL") {
                    setSuccess("Payment successful! Your order is now funded.");
                    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, payment_status: "SUCCESSFUL" } : o));
                  } else {
                    setError("Payment verification pending or failed.");
                  }
                } catch (err: any) {
                  setError(err.message || "Failed to verify payment.");
                } finally {
                  setProcessingPayment(false);
                }
              };
              verify();
            },
            onClose: function() {
              setError("Payment portal closed.");
            }
          });
          handler.openIframe();
        } else {
          // Fallback if SDK hasn't loaded yet
          window.open(checkout_url, "_blank");
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to initialize payment.");
    }
  };

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

  const loadSelectedOrderRating = async (orderId: string) => {
    setLoadingRating(true);
    setSelectedOrderRating(null);
    setRatingError(null);
    setRatingSuccess(null);
    try {
      const ratingRes = await apiFetch(`/orders/${orderId}/rating`);
      if (ratingRes?.success) {
        setSelectedOrderRating(ratingRes.data);
      }
    } catch (err) {
      console.log("No rating found or error:", err);
    } finally {
      setLoadingRating(false);
    }
  };

  const loadSelectedDriverRatingSummary = async (driverId: string) => {
    try {
      const summaryRes = await apiFetch(`/drivers/${driverId}/ratings`);
      if (summaryRes?.success) {
        setSelectedDriverRatingSummary(summaryRes.data);
      }
    } catch (err) {
      console.log("Failed to load driver rating summary:", err);
    }
  };

  const handleTrackOrder = (order: Order) => {
    setSelectedOrder(order);
    if (order.status === "DELIVERED") {
      loadSelectedOrderRating(order.id);
    } else {
      setSelectedOrderRating(null);
    }
    if (order.assigned_driver_id) {
      loadSelectedDriverRatingSummary(order.assigned_driver_id);
    } else {
      setSelectedDriverRatingSummary(null);
    }
  };

  const handleSubmitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setSubmittingRating(true);
    setRatingError(null);
    setRatingSuccess(null);
    try {
      const res = await apiFetch(`/orders/${selectedOrder.id}/rating`, {
        method: "POST",
        json: {
          rating_water_quality: rateWaterQuality,
          rating_delivery_speed: rateDeliverySpeed,
          rating_driver_professionalism: rateDriverProf,
          comments: rateComments || null,
        }
      });
      if (res?.success) {
        setRatingSuccess("Thank you! Your rating has been submitted.");
        setSelectedOrderRating(res.data);
        setRateComments("");
        loadDashboardData();
        if (selectedOrder.assigned_driver_id) {
          loadSelectedDriverRatingSummary(selectedOrder.assigned_driver_id);
        }
      }
    } catch (err: any) {
      setRatingError(err.message || "Failed to submit rating.");
    } finally {
      setSubmittingRating(false);
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
              <div>
                <h1 className="md:text-3xl font-bold text-slate-800">Welcome back, Customer {user?.first_name}</h1>
                <p className="text-sm text-slate-500">Monitor your water delivery status, track active shipments, and view your consumption analytics in Enugu State</p>
              </div>
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
                            <div className="flex justify-between">
                              <span>Payment Status:</span>
                              <span className={`font-black uppercase text-[10px] px-2 py-0.5 rounded-full ${
                                order.payment_status === "SUCCESSFUL"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                  : order.payment_status === "FAILED"
                                  ? "bg-rose-50 text-rose-700 border border-rose-100"
                                  : "bg-amber-50 text-amber-700 border border-amber-100"
                              }`}>
                                {order.payment_status || "PENDING"}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                            {(!order.payment_status || order.payment_status !== "SUCCESSFUL") && order.status === "DELIVERED" ? (
                              <button
                                onClick={() => handleOpenPaymentModal(order)}
                                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-1"
                              >
                                <ShoppingBag size={12} />
                                Pay Now (₦ {order.price.toLocaleString()})
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  handleTrackOrder(order);
                                  setActiveTab("history");
                                }}
                                className="flex-1 py-2 bg-primary-light hover:bg-[#2f43ff]/10 text-primary text-xs font-black rounded-xl transition-all"
                              >
                                Track & Audit Live
                              </button>
                            )}
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
            <div className="space-y-6">
              <h1 className="md:text-3xl font-bold text-slate-800">Order Water</h1>
              <p className="text-sm text-slate-500">Select a verified water tanker operator, choose water specification grade, and place your order</p>

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
                  {(() => {
                    const sortedDrivers = [...drivers].sort((a, b) => {
                      const distA = getRawDistance(watchedLatitude, watchedLongitude, a.latitude, a.longitude);
                      const distB = getRawDistance(watchedLatitude, watchedLongitude, b.latitude, b.longitude);
                      return distA - distB;
                    });
                    
                    return (
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Available Tanker Driver (Sorted by Proximity)</label>
                        <select
                          {...register("driver_id")}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary font-medium"
                        >
                          <option value="">-- Choose Online Driver --</option>
                          {sortedDrivers.map((drv, index) => {
                            const driverSource = drv.tanker?.default_source_id
                              ? sources.find(s => s.id === drv.tanker?.default_source_id)
                              : null;
                            const distStr = calculateDistance(watchedLatitude, watchedLongitude, drv.latitude, drv.longitude);
                            const label = index === 0 ? " [Closest - RECOMMENDED]" : "";
                            const avgRating = driverRatings[drv.id];
                            const ratingStr = avgRating && avgRating > 0 ? `★ ${avgRating.toFixed(1)}` : "No ratings";
                            return (
                              <option key={drv.id} value={drv.id}>
                                {drv.user.first_name} {drv.user.last_name} ({ratingStr}) ({drv.tanker?.plate_number} - {drv.tanker?.capacity_litres.toLocaleString()}L) - {distStr} away{label} - Depot: {driverSource?.name || "Unverified"}
                              </option>
                            );
                          })}
                        </select>
                        {formErrors.driver_id && (
                          <p className="text-xs text-red-500 font-medium pl-1">{formErrors.driver_id.message}</p>
                        )}
                      </div>
                    );
                  })()}

                  {/* Driver Verification Status & Proximity Info */}
                  {(() => {
                    if (!watchedDriverId || !selectedDriver) return null;
                    const sortedDrivers = [...drivers].sort((a, b) => {
                      const distA = getRawDistance(watchedLatitude, watchedLongitude, a.latitude, a.longitude);
                      const distB = getRawDistance(watchedLatitude, watchedLongitude, b.latitude, b.longitude);
                      return distA - distB;
                    });
                    const isClosest = sortedDrivers[0]?.id === selectedDriver.id;
                    const closestDistance = calculateDistance(watchedLatitude, watchedLongitude, sortedDrivers[0]?.latitude, sortedDrivers[0]?.longitude);
                    const selectedDistance = calculateDistance(watchedLatitude, watchedLongitude, selectedDriver.latitude, selectedDriver.longitude);
                    const avgRating = driverRatings[selectedDriver.id];

                    return (
                      <div className="space-y-3">
                        {/* Proximity / Cost Rating */}
                        <div className={`p-4 rounded-2xl border flex items-start gap-3 text-xs font-semibold ${
                          isClosest 
                            ? "bg-emerald-50/50 border-emerald-100 text-emerald-950" 
                            : "bg-blue-50/50 border-blue-100 text-blue-950"
                        }`}>
                          <Compass className={`${isClosest ? "text-emerald-600" : "text-blue-600"} shrink-0 mt-0.5`} size={16} />
                          <div className="space-y-1 w-full">
                            <div className="flex justify-between items-center w-full">
                              <p className="font-extrabold text-slate-800">
                                {isClosest ? "✅ Recommended Closest Driver" : "💡 Closer Driver Available"} (Distance: {selectedDistance})
                              </p>
                              {avgRating !== undefined && avgRating > 0 && (
                                <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-[10px] font-black shrink-0">
                                  ★ {avgRating.toFixed(1)}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 font-normal">
                              {isClosest 
                                ? "Selecting this operator minimizes transit footprints and reduces delivery response times, cutting dispatch overhead."
                                : `There is a closer driver online (${closestDistance} away). Choosing the closest driver is recommended to optimize delivery costs.`}
                            </p>
                          </div>
                        </div>

                        {/* Standard Verification status */}
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
                      </div>
                    );
                  })()}

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
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Delivery Address</label>
                      <button
                        type="button"
                        onClick={autoDetectLocation}
                        disabled={locating}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black bg-primary/10 text-primary hover:bg-primary/20 transition-all active:scale-95 disabled:opacity-60"
                      >
                        {locating
                          ? <Loader2 size={12} className="animate-spin" />
                          : <LocateFixed size={12} />}
                        {locating ? "Detecting…" : "Detect My Location"}
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. 40 Ogui Road, Enugu State"
                      {...register("delivery_address")}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary font-semibold"
                    />
                    {formErrors.delivery_address && (
                      <p className="text-xs text-red-500 font-medium pl-1">{formErrors.delivery_address.message}</p>
                    )}
                    {/* Locate feedback banners */}
                    {locateSuccess && (
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 font-semibold">
                        <CheckCircle2 size={12} /> {locateSuccess}
                      </div>
                    )}
                    {locateError && (
                      <div className="flex items-center gap-1.5 text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-1.5 font-semibold">
                        <XCircle size={12} /> {locateError}
                      </div>
                    )}
                  </div>

                  {/* Coordinate inputs */}
                  <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-2xl border border-slate-150">
                    <div className="col-span-2 text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Compass size={14} className="text-primary" />
                      GPS Coordinates — auto-filled by &quot;Detect My Location&quot; or click the map below
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
                    <div className="col-span-2 space-y-1.5 mt-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Click map to pick location</label>
                      <MapComponent
                        height="220px"
                        zoom={12}
                        markers={watchedLatitude && watchedLongitude ? [{
                          id: "picked-destination",
                          latitude: watchedLatitude,
                          longitude: watchedLongitude,
                          title: "Delivery Location",
                          iconType: "customer"
                        }] : []}
                        onMapClick={(lat, lng) => {
                          setValue("latitude", parseFloat(lat.toFixed(6)));
                          setValue("longitude", parseFloat(lng.toFixed(6)));
                        }}
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
          </div>
        )}

          {/* TAB 3: ORDER HISTORY & AUDIT TIMELINE */}
          {activeTab === "history" && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h1 className="md:text-3xl font-bold text-slate-800">Order History & Live Traceability</h1>
                <p className="text-sm text-slate-500">Audit past water deliveries, view invoice receipts, and check quality test reports from source boreholes</p>
              </div>

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
                          <th className="px-6 py-4">Payment</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-semibold">
                        {orders.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
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
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                  o.payment_status === "SUCCESSFUL"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-250"
                                    : o.payment_status === "FAILED"
                                    ? "bg-rose-50 text-rose-700 border border-rose-250"
                                    : "bg-amber-50 text-amber-700 border border-amber-250"
                                }`}>
                                  {o.payment_status || "PENDING"}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                                {(!o.payment_status || o.payment_status !== "SUCCESSFUL") && o.status === "DELIVERED" && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenPaymentModal(o);
                                    }}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-lg transition-all"
                                  >
                                    Pay
                                  </button>
                                )}
                                <ChevronRight size={16} className="text-slate-400" />
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
                      <div className="space-y-6 border-t border-slate-100 pt-5 animate-fade-in">
                        
                        {/* 0. Post-Delivery Payment Prompt */}
                        {selectedOrder.status === "DELIVERED" && (!selectedOrder.payment_status || selectedOrder.payment_status !== "SUCCESSFUL") && (
                          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3 animate-pulse">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="text-emerald-600" size={18} />
                              <span className="font-bold text-slate-800 text-sm">Delivery Completed!</span>
                            </div>
                            <p className="text-xs text-slate-650">
                              Your water has been safely delivered to your address. Please complete the post-service payment.
                            </p>
                            <button
                              onClick={() => handleOpenPaymentModal(selectedOrder)}
                              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5"
                            >
                              <ShoppingBag size={14} />
                              Pay Now (₦ {selectedOrder.price.toLocaleString()})
                            </button>
                          </div>
                        )}

                        {/* 0.5 Ratings and Reviews Section */}
                        {selectedOrder.status === "DELIVERED" && (
                          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                              <svg className="h-4 w-4 text-amber-500 fill-amber-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: "16px", height: "16px" }}>
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                              </svg>
                              Ratings & Reviews
                            </h4>
                            
                            {loadingRating ? (
                              <div className="flex justify-center py-4">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                              </div>
                            ) : selectedOrderRating ? (
                              /* Display existing rating details */
                              <div className="space-y-2 text-xs">
                                <div className="flex justify-between items-center">
                                  <span className="text-slate-500">Water Quality:</span>
                                  <StarRatingDisplay value={selectedOrderRating.rating_water_quality} />
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-slate-555">Delivery Speed:</span>
                                  <StarRatingDisplay value={selectedOrderRating.rating_delivery_speed} />
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-slate-555">Driver Professionalism:</span>
                                  <StarRatingDisplay value={selectedOrderRating.rating_driver_professionalism} />
                                </div>
                                {selectedOrderRating.comments && (
                                  <div className="bg-white border border-slate-150 p-2.5 rounded-xl text-[11px] text-slate-650 italic mt-1.5">
                                    "{selectedOrderRating.comments}"
                                  </div>
                                )}
                              </div>
                            ) : (
                              /* Submission Form */
                              <form onSubmit={handleSubmitRating} className="space-y-3">
                                {ratingError && (
                                  <p className="text-[10px] text-rose-600 font-bold bg-rose-50 border border-rose-100 p-1.5 rounded-lg">{ratingError}</p>
                                )}
                                {ratingSuccess && (
                                  <p className="text-[10px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 p-1.5 rounded-lg">{ratingSuccess}</p>
                                )}
                                <StarRatingInput label="Water Quality" value={rateWaterQuality} onChange={setRateWaterQuality} />
                                <StarRatingInput label="Delivery Speed" value={rateDeliverySpeed} onChange={setRateDeliverySpeed} />
                                <StarRatingInput label="Professionalism" value={rateDriverProf} onChange={setRateDriverProf} />
                                
                                <textarea
                                  placeholder="Leave optional written review..."
                                  value={rateComments}
                                  onChange={(e) => setRateComments(e.target.value)}
                                  maxLength={1000}
                                  className="w-full bg-white border border-slate-250 rounded-xl p-2.5 text-[11px] focus:outline-none focus:border-primary font-medium font-sans"
                                  rows={2}
                                />
                                
                                <button
                                  type="submit"
                                  disabled={submittingRating}
                                  className="w-full py-2 bg-[#2f43ff] text-white text-[11px] font-black rounded-xl hover:bg-blue-600 transition-all flex items-center justify-center gap-1 shadow-md"
                                >
                                  {submittingRating ? (
                                    <div className="h-3.5 w-3.5 animate-spin rounded-full border border-white border-t-transparent" />
                                  ) : (
                                    <span>Submit Rating</span>
                                  )}
                                </button>
                              </form>
                            )}
                          </div>
                        )}

                        {/* 1. 3-Point Visual Telemetry Panel */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                            <MapPin size={14} className="text-primary animate-pulse" />
                            Live Route & GPS Telemetry
                          </h4>
                          
                          <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl space-y-4 shadow-sm">
                            
                            {(() => {
                              const trackingMarkers: any[] = [];
                              if (trackingData.source_location?.latitude !== null && trackingData.source_location?.longitude !== null) {
                                trackingMarkers.push({
                                  id: "source",
                                  latitude: trackingData.source_location.latitude,
                                  longitude: trackingData.source_location.longitude,
                                  title: trackingData.source_location.name || "Water Source",
                                  iconType: "source",
                                  popupText: `Verification: ${trackingData.source_location.verification_status || "PENDING"} | Grade: ${trackingData.source_location.quality_grade || "N/A"}`
                                });
                              }
                              if (trackingData.driver_location?.latitude !== null && trackingData.driver_location?.longitude !== null) {
                                trackingMarkers.push({
                                  id: "driver",
                                  latitude: trackingData.driver_location.latitude,
                                  longitude: trackingData.driver_location.longitude,
                                  title: "Driver Location",
                                  iconType: "driver",
                                  popupText: "Simulated live tanker location telemetry"
                                });
                              }
                              if (selectedOrder.latitude !== null && selectedOrder.longitude !== null) {
                                trackingMarkers.push({
                                  id: "customer",
                                  latitude: selectedOrder.latitude,
                                  longitude: selectedOrder.longitude,
                                  title: "Delivery Destination",
                                  iconType: "customer",
                                  popupText: selectedOrder.delivery_address
                                });
                              }

                              const autoRoute = {
                                driver: trackingData.driver_location?.latitude !== null && trackingData.driver_location?.longitude !== null
                                  ? { latitude: trackingData.driver_location.latitude, longitude: trackingData.driver_location.longitude }
                                  : null,
                                source: trackingData.source_location?.latitude !== null && trackingData.source_location?.longitude !== null
                                  ? { latitude: trackingData.source_location.latitude, longitude: trackingData.source_location.longitude }
                                  : null,
                                customer: { latitude: selectedOrder.latitude, longitude: selectedOrder.longitude }
                              };

                              return (
                                <div className="mb-4">
                                  <MapComponent
                                    markers={trackingMarkers}
                                    autoRouteFromDriverToSourceToCustomer={autoRoute}
                                    height="280px"
                                  />
                                </div>
                              );
                            })()}

                            {/* Point A: Source Depot */}
                            <div className="flex gap-3 relative">
                              <div className="absolute left-3 top-6 bottom-0 w-0.5 border-l-2 border-dashed border-slate-300"></div>
                              <div className="h-6 w-6 rounded-full bg-blue-100 border-2 border-blue-500 flex items-center justify-center shrink-0 z-10">
                                <span className="text-[10px] font-black text-blue-600">A</span>
                              </div>
                              <div className="space-y-1 text-xs">
                                <span className="block font-bold text-slate-400 uppercase text-[9px] leading-none">Water Source Depot</span>
                                <span className="font-extrabold text-slate-850 block">
                                  {trackingData.source_location.name || "No Water Facility Depot"}
                                </span>
                                {trackingData.source_location.latitude !== null && (
                                  <span className="text-[10px] text-slate-500 block font-mono">
                                    GPS: {trackingData.source_location.latitude.toFixed(5)}, {trackingData.source_location.longitude?.toFixed(5)}
                                  </span>
                                )}
                                <div className="flex gap-1.5 mt-1">
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black bg-blue-50 text-blue-700 border border-blue-100">
                                    Grade {trackingData.source_location.quality_grade || "N/A"}
                                  </span>
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100">
                                    {trackingData.source_location.verification_status || "PENDING"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Point B: Driver Live Position */}
                            <div className="flex gap-3 relative">
                              <div className="absolute left-3 top-6 bottom-0 w-0.5 border-l-2 border-dashed border-slate-300"></div>
                              <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 z-10 border-2 ${
                                trackingData.driver_location.latitude !== null ? "bg-emerald-100 border-emerald-500 animate-pulse" : "bg-slate-100 border-slate-400"
                              }`}>
                                <Truck size={12} className={trackingData.driver_location.latitude !== null ? "text-emerald-600" : "text-slate-500"} />
                              </div>
                              <div className="space-y-1 text-xs">
                                <span className="block font-bold text-slate-400 uppercase text-[9px] leading-none">Live Driver Telemetry</span>
                                {selectedDriverRatingSummary && selectedDriverRatingSummary.total_ratings_count > 0 && (
                                  <div className="flex items-center gap-1 bg-amber-50 text-amber-850 px-1.5 py-0.5 rounded text-[9px] font-black inline-flex mt-0.5">
                                    ★ {selectedDriverRatingSummary.overall_average.toFixed(1)} ({selectedDriverRatingSummary.total_ratings_count} reviews)
                                  </div>
                                )}
                                {trackingData.driver_location.latitude !== null ? (
                                  <>
                                    <span className="font-extrabold text-emerald-600 block">Active Simulator Tracking</span>
                                    <span className="text-[10px] text-slate-500 block font-mono">
                                      GPS: {trackingData.driver_location.latitude.toFixed(5)}, {trackingData.driver_location.longitude?.toFixed(5)}
                                    </span>
                                    
                                    {/* Distance calculations based on status */}
                                    {selectedOrder.status === "GOING_TO_SOURCE" && (
                                      <div className="mt-1 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg inline-block text-[10px] font-bold text-blue-750">
                                        Distance to Depot: {calculateDistance(
                                          trackingData.driver_location.latitude,
                                          trackingData.driver_location.longitude,
                                          trackingData.source_location.latitude,
                                          trackingData.source_location.longitude
                                        )}
                                      </div>
                                    )}

                                    {["EN_ROUTE", "ARRIVED"].includes(selectedOrder.status) && (
                                      <div className="mt-1 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg inline-block text-[10px] font-bold text-emerald-750">
                                        Distance to Destination: {calculateDistance(
                                          trackingData.driver_location.latitude,
                                          trackingData.driver_location.longitude,
                                          selectedOrder.latitude,
                                          selectedOrder.longitude
                                        )}
                                      </div>
                                    )}

                                    {selectedOrder.status === "LOADING_WATER" && (
                                      <div className="mt-1 bg-amber-55 border border-amber-100 px-2.5 py-1 rounded-lg inline-block text-[10px] font-bold text-amber-800 animate-pulse">
                                        Status: Loading Water at Depot
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-slate-400 italic block">Awaiting driver GPS lock...</span>
                                )}
                              </div>
                            </div>

                            {/* Point C: Customer Destination */}
                            <div className="flex gap-3">
                              <div className="h-6 w-6 rounded-full bg-rose-100 border-2 border-rose-500 flex items-center justify-center shrink-0 z-10">
                                <span className="text-[10px] font-black text-rose-600">C</span>
                              </div>
                              <div className="space-y-1 text-xs">
                                <span className="block font-bold text-slate-400 uppercase text-[9px] leading-none">Customer Destination</span>
                                <span className="font-extrabold text-slate-850 block truncate max-w-[200px]" title={selectedOrder.delivery_address}>
                                  {selectedOrder.delivery_address}
                                </span>
                                <span className="text-[10px] text-slate-500 block font-mono">
                                  GPS: {selectedOrder.latitude.toFixed(5)}, {selectedOrder.longitude.toFixed(5)}
                                </span>
                              </div>
                            </div>

                          </div>
                        </div>

                        {/* 2. Timeline Logistics */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                            <Activity size={14} className="text-primary" />
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
          </div>
        )}

          {/* TAB 4: PROFILE */}
          {activeTab === "profile" && (
            <div className="space-y-6 animate-fade-in">
              <h1 className="md:text-3xl font-bold text-slate-800">Customer Profile</h1>
              <p className="text-sm text-slate-500">Manage your account details, security credentials, and view order summary statistics</p>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                {/* Left Column: Profile Card */}
                <div className="lg:col-span-1 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col items-center text-center">
                  {/* Avatar or Placeholder */}
                  <div className="h-24 w-24 rounded-full bg-blue-50 text-[#2f43ff] flex items-center justify-center border-2 border-blue-200 mb-4 shadow-inner">
                    <UserIcon size={48} className="stroke-[1.5]" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900">{user?.first_name} {user?.last_name}</h3>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 mt-2 rounded-full text-[10px] font-black tracking-wide bg-blue-50 text-blue-700 border border-blue-200 uppercase">
                    {user?.role} Account
                  </span>

                  <div className="w-full border-t border-slate-100 pt-4 mt-4 space-y-2 text-xs font-medium text-slate-500">
                    <div className="flex justify-between">
                      <span>Account Status</span>
                      <span className="text-emerald-600 font-extrabold flex items-center gap-1">
                        <CheckCircle2 size={12} /> Active
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Member Since</span>
                      <span className="text-slate-800 font-bold">June 2026</span>
                    </div>
                  </div>
                </div>

                {/* Middle/Right Column: Details & Stats Cards */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Contact Info Card */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                    <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-3 uppercase tracking-wider">
                      <UserIcon size={16} className="text-[#2f43ff]" />
                      Personal Details
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">First Name</span>
                        <span className="text-sm font-bold text-slate-800">{user?.first_name}</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Last Name</span>
                        <span className="text-sm font-bold text-slate-800">{user?.last_name}</span>
                      </div>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase">Email Address</span>
                      <span className="text-sm font-bold text-slate-800">{user?.email}</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase">Phone Number</span>
                      <span className="text-sm font-bold text-slate-800">{user?.phone}</span>
                    </div>
                  </div>

                  {/* Dynamic Telemetry / Stats Card */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                    <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-1.5 border-b border-slate-100 pb-3 uppercase tracking-wider">
                      <Activity size={16} className="text-[#2f43ff]" />
                      Usage Analytics
                    </h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-center">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Total Orders</span>
                        <span className="text-xl font-black text-slate-900 block mt-1">{orders.length}</span>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-center">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Completed</span>
                        <span className="text-xl font-black text-emerald-600 block mt-1">
                          {orders.filter(o => o.status === "DELIVERED").length}
                        </span>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-center">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Volume Ordered</span>
                        <span className="text-xl font-black text-blue-600 block mt-1">
                          {orders.filter(o => o.status === "DELIVERED").reduce((acc, o) => acc + o.quantity_litres, 0).toLocaleString()}L
                        </span>
                      </div>
                    </div>
                    <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl flex items-start gap-2.5 text-xs text-blue-900 font-semibold">
                      <Info size={16} className="text-[#2f43ff] shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-slate-850">Water Consumption Tips</p>
                        <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                          Always ensure you check the water source safety rating before ordering drinking-grade water. Keep your storage tanks clean and disinfected regularly.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Paystack Inline Script Dynamic Loader */}
      <Script 
        src="https://js.paystack.co/v1/inline.js" 
        strategy="afterInteractive" 
      />

      {/* Payment Verification Processing Modal Overlay */}
      {processingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl flex flex-col items-center gap-4 max-w-sm w-full text-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#2f43ff]" />
            <h3 className="text-sm font-black text-slate-800">Verifying Payment</h3>
            <p className="text-xs font-semibold text-slate-500">Please wait while we confirm your payment transaction with Paystack.</p>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
