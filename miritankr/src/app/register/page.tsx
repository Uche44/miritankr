"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthSession } from "../../hooks/use-auth-session";
import { apiFetch } from "../../lib/api-client";
import {
  User,
  Mail,
  Key,
  Phone,
  ShieldAlert,
  Truck,
  Droplets,
  ArrowRight,
  AlertCircle
} from "lucide-react";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  phone: z.string().min(5, "Phone number must be at least 5 digits"),
  role: z.enum(["CUSTOMER", "DRIVER", "FACILITY", "ADMIN"]),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth, isLoggedIn, isReady } = useAuthSession();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"CUSTOMER" | "DRIVER" | "FACILITY" | "ADMIN">("CUSTOMER");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: "CUSTOMER",
    },
  });

  // Keep react-hook-form and state in sync
  const selectRole = (role: "CUSTOMER" | "DRIVER" | "FACILITY" | "ADMIN") => {
    setSelectedRole(role);
    setValue("role", role);
  };

  useEffect(() => {
    if (isReady && isLoggedIn) {
      router.push("/");
    }
  }, [isLoggedIn, isReady, router]);

  const onSubmit = async (data: RegisterFormValues) => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await apiFetch("/auth/register", {
        method: "POST",
        json: data,
      });

      // Save credentials in Zustand Store
      setAuth(response.user, response.access_token);

      // Navigate to main landing / setup dashboard
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Failed to register. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-white px-4 py-12 relative overflow-hidden">
      {/* Background decoration elements */}


      <div className="w-full max-w-lg bg-white/60 backdrop-blur-xl border border-white-80 rounded-3xl p-8 shadow-2xl relative z-10 hover:border-primary/10 transition-all duration-300">
        {/* Logo and headings */}
        <div className="flex flex-col items-center mb-8">
          <Link href="/" className="flex items-center gap-2 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary font-bold text-white text-lg shadow-lg shadow-primary/30">
              M
            </div>
            <span className="text-2xl font-black text-primary tracking-wide">
              Miri<span className="text-primary">Tankr</span>
            </span>
          </Link>
          <h2 className="text-xl font-bold text-gray-600">Create Account</h2>
          <p className="text-xs text-slate-500 mt-1 md:text-[16px]">Join Enugu's water logistics ecosystem</p>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-2 bg-red-950/40 border border-red-500/30 text-red-400 p-4 rounded-xl text-xs">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Role Visual Cards Selection */}
          <div className="space-y-2">
            <label className="block text-xs md:text-[16px] font-semibold text-gray-600">
              I want to sign up as a:
            </label>
            <div className="grid grid-cols-4 gap-2">
              {/* Customer Option */}
              <button
                type="button"
                onClick={() => selectRole("CUSTOMER")}
                className={`flex flex-col items-center justify-center p-3 rounded-xl text-white md:text-[16px] border text-center transition-all ${selectedRole === "CUSTOMER"
                  ? "bg-primary/20 border-primary"
                  : "bg-primary hover:border-primary/40"
                  }`}
              >
                <Droplets size={20} className={selectedRole === "CUSTOMER" ? "text-primary " : "text-white"} />
                <span className="text-[10px] font-bold mt-1.5 md:text-[14px]">Customer</span>
              </button>

              {/* Driver Option */}
              <button
                type="button"
                onClick={() => selectRole("DRIVER")}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-white text-center transition-all ${selectedRole === "DRIVER"
                  ? "bg-primary/20 border-primary"
                  : "bg-primary hover:border-primary/40"
                  }`}
              >
                <Truck size={20} className={selectedRole === "DRIVER" ? "text-primary" : "text-white"} />
                <span className="text-[10px] font-bold mt-1.5 md:text-[14px]">Driver</span>
              </button>

              {/* Facility Option */}
              <button
                type="button"
                onClick={() => selectRole("FACILITY")}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-white text-center transition-all ${selectedRole === "FACILITY"
                  ? "bg-primary/20 border-primary"
                  : "bg-primary hover:border-primary/40"
                  }`}
              >
                <User size={20} className={selectedRole === "FACILITY" ? "text-primary" : "text-white"} />
                <span className="text-[10px] font-bold mt-1.5 md:text-[14px]">Facility</span>
              </button>

              {/* Admin Option */}
              <button
                type="button"
                onClick={() => selectRole("ADMIN")}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-white text-center transition-all ${selectedRole === "ADMIN"
                  ? "bg-primary/20 border-primary"
                  : "bg-primary hover:border-primary/40"
                  }`}
              >
                <ShieldAlert size={20} className={selectedRole === "ADMIN" ? "text-primary" : "text-white"} />
                <span className="text-[10px] font-bold mt-1.5 md:text-[14px]">Admin</span>
              </button>
            </div>
            {errors.role && (
              <p className="text-[11px] text-red-400 font-medium pl-1">{errors.role.message}</p>
            )}
          </div>

          {/* Names Row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-600 md:text-[16px]" htmlFor="first_name">
                First Name
              </label>
              <div className="relative flex items-center bg-gray-100 border border-gray-600 rounded-xl focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                <User size={16} className="absolute left-4 text-slate-500" />
                <input
                  id="first_name"
                  type="text"
                  placeholder="John"
                  {...register("first_name")}
                  className="w-full pl-12 pr-4 py-2.5 bg-transparent text-sm md:text-[16px] text-gray-600 placeholder-slate-650 focus:outline-none"
                />
              </div>
              {errors.first_name && (
                <p className="text-[11px] text-red-400 font-medium pl-1">{errors.first_name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-gray-600 md:text-[16px]" htmlFor="last_name">
                Last Name
              </label>
              <div className="relative flex items-center bg-gray-100 border border-gray-600 rounded-xl focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                <User size={16} className="absolute left-4 text-slate-500" />
                <input
                  id="last_name"
                  type="text"
                  placeholder="Doe"
                  {...register("last_name")}
                  className="w-full pl-12 pr-4 py-2.5 bg-transparent text-sm md:text-[16px] text-gray-600 placeholder-slate-650 focus:outline-none"
                />
              </div>
              {errors.last_name && (
                <p className="text-[11px] text-red-400 font-medium pl-1">{errors.last_name.message}</p>
              )}
            </div>
          </div>

          {/* Email Address */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-600 md:text-[16px]" htmlFor="email">
              Email Address
            </label>
            <div className="relative flex items-center bg-gray-100 border border-gray-600 rounded-xl focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all">
              <Mail size={16} className="absolute left-4 text-slate-500" />
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                {...register("email")}
                className="w-full pl-12 pr-4 py-2.5 bg-transparent text-sm md:text-[16px] text-gray-600 placeholder-slate-650 focus:outline-none"
              />
            </div>
            {errors.email && (
              <p className="text-[11px] text-red-400 font-medium pl-1">{errors.email.message}</p>
            )}
          </div>

          {/* Phone Number */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-600 md:text-[16px]" htmlFor="phone">
              Phone Number
            </label>
            <div className="relative flex items-center bg-gray-100 border border-gray-600 rounded-xl focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all">
              <Phone size={16} className="absolute left-4 text-slate-500" />
              <input
                id="phone"
                type="text"
                placeholder="+234 80 1234 5678"
                {...register("phone")}
                className="w-full pl-12 pr-4 py-2.5 bg-transparent text-sm md:text-[16px] text-gray-600 placeholder-slate-650 focus:outline-none"
              />
            </div>
            {errors.phone && (
              <p className="text-[11px] text-red-400 font-medium pl-1">{errors.phone.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-600 md:text-[16px]" htmlFor="password">
              Password
            </label>
            <div className="relative flex items-center bg-gray-100 border border-gray-600 rounded-xl focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all">
              <Key size={16} className="absolute left-4 text-slate-500" />
              <input
                id="password"
                type="password"
                placeholder="Min 6 characters"
                {...register("password")}
                className="w-full pl-12 pr-4 py-2.5 bg-transparent text-smmd:text-[16px] text-gray-600 placeholder-slate-650 focus:outline-none"
              />
            </div>
            {errors.password && (
              <p className="text-[11px] text-red-400 font-medium pl-1">{errors.password.message}</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-hover py-3 font-semibold text-sm text-white shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none mt-2 md:text-[16px]"
          >
            {isLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <span>Sign Up</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Redirect */}
        <p className="text-xs text-center text-slate-500 mt-8 md:text-[16px]">
          Already have an account?{" "}
          <Link href="/login" className="text-primary font-bold hover:underline">
            Login Here
          </Link>
        </p>
      </div>
    </div>
  );
}
