"use client";

import React, { useState } from "react";
import { Menu, X, LogOut, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { useAuthSession } from "../hooks/use-auth-session";

const Navbar: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const { user, isLoggedIn, clearAuth, isReady } = useAuthSession();

    React.useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 20) {
                setIsScrolled(true);
            } else {
                setIsScrolled(false);
            }
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const navLinks = [
        { label: "Home", href: "#" },
        { label: "How It Works", href: "#how-it-works" },
        { label: "Suppliers", href: "#suppliers" },
        { label: "About", href: "#about" },
    ];

    const getDashboardPath = () => {
        if (!user) return "/";
        if (user.role === "ADMIN") return "/dashboard/admin";
        if (user.role === "FACILITY") return "/dashboard/facility";
        if (user.role === "DRIVER") return "/dashboard/driver";
        return "/";
    };

    return (
        <header className={`fixed top-0 z-50 w-full transition-all duration-300 ${isScrolled
            ? "bg-white backdrop-blur-md shadow-lg border-b border-slate-100 py-1"
            : "bg-transparent py-3"
            }`}>
            <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2f43ff] font-bold text-white">
                        M
                    </div>

                    <span className={`text-xl font-bold transition-colors ${isScrolled ? "text-slate-900" : "text-white"}`}>MT</span>
                </Link>

                {/* Desktop Links */}
                <div className="hidden items-center gap-8 md:flex">
                    {navLinks.map((link) => (
                        <a
                            key={link.label}
                            href={link.href}
                            className={`${isScrolled ? "text-slate-650 hover:text-brand" : "text-white hover:text-slate-200"} font-medium transition-colors`}
                        >
                            {link.label}
                        </a>
                    ))}
                </div>

                {/* Desktop CTA / Auth */}
                <div className="hidden md:flex items-center gap-4">
                    {isReady && isLoggedIn && user ? (
                        <>
                            <Link 
                                href={getDashboardPath()} 
                                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl transition-all border ${
                                    isScrolled 
                                        ? "border-slate-200 text-slate-700 hover:bg-slate-50" 
                                        : "border-white/20 text-white hover:bg-white/10"
                                }`}
                            >
                                <UserIcon size={14} />
                                <span>Dashboard</span>
                            </Link>
                            <button 
                                onClick={() => clearAuth()}
                                className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-red-500 hover:bg-red-600 text-white transition-all shadow-md active:scale-95"
                            >
                                <LogOut size={14} />
                                <span>Logout</span>
                            </button>
                        </>
                    ) : (
                        <>
                            <Link 
                                href="/login" 
                                className={`font-semibold text-sm transition-colors ${isScrolled ? "text-slate-700 hover:text-brand" : "text-white hover:text-slate-200"}`}
                            >
                                Log In
                            </Link>
                            <Link 
                                href="/register" 
                                className="rounded-xl bg-[#2f43ff] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:scale-105 hover:shadow-lg hover:brightness-110"
                            >
                                Sign Up
                            </Link>
                        </>
                    )}
                </div>

                {/* Mobile Toggle */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className={`rounded-lg p-2 md:hidden transition-colors ${isScrolled ? "text-slate-800" : "text-white"}`}
                    aria-label="Toggle menu"
                >
                    {isOpen ? <X size={26} /> : <Menu size={26} />}
                </button>
            </nav>

            {/* Mobile Menu */}
            <div
                className={`overflow-hidden transition-all duration-300 md:hidden ${isOpen ? "max-h-96" : "max-h-0"
                    }`}
            >
                <div className="space-y-1 bg-slate-900/95 border-t border-slate-800 px-4 py-5 backdrop-blur-md">
                    {navLinks.map((link) => (
                        <a
                            key={link.label}
                            href={link.href}
                            className="block rounded-lg px-4 py-3 font-medium text-slate-300 transition-colors hover:bg-slate-850 hover:text-white"
                            onClick={() => setIsOpen(false)}
                        >
                            {link.label}
                        </a>
                    ))}

                    <div className="pt-4 border-t border-slate-800 flex flex-col gap-3">
                        {isReady && isLoggedIn && user ? (
                            <>
                                <div className="text-slate-400 text-xs px-4">
                                  Logged in as: <span className="text-white font-semibold">{user.first_name}</span> ({user.role})
                                </div>
                                <Link
                                    href={getDashboardPath()}
                                    className="w-full text-center rounded-xl bg-slate-800 py-3 font-semibold text-white text-sm hover:bg-slate-750 transition-colors"
                                    onClick={() => setIsOpen(false)}
                                >
                                    Go to Dashboard
                                </Link>
                                <button 
                                    onClick={() => { clearAuth(); setIsOpen(false); }}
                                    className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-red-650 hover:bg-red-600 py-3 font-semibold text-white text-sm transition-colors"
                                >
                                    <LogOut size={14} />
                                    <span>Logout</span>
                                </button>
                            </>
                        ) : (
                            <>
                                <Link
                                    href="/login"
                                    className="w-full text-center rounded-xl bg-slate-800 py-3 font-semibold text-white text-sm hover:bg-slate-750 transition-colors"
                                    onClick={() => setIsOpen(false)}
                                >
                                    Log In
                                </Link>
                                <Link
                                    href="/register"
                                    className="w-full text-center rounded-xl bg-[#2f43ff] py-3 font-semibold text-white text-sm hover:brightness-110 transition-all"
                                    onClick={() => setIsOpen(false)}
                                >
                                    Sign Up
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Navbar;