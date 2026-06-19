"use client";

import React, { useEffect, useRef, useState } from "react";

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  iconType: "source" | "driver" | "customer" | "default";
  popupText?: string;
}

interface MapComponentProps {
  markers?: MapMarker[];
  routeSegments?: [number, number][][]; // custom lines
  autoRouteFromDriverToSourceToCustomer?: {
    driver: { latitude: number; longitude: number } | null;
    source: { latitude: number; longitude: number } | null;
    customer: { latitude: number; longitude: number } | null;
  };
  onMapClick?: (latitude: number, longitude: number) => void;
  height?: string;
  interactive?: boolean;
  zoom?: number;
}

export default function MapComponent({
  markers = [],
  routeSegments = [],
  autoRouteFromDriverToSourceToCustomer,
  onMapClick,
  height = "350px",
  interactive = true,
  zoom = 13,
}: MapComponentProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersGroupRef = useRef<any>(null);
  const routeGroupRef = useRef<any>(null);
  const clickMarkerRef = useRef<any>(null);

  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [computedRoutes, setComputedRoutes] = useState<[number, number][][]>([]);

  // 1. Dynamic Script Loader
  useEffect(() => {
    if (typeof window === "undefined") return;

    const win = window as any;
    if (win.L) {
      setLeafletLoaded(true);
      return;
    }

    // Check if script is already injecting
    const existingScript = document.getElementById("leaflet-script");
    if (existingScript) {
      const handleLoad = () => setLeafletLoaded(true);
      existingScript.addEventListener("load", handleLoad);
      return () => {
        existingScript.removeEventListener("load", handleLoad);
      };
    }

    // Inject CSS stylesheet
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
    link.crossOrigin = "";
    document.head.appendChild(link);

    // Inject JavaScript script
    const script = document.createElement("script");
    script.id = "leaflet-script";
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
    script.crossOrigin = "";
    script.async = true;
    script.onload = () => {
      setLeafletLoaded(true);
    };

    document.head.appendChild(script);
  }, []);

  // 2. Fetch OSRM Road Routes if requested
  useEffect(() => {
    if (!autoRouteFromDriverToSourceToCustomer) {
      setComputedRoutes([]);
      return;
    }

    const { driver, source, customer } = autoRouteFromDriverToSourceToCustomer;
    if (!source || !customer) {
      setComputedRoutes([]);
      return;
    }

    const fetchRoadRoute = async (
      start: { latitude: number; longitude: number },
      end: { latitude: number; longitude: number }
    ): Promise<[number, number][]> => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.routes && data.routes.length > 0) {
            const coords = data.routes[0].geometry.coordinates;
            // OSRM returns [lon, lat], leaflet needs [lat, lon]
            return coords.map((c: any) => [c[1], c[0]]);
          }
        }
      } catch (err) {
        console.error("OSRM Route fetching failed, falling back to direct line:", err);
      }
      // Fallback to direct line
      return [
        [start.latitude, start.longitude],
        [end.latitude, end.longitude],
      ];
    };

    const loadRoutes = async () => {
      const segments: [number, number][][] = [];

      // Segment 1: Driver -> Source (if driver is set)
      if (driver) {
        const seg1 = await fetchRoadRoute(driver, source);
        segments.push(seg1);
      }

      // Segment 2: Source -> Customer
      const seg2 = await fetchRoadRoute(source, customer);
      segments.push(seg2);

      setComputedRoutes(segments);
    };

    loadRoutes();
  }, [autoRouteFromDriverToSourceToCustomer]);

  // 3. Map Initialization & Updates
  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current) return;
    const L = (window as any).L;

    // A. Init Map Instance
    if (!mapInstanceRef.current) {
      // Default center Enugu (6.44, 7.50)
      const defaultCenter = [6.442, 7.508];
      
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        scrollWheelZoom: interactive,
        doubleClickZoom: interactive,
        boxZoom: interactive,
        dragging: interactive,
      }).setView(defaultCenter, zoom);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      // Create overlay layers
      markersGroupRef.current = L.layerGroup().addTo(map);
      routeGroupRef.current = L.layerGroup().addTo(map);

      // Add Map click listener for coordinate picker
      if (onMapClick) {
        map.on("click", (e: any) => {
          const { lat, lng } = e.latlng;
          
          // Render a quick temporary pin
          if (clickMarkerRef.current) {
            clickMarkerRef.current.setLatLng(e.latlng);
          } else {
            const customerIcon = L.divIcon({
              html: `
                <div class="flex items-center justify-center w-8 h-8 rounded-full bg-rose-500 border-2 border-white shadow-lg text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              `,
              className: "",
              iconSize: [32, 32],
              iconAnchor: [16, 16],
            });
            clickMarkerRef.current = L.marker(e.latlng, { icon: customerIcon }).addTo(map);
          }
          
          onMapClick(lat, lng);
        });
      }

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;
    const routeGroup = routeGroupRef.current;

    // B. Clear past layers
    markersGroup.clearLayers();
    routeGroup.clearLayers();

    // Custom Icon Creators
    const createSourceIcon = () =>
      L.divIcon({
        html: `
          <div class="flex items-center justify-center w-9 h-9 rounded-full bg-blue-600 border-2 border-white shadow-xl text-white">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
            </svg>
          </div>
        `,
        className: "",
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

    const createDriverIcon = () =>
      L.divIcon({
        html: `
          <div class="flex items-center justify-center w-9 h-9 rounded-full bg-emerald-500 border-2 border-white shadow-xl text-white relative">
            <div class="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-60"></div>
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10h10zm0 0h4l3-3v-3h-7v6z" />
            </svg>
          </div>
        `,
        className: "",
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

    const createCustomerIcon = () =>
      L.divIcon({
        html: `
          <div class="flex items-center justify-center w-9 h-9 rounded-full bg-rose-500 border-2 border-white shadow-xl text-white">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
        `,
        className: "",
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

    const createDefaultIcon = () =>
      L.divIcon({
        html: `
          <div class="flex items-center justify-center w-8 h-8 rounded-full bg-slate-500 border-2 border-white shadow-lg text-white">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        `,
        className: "",
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

    // C. Draw Markers
    const bounds = L.latLngBounds([]);

    markers.forEach((m) => {
      if (m.latitude === null || m.longitude === null) return;
      
      let icon = createDefaultIcon();
      if (m.iconType === "source") icon = createSourceIcon();
      else if (m.iconType === "driver") icon = createDriverIcon();
      else if (m.iconType === "customer") icon = createCustomerIcon();

      const marker = L.marker([m.latitude, m.longitude], { icon }).addTo(markersGroup);
      
      if (m.popupText) {
        marker.bindPopup(`<strong class="text-slate-800 text-xs">${m.title}</strong><p class="text-[10px] text-slate-550 mt-1 leading-snug">${m.popupText}</p>`);
      } else {
        marker.bindPopup(`<strong class="text-slate-800 text-xs">${m.title}</strong>`);
      }

      bounds.extend([m.latitude, m.longitude]);
    });

    // D. Draw Lines (Explicit routeSegments or computedRoutes)
    const linesToDraw = routeSegments.length > 0 ? routeSegments : computedRoutes;

    linesToDraw.forEach((coords, index) => {
      if (coords.length < 2) return;

      // Color coding: segment 0 (driver to source) is dashed emerald, segment 1 (source to customer) is blue
      const isDriverToSourceSegment = linesToDraw.length > 1 && index === 0;
      const color = isDriverToSourceSegment ? "#10b981" : "#2f43ff";
      const dashArray = isDriverToSourceSegment ? "5, 8" : "";

      const polyline = L.polyline(coords, {
        color,
        weight: 4,
        opacity: 0.8,
        dashArray,
      }).addTo(routeGroup);

      coords.forEach((coord) => bounds.extend(coord));
    });

    // E. Auto-adjust Map Fit Bounds
    if (bounds.isValid() && (markers.length > 1 || linesToDraw.length > 0)) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    } else if (markers.length === 1) {
      map.setView([markers[0].latitude, markers[0].longitude], zoom);
    }

  }, [leafletLoaded, markers, routeSegments, computedRoutes, zoom, interactive, onMapClick]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={mapContainerRef}
      style={{ height, width: "100%" }}
      className="bg-slate-100 rounded-3xl overflow-hidden border border-slate-200 shadow-inner z-0 relative"
    />
  );
}
