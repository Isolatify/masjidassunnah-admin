"use client";

import { useState, useCallback } from "react";
import {
  Plus,
  X,
  CalendarDots,
  Clock,
  Repeat,
} from "@phosphor-icons/react";

const DATE_TYPES = [
  { value: "single", label: "Single Date" },
  { value: "range", label: "Date Range" },
  { value: "multi", label: "Multiple Dates" },
  { value: "recurring", label: "Recurring" },
] as const;

const PRAYER_OPTIONS = ["After Fajr", "After Dhuhr", "After Asr", "After Maghrib", "After Isha"];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface DateEntry {
  display: string;
  date_start: string;
  date_end: string | null;
  date_type: string;
  recurring_pattern: string | null;
  time_start: string | null;
  time_end: string | null;
  after_prayer: string | null;
  all_day: boolean;
  weekdays: string[] | null;
}

interface DateEditorProps {
  dates: DateEntry[];
  onChange: (dates: DateEntry[]) => void;
}

const EMPTY_SINGLE: DateEntry = {
  display: "",
  date_start: "",
  date_end: null,
  date_type: "single",
  recurring_pattern: null,
  time_start: null,
  time_end: null,
  after_prayer: null,
  all_day: false,
  weekdays: null,
};

export default function DateEditor({ dates, onChange }: DateEditorProps) {
  const [mode, setMode] = useState<"single" | "range" | "multi" | "recurring">("single");
  const [draft, setDraft] = useState<DateEntry>({ ...EMPTY_SINGLE });
  const [multiDates, setMultiDates] = useState<DateEntry[]>([]);
  const [recurringType, setRecurringType] = useState<"daily" | "weekly" | "monthly" | "yearly" | "custom">("weekly");

  const updateDraft = useCallback((patch: Partial<DateEntry>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const buildDisplay = useCallback((entry: DateEntry): string => {
    if (entry.after_prayer) {
      const dateStr = entry.date_start
        ? new Date(entry.date_start + "T12:00:00").toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
        : "";
      return `${dateStr}, ${entry.after_prayer}`;
    }
    if (entry.all_day) {
      if (entry.date_end) {
        const s = new Date(entry.date_start + "T12:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" });
        const e = new Date(entry.date_end + "T12:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
        return `${s} – ${e} (All Day)`;
      }
      const d = new Date(entry.date_start + "T12:00:00").toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
      return `${d} (All Day)`;
    }
    if (entry.time_start) {
      const timeStr = entry.time_end ? `${entry.time_start} – ${entry.time_end}` : entry.time_start;
      if (entry.date_end) {
        const s = new Date(entry.date_start + "T12:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short" });
        const e = new Date(entry.date_end + "T12:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
        return `${s} – ${e}, ${timeStr}`;
      }
      const d = new Date(entry.date_start + "T12:00:00").toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
      return `${d}, ${timeStr}`;
    }
    if (entry.date_start) {
      return new Date(entry.date_start + "T12:00:00").toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    }
    return "";
  }, []);

  const buildRecurringPattern = useCallback((entry: DateEntry): string | null => {
    if (entry.date_type !== "recurring") return null;
    const dayName = entry.date_start
      ? new Date(entry.date_start + "T12:00:00").toLocaleDateString("en-AU", { weekday: "long" })
      : "";
    if (entry.recurring_pattern === "daily") return "Daily";
    if (entry.recurring_pattern === "weekly") return `Every ${dayName}`;
    if (entry.recurring_pattern === "monthly") return "Monthly";
    if (entry.recurring_pattern === "yearly") return "Yearly";
    if (entry.recurring_pattern === "custom" && entry.weekdays?.length) {
      return `Every ${entry.weekdays.join(", ")}`;
    }
    return entry.recurring_pattern;
  }, []);

  const handleAddSingle = useCallback(() => {
    if (!draft.date_start) return;
    const entry = { ...draft, date_type: mode, recurring_pattern: buildRecurringPattern(draft), display: "" };
    entry.display = buildDisplay(entry);
    if (mode === "multi") {
      setMultiDates((prev) => [...prev, entry]);
      setDraft({ ...EMPTY_SINGLE });
    } else {
      onChange([...dates, entry]);
      setDraft({ ...EMPTY_SINGLE });
    }
  }, [draft, mode, dates, onChange, buildDisplay, buildRecurringPattern]);

  const handleAddMultiBatch = useCallback(() => {
    if (multiDates.length === 0) return;
    const withDisplay = multiDates.map((d) => ({ ...d, display: buildDisplay(d) }));
    onChange([...dates, ...withDisplay]);
    setMultiDates([]);
    setDraft({ ...EMPTY_SINGLE });
  }, [multiDates, dates, onChange, buildDisplay]);

  const removeDate = useCallback((index: number) => {
    onChange(dates.filter((_, i) => i !== index));
  }, [dates, onChange]);

  const isTimeDisabled = draft.all_day;
  const isPrayerMode = !!draft.after_prayer;
  const isCustomWeekdays = mode === "recurring" && recurringType === "custom";

  return (
    <div>
      {/* Mode tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {DATE_TYPES.map((dt) => (
          <button
            key={dt.value}
            onClick={() => { setMode(dt.value); setDraft({ ...EMPTY_SINGLE }); }}
            style={{
              padding: "7px 14px", borderRadius: 9999,
              border: `1px solid ${mode === dt.value ? "var(--color-primary)" : "var(--color-border)"}`,
              background: mode === dt.value ? "var(--color-primary)" : "var(--color-surface)",
              color: mode === dt.value ? "white" : "var(--color-muted)",
              fontSize: 11, fontWeight: 700, cursor: "pointer",
              fontFamily: "var(--font-heading)", letterSpacing: "0.06em",
              textTransform: "uppercase" as const, transition: "all 0.15s",
            }}
          >
            {dt.label}
          </button>
        ))}
      </div>

      {/* Single / Range / Recurring form */}
      {mode !== "multi" && (
        <div style={{
          padding: 20, borderRadius: 14,
          background: "var(--color-bg)", border: "1px solid var(--color-border-soft)",
        }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={LABEL_STYLE}>{mode === "range" ? "Start Date" : "Date"}</label>
              <input
                type="date"
                value={draft.date_start}
                onChange={(e) => updateDraft({ date_start: e.target.value })}
                style={INPUT_STYLE}
              />
            </div>
            {mode === "range" && (
              <div style={{ flex: 1 }}>
                <label style={LABEL_STYLE}>End Date</label>
                <input
                  type="date"
                  value={draft.date_end || ""}
                  onChange={(e) => updateDraft({ date_end: e.target.value || null })}
                  style={INPUT_STYLE}
                />
              </div>
            )}
            {mode === "recurring" && (
              <div style={{ flex: 1 }}>
                <label style={LABEL_STYLE}>Repeat</label>
                <select
                  value={recurringType}
                  onChange={(e) => {
                    setRecurringType(e.target.value as typeof recurringType);
                    updateDraft({ recurring_pattern: e.target.value, weekdays: null });
                  }}
                  style={INPUT_STYLE}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                  <option value="custom">Custom Weekdays</option>
                </select>
              </div>
            )}
          </div>

          {/* Custom weekdays */}
          {isCustomWeekdays && (
            <div style={{ marginBottom: 12 }}>
              <label style={LABEL_STYLE}>Repeat on</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {WEEKDAYS.map((day) => {
                  const active = draft.weekdays?.includes(day);
                  return (
                    <button
                      key={day}
                      onClick={() => {
                        const current = draft.weekdays || [];
                        const next = active ? current.filter((d) => d !== day) : [...current, day];
                        updateDraft({ weekdays: next.length > 0 ? next : null });
                      }}
                      style={{
                        width: 40, height: 40, borderRadius: 10,
                        border: `1px solid ${active ? "var(--color-primary)" : "var(--color-border)"}`,
                        background: active ? "var(--color-primary)" : "var(--color-surface)",
                        color: active ? "white" : "var(--color-muted)",
                        fontSize: 11, fontWeight: 700, cursor: "pointer",
                        fontFamily: "var(--font-heading)",
                      }}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* All Day toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <button
              onClick={() => updateDraft({ all_day: !draft.all_day })}
              style={{
                width: 40, height: 22, borderRadius: 11,
                border: "none", cursor: "pointer", position: "relative",
                background: draft.all_day ? "var(--color-primary)" : "var(--color-border)",
                transition: "background 0.2s",
              }}
            >
              <span style={{
                position: "absolute", top: 2, left: draft.all_day ? 20 : 2,
                width: 18, height: 18, borderRadius: "50%",
                background: "white", transition: "left 0.2s",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }} />
            </button>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-ink)" }}>All Day Event</span>
          </div>

          {/* Time fields (hidden when all_day or prayer mode) */}
          {!draft.all_day && (
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={LABEL_STYLE}>Start Time</label>
                <input
                  type="time"
                  value={draft.time_start || ""}
                  onChange={(e) => updateDraft({ time_start: e.target.value || null })}
                  disabled={isPrayerMode}
                  style={{ ...INPUT_STYLE, opacity: isPrayerMode ? 0.4 : 1 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={LABEL_STYLE}>End Time</label>
                <input
                  type="time"
                  value={draft.time_end || ""}
                  onChange={(e) => updateDraft({ time_end: e.target.value || null })}
                  disabled={isPrayerMode}
                  style={{ ...INPUT_STYLE, opacity: isPrayerMode ? 0.4 : 1 }}
                />
              </div>
            </div>
          )}

          {/* Prayer time option */}
          {!draft.all_day && (
            <div style={{ marginBottom: 14 }}>
              <label style={LABEL_STYLE}>Or select after prayer</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {PRAYER_OPTIONS.map((p) => {
                  const active = draft.after_prayer === p;
                  return (
                    <button
                      key={p}
                      onClick={() => updateDraft({ after_prayer: active ? null : p })}
                      style={{
                        padding: "6px 12px", borderRadius: 9999,
                        border: `1px solid ${active ? "var(--color-gold)" : "var(--color-border)"}`,
                        background: active ? "var(--color-gold-soft)" : "var(--color-surface)",
                        color: active ? "var(--color-gold-deep)" : "var(--color-muted)",
                        fontSize: 11, fontWeight: 600, cursor: "pointer",
                        fontFamily: "var(--font-heading)", letterSpacing: "0.04em",
                        transition: "all 0.15s",
                      }}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Preview */}
          {draft.date_start && (
            <div style={{
              padding: "10px 14px", borderRadius: 10, marginBottom: 14,
              background: "var(--color-surface)", border: "1px solid var(--color-border-soft)",
              fontSize: 13, color: "var(--color-ink)", fontWeight: 500,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <CalendarDots size={16} weight="duotone" color="var(--color-primary)" />
              {buildDisplay(draft)}
            </div>
          )}

          {/* Add button */}
          <button
            onClick={handleAddSingle}
            disabled={!draft.date_start}
            style={{
              padding: "10px 18px", borderRadius: 10, border: "none",
              background: draft.date_start ? "var(--color-primary)" : "var(--color-border)",
              color: draft.date_start ? "white" : "var(--color-muted)",
              fontSize: 12, fontWeight: 600, cursor: draft.date_start ? "pointer" : "default",
              fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <Plus size={14} /> Add {mode === "range" ? "Date Range" : mode === "recurring" ? "Recurring Date" : "Date"}
          </button>
        </div>
      )}

      {/* Multiple dates mode */}
      {mode === "multi" && (
        <div style={{
          padding: 20, borderRadius: 14,
          background: "var(--color-bg)", border: "1px solid var(--color-border-soft)",
        }}>
          {/* Date fields */}
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={LABEL_STYLE}>Date</label>
              <input
                type="date"
                value={draft.date_start}
                onChange={(e) => updateDraft({ date_start: e.target.value })}
                style={INPUT_STYLE}
              />
            </div>
          </div>

          {/* All Day toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <button
              onClick={() => updateDraft({ all_day: !draft.all_day })}
              style={{
                width: 40, height: 22, borderRadius: 11,
                border: "none", cursor: "pointer", position: "relative",
                background: draft.all_day ? "var(--color-primary)" : "var(--color-border)",
                transition: "background 0.2s",
              }}
            >
              <span style={{
                position: "absolute", top: 2, left: draft.all_day ? 20 : 2,
                width: 18, height: 18, borderRadius: "50%",
                background: "white", transition: "left 0.2s",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }} />
            </button>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--color-ink)" }}>All Day</span>
          </div>

          {/* Time fields */}
          {!draft.all_day && (
            <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={LABEL_STYLE}>Start Time</label>
                <input type="time" value={draft.time_start || ""} onChange={(e) => updateDraft({ time_start: e.target.value || null })} disabled={isPrayerMode} style={{ ...INPUT_STYLE, opacity: isPrayerMode ? 0.4 : 1 }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={LABEL_STYLE}>End Time</label>
                <input type="time" value={draft.time_end || ""} onChange={(e) => updateDraft({ time_end: e.target.value || null })} disabled={isPrayerMode} style={{ ...INPUT_STYLE, opacity: isPrayerMode ? 0.4 : 1 }} />
              </div>
            </div>
          )}

          {/* Prayer option */}
          {!draft.all_day && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              {PRAYER_OPTIONS.map((p) => {
                const active = draft.after_prayer === p;
                return (
                  <button
                    key={p}
                    onClick={() => updateDraft({ after_prayer: active ? null : p })}
                    style={{
                      padding: "5px 10px", borderRadius: 9999,
                      border: `1px solid ${active ? "var(--color-gold)" : "var(--color-border)"}`,
                      background: active ? "var(--color-gold-soft)" : "var(--color-surface)",
                      color: active ? "var(--color-gold-deep)" : "var(--color-muted)",
                      fontSize: 10, fontWeight: 600, cursor: "pointer",
                      fontFamily: "var(--font-heading)", letterSpacing: "0.04em",
                    }}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                if (!draft.date_start) return;
                const entry = { ...draft, date_type: "multi", recurring_pattern: null, display: "" };
                entry.display = buildDisplay(entry);
                setMultiDates((prev) => [...prev, entry]);
                setDraft({ ...EMPTY_SINGLE });
              }}
              disabled={!draft.date_start}
              style={{
                flex: 1, padding: "10px", borderRadius: 10, border: "none",
                background: draft.date_start ? "var(--color-primary)" : "var(--color-border)",
                color: draft.date_start ? "white" : "var(--color-muted)",
                fontSize: 12, fontWeight: 600, cursor: draft.date_start ? "pointer" : "default",
                fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
            >
              <Plus size={14} /> Add to List
            </button>
            {multiDates.length > 0 && (
              <button
                onClick={handleAddMultiBatch}
                style={{
                  flex: 1, padding: "10px", borderRadius: 10, border: "none",
                  background: "var(--color-gold)", color: "white",
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                  fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}
              >
                Save {multiDates.length} Date{multiDates.length !== 1 ? "s" : ""}
              </button>
            )}
          </div>

          {/* Multi dates preview */}
          {multiDates.length > 0 && (
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
              {multiDates.map((d, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", borderRadius: 10,
                  background: "var(--color-surface)", border: "1px solid var(--color-border-soft)",
                }}>
                  <CalendarDots size={16} weight="duotone" color="var(--color-primary)" />
                  <span style={{ flex: 1, fontSize: 13, color: "var(--color-ink)", fontWeight: 500 }}>
                    {d.display}
                  </span>
                  <button onClick={() => setMultiDates((prev) => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", padding: 2 }}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Existing dates list */}
      {dates.length > 0 && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
          {dates.map((d, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 16px", borderRadius: 12,
              background: "var(--color-surface)", border: "1px solid var(--color-border-soft)",
            }}>
              <CalendarDots size={18} weight="duotone" color="var(--color-primary)" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: "var(--color-ink)", fontWeight: 600 }}>{d.display}</div>
                <div style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 2 }}>
                  {d.date_start}{d.date_end ? ` – ${d.date_end}` : ""}
                  {d.recurring_pattern ? ` · ${d.recurring_pattern}` : ""}
                  {d.all_day ? " · All Day" : ""}
                  {d.after_prayer ? ` · ${d.after_prayer}` : ""}
                  {d.time_start ? ` · ${d.time_start}${d.time_end ? ` – ${d.time_end}` : ""}` : ""}
                </div>
              </div>
              <button onClick={() => removeDate(i)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", padding: 4 }}>
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {dates.length === 0 && mode !== "multi" && (
        <p style={{ fontSize: 13, color: "var(--color-muted)", margin: 0, marginTop: 8 }}>
          No dates added yet. Configure the date above and click Add.
        </p>
      )}
    </div>
  );
}

const LABEL_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--color-muted)",
  marginBottom: 6,
  fontFamily: "var(--font-heading)",
};

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-ink)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};
