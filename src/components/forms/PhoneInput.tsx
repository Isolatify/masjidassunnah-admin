"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CaretDown } from "@phosphor-icons/react";
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import type { AnswerValue, FormField } from "@/lib/forms";

interface Props {
  field: FormField;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
  variant: "jff" | "tf";
  invalid?: boolean;
}

interface CountryRow {
  iso: string;
  name: string;
  dial: string;
}

let cachedRows: CountryRow[] | null = null;

export function countryRows(): CountryRow[] {
  if (cachedRows) return cachedRows;
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    names = null;
  }
  const rows: CountryRow[] = [];
  for (const iso of getCountries()) {
    let name: string = iso;
    try {
      name = names?.of(iso) || iso;
    } catch {
      name = iso;
    }
    let dial = "";
    try {
      const code = getCountryCallingCode(iso as CountryCode);
      dial = code ? `+${code}` : "";
    } catch {
      dial = "";
    }
    rows.push({ iso, name, dial });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name));
  cachedRows = rows;
  return rows;
}

export function isoToFlag(iso: string): string {
  if (iso.length !== 2) return "🏳️";
  return String.fromCodePoint(
    ...[...iso.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  );
}

function codeOf(iso: string): string {
  try {
    const c = getCountryCallingCode(iso as CountryCode);
    return c ? `+${c}` : "";
  } catch {
    return "";
  }
}

function extractDigits(value: AnswerValue, iso: string): string {
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) return "";
  let body = s.replace(/^\+/, "");
  const code = (() => {
    try {
      return getCountryCallingCode(iso as CountryCode);
    } catch {
      return "";
    }
  })();
  if (code && body.replace(/\D/g, "").startsWith(code)) {
    body = body.replace(/\D/g, "").slice(code.length);
    return body;
  }
  return s.replace(/\D/g, "");
}

export default function PhoneInput({ field, value, onChange, variant, invalid }: Props) {
  const c = variant;
  const locked = field.allow_country_change === false;

  const initialIso = (() => {
    if (locked && field.phone_country) return field.phone_country.toUpperCase();
    const s = typeof value === "string" ? value.trim() : "";
    if (s.startsWith("+")) {
      try {
        const p = parsePhoneNumberFromString(s);
        if (p?.country) return p.country;
      } catch {
        /* ignore */
      }
    }
    return (field.phone_country || "au").toUpperCase();
  })();

  const [iso, setIso] = useState(initialIso);
  const [digits, setDigits] = useState(() => extractDigits(value, initialIso));
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  const rows = countryRows();
  const dial = codeOf(iso);
  const display = useMemo(() => new AsYouType(iso as CountryCode).input(digits), [iso, digits]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    const qDigits = q.replace(/\D/g, "");
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.iso.toLowerCase().includes(q) ||
        (qDigits.length > 0 && r.dial.replace("+", "").startsWith(qDigits))
    );
  }, [rows, query]);

  const emit = (nextIso: string, nextDigits: string) => {
    const formatted = new AsYouType(nextIso as CountryCode).input(nextDigits);
    const code = codeOf(nextIso).replace("+", "");
    onChange(nextDigits ? `+${code} ${formatted}` : "");
  };

  useEffect(() => {
    const t = window.setTimeout(() => {
      const target = extractDigits(value, iso);
      setDigits((d) => (d === target ? d : target));
    }, 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => searchRef.current?.focus(), 20);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [open]);

  const pick = (nextIso: string) => {
    setIso(nextIso);
    setOpen(false);
    setQuery("");
    emit(nextIso, digits);
  };

  const flag = (
    <span className="ph-flag">
      <span className="ph-flag-emoji" aria-hidden="true">
        {isoToFlag(iso)}
      </span>
      <img
        className="ph-flag-img"
        src={`https://flagcdn.com/w20/${iso.toLowerCase()}.png`}
        alt=""
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    </span>
  );

  return (
    <div className={`${c}-ph ph${locked ? " ph--locked" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="ph-pick"
        disabled={locked}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {flag}
        <span className="ph-code">{dial}</span>
        {!locked && <CaretDown size={13} className="ph-caret" />}
      </button>

      {open && (
        <div className="ph-pop" role="listbox">
          <input
            ref={searchRef}
            className="ph-search"
            value={query}
            placeholder="Search country or code…"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filtered.length > 0) {
                e.preventDefault();
                pick(filtered[0].iso);
              }
            }}
            aria-label="Search country"
          />
          <div className="ph-list">
            {filtered.map((r) => (
              <button
                type="button"
                key={r.iso}
                className={`ph-row${r.iso === iso ? " on" : ""}`}
                onClick={() => pick(r.iso)}
                role="option"
                aria-selected={r.iso === iso}
              >
                <span className="ph-flag">
                  <span className="ph-flag-emoji" aria-hidden="true">
                    {isoToFlag(r.iso)}
                  </span>
                  <img
                    className="ph-flag-img"
                    src={`https://flagcdn.com/w20/${r.iso.toLowerCase()}.png`}
                    alt=""
                    loading="lazy"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                </span>
                <span className="ph-name">{r.name}</span>
                <span className="ph-dial">{r.dial}</span>
              </button>
            ))}
            {filtered.length === 0 && <div className="ph-empty">No countries found</div>}
          </div>
        </div>
      )}

      <input
        className={`${c}-input ph-num${invalid ? " invalid" : ""}`}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={display}
        placeholder={field.placeholder || "Phone number"}
        aria-label={field.title}
        onChange={(e) => {
          const nd = e.target.value.replace(/\D/g, "");
          setDigits(nd);
          emit(iso, nd);
        }}
      />
    </div>
  );
}
