"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "../../../components/navbar";
import ProtectedRoute from "../../../components/shared/protected-route";
import { apiFetch } from "../../../lib/api-client";
import { 
  ArrowLeft, 
  MapPin, 
  Droplet, 
  Info,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Map
} from "lucide-react";

const registerSourceSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(255),
  type: z.enum(["BOREHOLE", "TREATMENT_PLANT", "RESERVOIR", "GOVERNMENT_FACILITY", "COMMERCIAL_VENDOR"]),
  address: z.string().min(5, "Address must be at least 5 characters"),
  latitude: z.number({ message: "Latitude is required" }).min(-90.0, "Latitude must be between -90 and 90").max(90.0),
  longitude: z.number({ message: "Longitude is required" }).min(-180.0, "Longitude must be between -180 and 180").max(180.0),
});

type RegisterSourceFormValues = z.infer<typeof registerSourceSchema>;

export default function RegisterWaterSourcePage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterSourceFormValues>({
    resolver: zodResolver(registerSourceSchema),
    defaultValues: {
      name: "",
      type: "BOREHOLE",
      address: "",
      latitude: 6.44, // Default Enugu Latitude
      longitude: 7.50, // Default Enugu Longitude
    },
  });

  const onSubmit = async (data: RegisterSourceFormValues) => {
    setError(null);
    setSuccess(false);
    setIsLoading(true);

    try {
      const response = await apiFetch("/water-sources", {
        method: "POST",
        json: data,
      });

      if (response && response.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push("/sources");
        }, 2000);
      } else {
        setError(response.message || "Failed to register water source.");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while submitting the form.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={["FACILITY", "ADMIN"]}>
      <div className="bg-slate-50 min-h-screen text-slate-800 flex flex-col pt-24">
        <Navbar />

        <main className="flex-1 mx-auto max-w-xl w-full px-4 py-8">
          {/* Back Link */}
          <Link 
            href="/sources" 
            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-primary text-sm font-semibold mb-6 transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Catalog
          </Link>

          {/* Form Card (Light Theme) */}
          <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-2xl relative hover:border-primary/10 transition-all duration-300">
            {/* Header info */}
            <div className="flex flex-col items-center mb-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white text-lg font-bold shadow-lg shadow-primary/30 mb-4">
                <Droplet size={24} />
              </div>
              <h2 className="text-2xl font-black text-gray-700">Register Water Source</h2>
              <p className="text-xs text-slate-550 mt-1.5 md:text-[14px]">
                Add a physical borehole or treatment plant in Enugu State
              </p>
            </div>

            {/* Success Alert Banner */}
            {success && (
              <div className="mb-6 flex items-start gap-2 bg-emerald-50 border border-emerald-500/30 text-emerald-700 p-4 rounded-xl text-xs animate-pulse">
                <CheckCircle size={16} className="shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Registration Submitted!</span>
                  <span>Your source is registered successfully. Redirecting you to the catalog...</span>
                </div>
              </div>
            )}

            {/* Error Alert Banner */}
            {error && (
              <div className="mb-6 flex items-start gap-2 bg-red-50 border border-red-500/30 text-red-650 p-4 rounded-xl text-xs">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Source Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-600 md:text-[15px]" htmlFor="name">
                  Source Name
                </label>
                <div className="relative flex items-center bg-gray-100 border border-gray-300 rounded-xl focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                  <Droplet size={16} className="absolute left-4 text-slate-500" />
                  <input
                    id="name"
                    type="text"
                    placeholder="e.g. New Haven Borehole Station"
                    {...register("name")}
                    className="w-full pl-12 pr-4 py-2.5 bg-transparent text-sm md:text-[15px] text-gray-600 focus:outline-none"
                  />
                </div>
                {errors.name && (
                  <p className="text-[11px] text-red-400 font-medium pl-1">{errors.name.message}</p>
                )}
              </div>

              {/* Source Type Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-600 md:text-[15px]" htmlFor="type">
                  Water Source Type
                </label>
                <div className="relative flex items-center bg-gray-100 border border-gray-300 rounded-xl focus-within:border-primary transition-all">
                  <Info size={16} className="absolute left-4 text-slate-500" />
                  <select
                    id="type"
                    {...register("type")}
                    className="w-full pl-12 pr-4 py-2.5 bg-transparent text-sm md:text-[15px] text-gray-600 focus:outline-none appearance-none cursor-pointer"
                  >
                    <option value="BOREHOLE">Borehole</option>
                    <option value="TREATMENT_PLANT">Treatment Plant</option>
                    <option value="RESERVOIR">Reservoir</option>
                    <option value="GOVERNMENT_FACILITY">Government Facility</option>
                    <option value="COMMERCIAL_VENDOR">Commercial Vendor</option>
                  </select>
                </div>
                {errors.type && (
                  <p className="text-[11px] text-red-400 font-medium pl-1">{errors.type.message}</p>
                )}
              </div>

              {/* Address */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-gray-600 md:text-[15px]" htmlFor="address">
                  Physical Address
                </label>
                <div className="relative flex items-center bg-gray-100 border border-gray-300 rounded-xl focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                  <MapPin size={16} className="absolute left-4 text-slate-500" />
                  <input
                    id="address"
                    type="text"
                    placeholder="e.g. 15 Chime Ave, New Haven, Enugu"
                    {...register("address")}
                    className="w-full pl-12 pr-4 py-2.5 bg-transparent text-sm md:text-[15px] text-gray-600 focus:outline-none"
                  />
                </div>
                {errors.address && (
                  <p className="text-[11px] text-red-400 font-medium pl-1">{errors.address.message}</p>
                )}
              </div>

              {/* Coordinates Grid */}
              <div className="grid grid-cols-2 gap-4">
                {/* Latitude */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-gray-600 md:text-[15px]" htmlFor="latitude">
                    Latitude
                  </label>
                  <div className="relative flex items-center bg-gray-100 border border-gray-300 rounded-xl focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                    <Map size={16} className="absolute left-4 text-slate-500" />
                    <input
                      id="latitude"
                      type="number"
                      step="any"
                      placeholder="6.44"
                      {...register("latitude", { valueAsNumber: true })}
                      className="w-full pl-12 pr-4 py-2.5 bg-transparent text-sm md:text-[15px] text-gray-600 focus:outline-none"
                    />
                  </div>
                  {errors.latitude && (
                    <p className="text-[11px] text-red-400 font-medium pl-1">{errors.latitude.message}</p>
                  )}
                </div>

                {/* Longitude */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-gray-600 md:text-[15px]" htmlFor="longitude">
                    Longitude
                  </label>
                  <div className="relative flex items-center bg-gray-100 border border-gray-300 rounded-xl focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                    <Map size={16} className="absolute left-4 text-slate-500" />
                    <input
                      id="longitude"
                      type="number"
                      step="any"
                      placeholder="7.50"
                      {...register("longitude", { valueAsNumber: true })}
                      className="w-full pl-12 pr-4 py-2.5 bg-transparent text-sm md:text-[15px] text-gray-600 focus:outline-none"
                    />
                  </div>
                  {errors.longitude && (
                    <p className="text-[11px] text-red-400 font-medium pl-1">{errors.longitude.message}</p>
                  )}
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading || success}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-hover py-3 font-semibold text-sm text-white shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none mt-2 md:text-[16px]"
              >
                {isLoading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <span>Submit Registration</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
