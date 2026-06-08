"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthSession } from "../../hooks/use-auth-session";
import { apiFetch } from "../../lib/api-client";
import { Droplets, Key, Mail, AlertCircle, ArrowRight } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { setAuth, isLoggedIn, isReady } = useAuthSession();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  // Redirect if already logged in
  useEffect(() => {
    if (isReady && isLoggedIn) {
      router.push("/");
    }
  }, [isLoggedIn, isReady, router]);

  const onSubmit = async (data: LoginFormValues) => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await apiFetch("/auth/login", {
        method: "POST",
        json: data,
      });

      // Save credentials in Zustand Store
      setAuth(response.user, response.access_token);

      // Determine redirection based on role
      const role = response.user.role;
      if (role === "ADMIN") {
        router.push("/dashboard/admin");
      } else if (role === "FACILITY") {
        router.push("/dashboard/facility");
      } else if (role === "DRIVER") {
        router.push("/dashboard/driver");
      } else {
        router.push("/");
      }
    } catch (err: any) {
      setError(err.message || "Failed to log in. Please try again.");
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
    <div className="min-h-screen flex flex-col justify-center items-center bg-white px-4 relative overflow-hidden">


      <div className="w-full max-w-md bg-white/60 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl relative z-10 hover:border-primary/10 transition-all duration-300">
        {/* Logo and Headings */}
        <div className="flex flex-col items-center mb-8">
          <Link href="/" className="flex items-center gap-2 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary font-bold text-white text-lg shadow-lg shadow-primary/30">
              M
            </div>
            <span className="text-2xl font-black text-primary tracking-wide">
              Miri<span className="">Tankr</span>
            </span>
          </Link>
          <h2 className="text-xl font-bold text-gray-600">Welcome Back</h2>
          <p className="text-xs text-slate-500 mt-1 md:text-[16px]">Enugu State Water provenance and logistics portal</p>
        </div>

        {/* Global Error Notice */}
        {error && (
          <div className="mb-6 flex items-start gap-2 bg-red-950/40 border border-red-500/30 text-red-400 p-4 rounded-xl text-xs animate-shake">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Email field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-600 md:text-[16px]" htmlFor="email">
              Email Address
            </label>
            <div className="relative flex items-center bg-gray-100 border border-slate-800 rounded-xl focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all">
              <Mail size={16} className="absolute left-4 text-slate-500" />
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                {...register("email")}
                className="w-full pl-12 pr-4 py-3 bg-transparent md:text-[16px] text-sm text-gray-600 placeholder-slate-650 focus:outline-none"
              />
            </div>
            {errors.email && (
              <p className="text-[11px] text-red-400 font-medium pl-1">{errors.email.message}</p>
            )}
          </div>

          {/* Password field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-600 md:text-[16px]" htmlFor="password">
              Password
            </label>
            <div className="relative flex items-center bg-gray-100 border border-slate-800 rounded-xl focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all">
              <Key size={16} className="absolute left-4 text-slate-500" />
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register("password")}
                className="w-full pl-12 pr-4 py-3 bg-transparent md:text-[16px] text-sm text-gray-600 placeholder-slate-650 focus:outline-none"
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
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-hover py-3 font-semibold text-sm text-white shadow-lg shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none mt-2"
          >
            {isLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <span className="md:text-[16px] text-sm">Log In</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Redirect */}
        <p className="text-xs text-center text-slate-500 mt-8 md:text-[16px] text-sm">
          Don't have an account?{" "}
          <Link href="/register" className="text-primary font-bold hover:underline">
            Register Here
          </Link>
        </p>
      </div>
    </div>
  );
}
