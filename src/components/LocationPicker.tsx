"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";

interface LocationPickerProps {
  value: string;
  onChange: (location: string, lat?: number, lng?: number) => void;
}

declare global {
  interface Window {
    google: typeof import("@googlemaps/google-maps-services-js");
    initGoogleMapsPicker?: () => void;
  }
}

interface Prediction {
  description: string;
  place_id: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
}

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-ink)",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
};

export default function LocationPicker({ value, onChange }: LocationPickerProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "";
  const hasKey = Boolean(apiKey && apiKey !== "YOUR_KEY_HERE");

  const [query, setQuery] = useState(value);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selected, setSelected] = useState<{ lat: number; lng: number } | null>(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const mapsError = loadFailed || !hasKey;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const markerInstance = useRef<google.maps.Marker | null>(null);

  // Load Google Maps JS API
  useEffect(() => {
    if (!hasKey) {
      return;
    }
    if (window.google?.maps) {
      queueMicrotask(() => setMapsLoaded(true));
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMapsPicker`;
    script.async = true;
    script.defer = true;

    window.initGoogleMapsPicker = () => {
      setMapsLoaded(true);
    };

    script.onerror = () => setLoadFailed(true);
    document.head.appendChild(script);

    return () => {
      delete window.initGoogleMapsPicker;
    };
  }, [apiKey, hasKey]);

  // Initialize autocomplete service once maps is loaded
  useEffect(() => {
    if (mapsLoaded && window.google?.maps?.places) {
      autocompleteService.current = new google.maps.places.AutocompleteService();
    }
  }, [mapsLoaded]);

  // Click outside handler
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Init or update map
  useEffect(() => {
    if (!mapsLoaded || !mapContainerRef.current || !selected) return;

    if (!mapInstance.current) {
      mapInstance.current = new google.maps.Map(mapContainerRef.current, {
        center: selected,
        zoom: 16,
        disableDefaultUI: true,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        styles: [
          { elementType: "geometry", stylers: [{ color: "#f2f5f1" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#3a3f3c" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
          { featureType: "water", elementType: "geometry", stylers: [{ color: "#d4e8dc" }] },
          { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
          { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#5a6058" }] },
          { featureType: "poi", elementType: "geometry", stylers: [{ color: "#ecf1ea" }] },
          { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#026839" }] },
          { featureType: "transit", elementType: "geometry", stylers: [{ color: "#e6ece5" }] },
          { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#eef3ee" }] },
        ],
      });
      markerInstance.current = new google.maps.Marker({
        position: selected,
        map: mapInstance.current,
        animation: google.maps.Animation.DROP,
      });
    } else {
      mapInstance.current.panTo(selected);
      markerInstance.current?.setPosition(selected);
    }
  }, [mapsLoaded, selected]);

  const search = useCallback(
    (q: string) => {
      if (!autocompleteService.current || q.length < 3) {
        setPredictions([]);
        setShowDropdown(false);
        return;
      }

      autocompleteService.current.getPlacePredictions(
        {
          input: q,
          componentRestrictions: { country: "au" },
          types: ["establishment", "geocode"],
        },
        (preds) => {
          if (preds) {
            setPredictions(preds as unknown as Prediction[]);
            setShowDropdown(preds.length > 0);
          }
        }
      );
    },
    []
  );

  function handleInputChange(val: string) {
    setQuery(val);
    onChange(val);
    setSelected(null);
    if (mapInstance.current) {
      mapInstance.current = null;
      markerInstance.current = null;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  }

  function handleSelect(pred: Prediction) {
    const display = pred.description;
    setQuery(display);
    setShowDropdown(false);
    setPredictions([]);

    // Use Places Details to get lat/lng
    if (window.google?.maps?.places) {
      const service = new google.maps.places.PlacesService(document.createElement("div"));
      service.getDetails({ placeId: pred.place_id }, (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          setSelected({ lat, lng });
          onChange(display, lat, lng);
        } else {
          onChange(display);
        }
      });
    } else {
      onChange(display);
    }
  }

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => predictions.length > 0 && setShowDropdown(true)}
        placeholder={hasKey ? "Search for a location..." : "Enter location manually..."}
        style={INPUT_STYLE}
      />

      {showDropdown && predictions.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 4,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: 12,
            overflow: "hidden",
            zIndex: 100,
            maxHeight: 260,
            overflowY: "auto",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {predictions.map((pred) => (
            <div
              key={pred.place_id}
              onClick={() => handleSelect(pred)}
              style={{
                padding: "12px 14px",
                cursor: "pointer",
                borderBottom: "1px solid var(--color-border-soft)",
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-primary-mist)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ fontSize: 13, color: "var(--color-ink)", fontWeight: 500 }}>
                {pred.structured_formatting?.main_text || pred.description}
              </div>
              {pred.structured_formatting?.secondary_text && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  {pred.structured_formatting.secondary_text}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div
          style={{
            marginTop: 12,
            borderRadius: 12,
            overflow: "hidden",
            border: "1px solid var(--card-border)",
          }}
        >
          <div
            ref={mapContainerRef}
            style={{ width: "100%", height: 200 }}
          />
          <div
            style={{
              padding: "8px 14px",
              background: "var(--color-bg)",
              fontSize: 11,
              color: "var(--color-muted)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>{query.length > 55 ? query.slice(0, 55) + "..." : query}</span>
            <span style={{ fontFamily: "monospace" }}>
              {selected.lat.toFixed(4)}, {selected.lng.toFixed(4)}
            </span>
          </div>
        </div>
      )}

      {!selected && !showDropdown && mapsError && (
        <div
          style={{
            marginTop: 8,
            padding: "8px 12px",
            borderRadius: 8,
            background: "var(--color-bg)",
            fontSize: 12,
            color: "var(--color-muted)",
          }}
        >
          Google Maps API key not configured. Enter location manually or add key to <code>.env.local</code>
        </div>
      )}
    </div>
  );
}
