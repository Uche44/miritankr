"use client";

import React, { useState } from "react";
import Navbar from "../components/navbar";
import Hero from "../components/homepage/hero";
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
  Truck
} from "lucide-react";

export default function Home() {
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const suppliers = [
    {
      id: "borneo-water",
      name: "Borneo Water Services",
      rating: 4.9,
      reviews: 142,
      deliveries: 480,
      price: "RM 150",
      speed: "Under 90 mins",
      certified: true,
      tag: "Best Value",
    },
    {
      id: "miri-clean-aqua",
      name: "Miri Clean Aqua",
      rating: 4.8,
      reviews: 98,
      deliveries: 320,
      price: "RM 160",
      speed: "Under 60 mins",
      certified: true,
      tag: "Fastest Delivery",
    },
    {
      id: "sarawak-bulk-water",
      name: "Sarawak Bulk Water Ltd.",
      rating: 4.7,
      reviews: 215,
      deliveries: 950,
      price: "RM 140",
      speed: "Within 3 hours",
      certified: true,
      tag: "Bulk Specialist",
    }
  ];

  const steps = [
    {
      icon: <MapPin className="text-primary" size={24} />,
      title: "Pin Your Location",
      desc: "Specify your home, business, or site location in Miri. Our system maps out nearest active tankers."
    },
    {
      icon: <Droplets className="text-primary" size={24} />,
      title: "Choose Tanker Size",
      desc: "Select from standard domestic tanks (10,000L) to bulk industrial supplies based on your needs."
    },
    {
      icon: <Clock className="text-primary" size={24} />,
      title: "Fast Delivery",
      desc: "Connect instantly with a verified supplier. Track your order and pay securely upon delivery."
    }
  ];

  const faqs = [
    {
      q: "Where does the water come from?",
      a: "All our suppliers source water directly from certified municipal treatment facilities and treated reservoirs in Sarawak. Every source undergoes regular quality checks to guarantee safety."
    },
    {
      q: "How fast is delivery?",
      a: "Our average delivery time in Miri is between 60 to 90 minutes. However, during periods of water disruptions or high demand, times may vary. You will receive an estimated time before booking."
    },
    {
      q: "Can I schedule recurring water deliveries?",
      a: "Yes! You can set up scheduled deliveries (weekly, bi-weekly, or monthly) for commercial or residential pools, tanks, or sites. Contact our support desk for custom recurring packages."
    },
    {
      q: "What payment methods do you accept?",
      a: "We accept Cash on Delivery (COD), DuitNow QR, and local bank transfers. You only pay after the tanker arrives and begins discharging the water."
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-800 font-sans">
      <Navbar />
      
      <main className="flex-grow">
        {/* Hero Section */}
        <Hero />

        {/* How It Works Section */}
        <section id="how-it-works" className="py-20 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-base font-semibold text-primary uppercase tracking-wider">Process</h2>
              <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                How MiriTankr Works
              </p>
              <p className="mt-4 text-lg text-slate-500">
                Ordering water should not be complicated. We make the entire matching and delivery process seamless in three simple steps.
              </p>
            </div>

            <div className="grid gap-10 md:grid-cols-3">
              {steps.map((step, idx) => (
                <div key={idx} className="relative group bg-slate-50 p-8 rounded-2xl border border-slate-100 hover:border-blue-100 transition-all hover:shadow-md hover:-translate-y-1">
                  <div className="absolute top-6 right-6 text-4xl font-extrabold text-slate-200/60 group-hover:text-blue-100 transition-colors">
                    0{idx + 1}
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm border border-slate-100 mb-6">
                    {step.icon}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Active Suppliers Section */}
        <section id="suppliers" className="py-20 bg-slate-50">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-base font-semibold text-primary uppercase tracking-wider">Suppliers</h2>
              <p className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                Verified Local Suppliers in Miri
              </p>
              <p className="mt-4 text-lg text-slate-500">
                Choose from our network of top-rated, certified water truck operators. Clear rates, prompt service.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              {suppliers.map((supplier) => (
                <div 
                  key={supplier.id} 
                  className={`bg-white rounded-2xl shadow-sm border transition-all flex flex-col justify-between overflow-hidden relative ${
                    selectedSupplier === supplier.id 
                      ? "border-primary ring-2 ring-primary/20 shadow-md scale-[1.01]" 
                      : "border-slate-100 hover:border-slate-350 hover:shadow-md"
                  }`}
                >
                  {/* Tag banner */}
                  <div className="absolute top-4 right-4">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full bg-blue-50 text-primary border border-blue-100/50">
                      {supplier.tag}
                    </span>
                  </div>

                  <div className="p-6 flex-grow">
                    <h3 className="text-lg font-bold text-slate-900 pr-20">{supplier.name}</h3>
                    
                    {/* Rating */}
                    <div className="flex items-center gap-1.5 mt-2">
                      <div className="flex text-amber-400">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} size={14} fill="currentColor" />
                        ))}
                      </div>
                      <span className="text-xs font-semibold text-slate-700">{supplier.rating}</span>
                      <span className="text-xs text-slate-400">({supplier.reviews} reviews)</span>
                    </div>

                    <div className="mt-6 space-y-3 border-t border-slate-50 pt-5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">Average Speed:</span>
                        <span className="font-semibold text-slate-800 flex items-center gap-1">
                          <Clock size={12} className="text-slate-450" /> {supplier.speed}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">Total Deliveries:</span>
                        <span className="font-semibold text-slate-800 flex items-center gap-1">
                          <Truck size={12} className="text-slate-450" /> {supplier.deliveries}+
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">Quality Certificate:</span>
                        <span className="font-semibold text-emerald-600 flex items-center gap-1">
                          <ShieldCheck size={12} /> Approved
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Pricing and Action */}
                  <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-between mt-auto">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-medium">Standard Tank Rate</span>
                      <span className="text-xl font-bold text-slate-900">{supplier.price}</span>
                    </div>
                    <button 
                      onClick={() => setSelectedSupplier(supplier.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        selectedSupplier === supplier.id
                          ? "bg-primary text-white shadow-sm"
                          : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {selectedSupplier === supplier.id ? "Selected" : "Select operator"}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Quote Form if Selected */}
            {selectedSupplier && (
              <div className="mt-12 max-w-2xl mx-auto bg-white border border-primary/20 rounded-2xl p-6 shadow-lg animate-fadeIn">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">Send Water Request</h3>
                    <p className="text-xs text-slate-500">To: <span className="font-semibold text-primary">{suppliers.find(s => s.id === selectedSupplier)?.name}</span></p>
                  </div>
                  <button 
                    onClick={() => setSelectedSupplier(null)} 
                    className="text-xs text-slate-400 hover:text-slate-600 font-medium"
                  >
                    Cancel
                  </button>
                </div>

                {requestSubmitted ? (
                  <div className="text-center py-6">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-500 mb-4">
                      <CheckCircle size={28} />
                    </div>
                    <h4 className="font-bold text-slate-800 text-base">Request Submitted Successfully!</h4>
                    <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto">
                      Your supplier is reviewing the dispatch. You will receive a phone call and SMS confirmation within 5 minutes.
                    </p>
                    <button 
                      onClick={() => {
                        setRequestSubmitted(false);
                        setSelectedSupplier(null);
                      }} 
                      className="mt-6 px-5 py-2 bg-slate-950 text-white font-semibold rounded-xl text-xs hover:bg-slate-800 transition-colors"
                    >
                      Done
                    </button>
                  </div>
                ) : (
                  <form onSubmit={(e) => { e.preventDefault(); setRequestSubmitted(true); }} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Full Name</label>
                        <input required type="text" placeholder="John Doe" className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Phone Number</label>
                        <input required type="tel" placeholder="+60 12-345 6789" className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">Delivery Address</label>
                      <textarea required rows={2} placeholder="E.g., Lot 1234, Lutong, 98000 Miri, Sarawak" className="w-full text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 resize-none"></textarea>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-slate-400">Payment Due: Pay upon delivery</span>
                      <button type="submit" className="px-6 py-3 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-md transition-all hover:scale-[1.02]">
                        Confirm Tanker Order
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </section>

        {/* About / FAQ Section */}
        <section id="about" className="py-20 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
              {/* Left Column: Brief Brand Intro */}
              <div className="lg:col-span-5 flex flex-col justify-center">
                <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-xs font-semibold text-primary mb-6 w-fit">
                  <Award size={14} />
                  Miri's Dedicated Water Network
                </div>
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl">
                  Keeping Miri Flowing
                </h2>
                <p className="mt-4 text-slate-500 leading-relaxed text-sm">
                  MiriTankr was born out of a simple need: to provide a quick, transparent, and dependable solution for water deliveries in Miri. Whether it's dry seasons, maintenance shutdowns, or commercial building needs, we ensure you stay connected with active water truck fleets.
                </p>
                <div className="mt-8 space-y-4">
                  <div className="flex gap-3">
                    <CheckCircle className="text-primary shrink-0" size={20} />
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Priority Deliveries</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Automated queue matching prioritizes emergency requests.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <CheckCircle className="text-primary shrink-0" size={20} />
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Verified Operator Safety</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Rigorous inspection of water trucks and driver certifications.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Interactive Accordion FAQs */}
              <div className="lg:col-span-7 flex flex-col justify-center">
                <h3 className="text-2xl font-bold text-slate-900 mb-6">Frequently Asked Questions</h3>
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
                        className={`transition-all duration-300 overflow-hidden ${
                          activeFaq === idx ? "max-h-40 border-t border-slate-100 bg-white" : "max-h-0"
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

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 py-12 border-t border-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 md:grid-cols-4 pb-8 border-b border-slate-900">
            {/* Column 1: Brand */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-bold text-white text-sm">
                  M
                </div>
                <span className="text-lg font-bold text-white">MiriTankr</span>
              </div>
              <p className="text-xs leading-relaxed max-w-xs">
                Miri's online portal for reliable, on-demand water truck dispatch. Helping homes and businesses stay hydrated.
              </p>
            </div>
            
            {/* Column 2: Quick Links */}
            <div>
              <h4 className="text-white font-bold text-sm mb-4">Service Locations</h4>
              <ul className="space-y-2 text-xs">
                <li>Lutong, Miri</li>
                <li>Senadin, Miri</li>
                <li>Piasau, Miri</li>
                <li>Riam & Lopeng, Miri</li>
              </ul>
            </div>

            {/* Column 3: Contact */}
            <div>
              <h4 className="text-white font-bold text-sm mb-4">Support</h4>
              <ul className="space-y-2 text-xs">
                <li className="flex items-center gap-2"><Phone size={12} /> +60 85-444 888</li>
                <li className="flex items-center gap-2"><Mail size={12} /> help@miritankr.com</li>
              </ul>
            </div>

            {/* Column 4: Newsletter/Promo */}
            <div>
              <h4 className="text-white font-bold text-sm mb-4">Stay Notified</h4>
              <p className="text-xs mb-3">Sign up to get water disruption warnings & system announcements.</p>
              <div className="flex gap-2">
                <input type="email" placeholder="Email Address" className="bg-slate-900 text-white placeholder-slate-500 border border-slate-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary w-full" />
                <button className="bg-primary hover:bg-primary-hover text-white px-3 py-2 rounded-lg text-xs font-semibold">Join</button>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center pt-8 text-[11px]">
            <p>&copy; {new Date().getFullYear()} MiriTankr. All rights reserved. Made in Sarawak, Malaysia.</p>
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
