"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Check,
  SpinnerGap,
  Star,
  Heart,
  ThumbsUp,
  EnvelopeSimple,
  X,
  UploadSimple,
} from "@phosphor-icons/react";
import {
  buildSections,
  defaultTheme,
  fontStack,
  evaluateValidation,
  isFieldVisible,
  isLayout,
  resolveText,
  routeSections,
  scoreQuiz,
  validateField,
  withDefaults,
  type AnswerMap,
  type DisplayMode,
  type FormField,
  type FormRecord,
  type SectionInfo,
  type Step,
} from "@/lib/forms";
import { metaFor } from "@/components/forms/meta";
import PhoneInput from "@/components/forms/PhoneInput";

type Variant = "jff" | "tf";
type Stage = "welcome" | "questions";
type Page = { sec: SectionInfo; fields: FormField[] };

const OTHER_PREFIX = "__other__:";

interface Props {
  form: FormRecord;
  preview?: boolean;
}

function initialAnswers(form: FormRecord): AnswerMap {
  const answers: AnswerMap = {};
  for (const f of form.fields) {
    if (f.default_value) answers[f.id] = f.default_value;
    if (f.type === "ranking" && f.options?.length) answers[f.id] = [...f.options];
  }
  return answers;
}

function piped(f: FormField, form: FormRecord, answers: AnswerMap): FormField {
  const title = resolveText(f.title, form, answers);
  const description = f.description ? resolveText(f.description, form, answers) : f.description;
  const placeholder = f.placeholder ? resolveText(f.placeholder, form, answers) : f.placeholder;
  if (title === f.title && description === f.description && placeholder === f.placeholder) return f;
  return { ...f, title, description, placeholder };
}

function splitOther(value: unknown): { other: boolean; text: string; raw: string } {
  const raw = typeof value === "string" ? value : "";
  if (raw === "__other__") return { other: true, text: "", raw };
  if (raw.startsWith(OTHER_PREFIX)) return { other: true, text: raw.slice(OTHER_PREFIX.length), raw };
  return { other: false, text: "", raw };
}

const NAME_LABELS: Record<string, string> = {
  first: "First name",
  last: "Last name",
  middle: "Middle name",
  prefix: "Title",
  suffix: "Suffix",
};

const ADDR_LABELS: Record<string, string> = {
  street: "Street address",
  city: "City",
  state: "State / Province",
  postcode: "ZIP / Postcode",
  country: "Country",
};

function strMap(value: AnswerMap[string]): Record<string, string> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(value)) out[k] = String(v ?? "");
    return out;
  }
  return {};
}

function youtubeId(url: string): string | null {
  const m =
    url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/) || null;
  return m ? m[1] : null;
}

function fileLabel(url: string): string {
  try {
    const u = new URL(url, window.location.origin);
    const seg = u.pathname.split("/").pop() || url;
    return decodeURIComponent(seg);
  } catch {
    return url;
  }
}

const EMPTY_OPTS: string[] = [];

export function FieldWidget({
  field,
  value,
  onChange,
  variant,
  invalid,
}: {
  field: FormField;
  value: AnswerMap[string];
  onChange: (v: AnswerMap[string]) => void;
  variant: Variant;
  invalid?: boolean;
}) {
  const c = variant;
  const opts = field.options ?? EMPTY_OPTS;

  const [busy, setBusy] = useState(false);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef({ x: 0, y: 0 });
  const emitted = useRef(false);

  const baseItems = useMemo(() => {
    const base = opts.map((label, i) => ({ label, img: field.images?.[i] || "" }));
    if (field.allow_other) base.push({ label: "__other__", img: "" });
    return base;
  }, [opts, field.images, field.allow_other]);

  const [items, setItems] = useState(baseItems);
  useEffect(() => {
    const t = window.setTimeout(() => {
      const rest = baseItems.filter((o) => o.label !== "__other__");
      const other = baseItems.filter((o) => o.label === "__other__");
      if (field.shuffle_options && rest.length > 1) {
        for (let i = rest.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [rest[i], rest[j]] = [rest[j], rest[i]];
        }
        setItems([...rest, ...other]);
      } else {
        setItems(baseItems);
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [baseItems, field.shuffle_options]);

  useEffect(() => {
    if (field.type !== "signature") return;
    const cv = canvasRef.current;
    if (!cv) return;
    const parent = cv.parentElement;
    const w = parent?.clientWidth || 320;
    const h = 150;
    const dpr = window.devicePixelRatio || 1;
    cv.width = w * dpr;
    cv.height = h * dpr;
    cv.style.width = "100%";
    cv.style.height = h + "px";
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = getComputedStyle(cv).color || "#14201a";
    if (typeof value === "string" && value.startsWith("data:image")) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, w, h);
      img.src = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (field.type === "statement") {
    return (
      <div className={`${c}-statement`}>
        {field.title && <p className={`${c}-statement-title`}>{field.title}</p>}
        {field.description && <p>{field.description}</p>}
      </div>
    );
  }

  if (field.type === "image") {
    if (!field.image) {
      return <div className={`${c}-media-placeholder`}>Add an image URL in the builder</div>;
    }
    return <img className={`${c}-img`} src={field.image} alt={field.title || ""} />;
  }

  if (field.type === "video") {
    const yt = field.video ? youtubeId(field.video) : null;
    if (yt) {
      return (
        <div className={`${c}-video-wrap`}>
          <iframe
            className={`${c}-video`}
            src={`https://www.youtube.com/embed/${yt}`}
            title={field.title || "Video"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }
    if (field.video) {
      return (
        <div className={`${c}-video-wrap`}>
          <video className={`${c}-video`} src={field.video} controls />
        </div>
      );
    }
    return <div className={`${c}-media-placeholder`}>Add a video URL in the builder</div>;
  }

  if (field.type === "divider") {
    return <div className={`${c}-divider`} role="separator" />;
  }

  if (["short_text", "email", "number", "url"].includes(field.type)) {
    const input = (
      <input
        id={field.id}
        className={`${c}-input${invalid ? " invalid" : ""}`}
        type={
          field.type === "email"
            ? "email"
            : field.type === "number"
              ? "number"
              : field.type === "phone"
                ? "tel"
                : field.type === "url"
                  ? "url"
                  : "text"
        }
        value={(value as string) || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder || "Type your answer…"}
        aria-label={field.title}
        min={field.type === "number" ? field.min_value : undefined}
        max={field.type === "number" ? field.max_value : undefined}
      />
    );
    if (variant === "tf" && field.type === "email") {
      return (
        <div className="tf-inline">
          <EnvelopeSimple className="tf-inline-icon" size={22} />
          {input}
        </div>
      );
    }
    return input;
  }

  if (field.type === "phone") {
    return (
      <PhoneInput
        field={field}
        value={value}
        onChange={onChange}
        variant={variant}
        invalid={invalid}
      />
    );
  }

  if (field.type === "long_text") {
    return (
      <textarea
        id={field.id}
        className={`${c}-textarea${invalid ? " invalid" : ""}`}
        rows={4}
        value={(value as string) || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder || "Type your answer…"}
        aria-label={field.title}
      />
    );
  }

  if (field.type === "date") {
    return (
      <input
        id={field.id}
        className={`${c}-input${invalid ? " invalid" : ""}`}
        type={field.include_time ? "datetime-local" : "date"}
        value={(value as string) || ""}
        onChange={(e) => onChange(e.target.value)}
        aria-label={field.title}
      />
    );
  }

  if (field.type === "time") {
    if (field.time_kind === "duration") {
      const raw = typeof value === "string" && value ? value : "0:00";
      const [hRaw, mRaw] = raw.split(":");
      const h = Number(hRaw) || 0;
      const m = Number(mRaw) || 0;
      const cur = strMap({ h: String(h), m: String(m) });
      void cur;
      return (
        <div className={`${c}-duration`}>
          <select
            className={`${c}-input ${c}-select`}
            value={h}
            onChange={(e) => onChange(`${e.target.value}:${String(m).padStart(2, "0")}`)}
            aria-label="Hours"
          >
            {Array.from({ length: 24 }).map((_, i) => (
              <option key={i} value={i}>
                {i} hour{i === 1 ? "" : "s"}
              </option>
            ))}
          </select>
          <select
            className={`${c}-input ${c}-select`}
            value={m}
            onChange={(e) => onChange(`${h}:${e.target.value}`)}
            aria-label="Minutes"
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i} value={i * 5}>
                {i * 5} min
              </option>
            ))}
          </select>
        </div>
      );
    }
    return (
      <input
        id={field.id}
        className={`${c}-input${invalid ? " invalid" : ""}`}
        type="time"
        value={(value as string) || ""}
        onChange={(e) => onChange(e.target.value)}
        aria-label={field.title}
      />
    );
  }

  if (field.type === "yes_no") {
    return (
      <div className={`${c}-choices`}>
        {[true, false].map((v) => {
          const on = value === v || String(value) === String(v);
          return (
            <button
              type="button"
              key={String(v)}
              className={`${c}-choice${on ? " on" : ""}`}
              onClick={() => onChange(v)}
              aria-pressed={on}
            >
              <span className={`${c}-choice-key`}>{v ? "a" : "b"}</span>
              {v ? "Yes" : "No"}
            </button>
          );
        })}
      </div>
    );
  }

  if (field.type === "legal") {
    const on = value === true;
    return (
      <div className={`${c}-choices`}>
        <button
          type="button"
          className={`${c}-choice ${c}-choice--legal${on ? " on" : ""}`}
          onClick={() => onChange(!on)}
          aria-pressed={on}
        >
          <span className={`${c}-choice-key`}>{on ? "✓" : ""}</span>
          <span>
            {field.title}
            {field.link && (
              <a className={`${c}-legal-link`} href={field.link} target="_blank" rel="noreferrer">
                {field.link_text || "link"}
              </a>
            )}
          </span>
        </button>
      </div>
    );
  }

  if (
    field.type === "multiple_choice" ||
    field.type === "checkboxes" ||
    field.type === "picture_choice"
  ) {
    const isMulti = field.type === "checkboxes";
    const isPic = field.type === "picture_choice";
    const { other: otherOn, text: otherText } = splitOther(value);
    const chosenMulti = Array.isArray(value) ? (value as string[]) : [];
    const chosenOther = chosenMulti.some((v) => splitOther(v).other);

    return (
      <div
        className={`${c}-choices${isMulti ? ` ${c}-choices--multi` : ""}${isPic ? ` ${c}-choices--pic` : ""}`}
        role="group"
      >
        {items.map((item, oi) => {
          if (item.label === "__other__") {
            const on = isMulti ? chosenOther : otherOn;
            return (
              <div className={`${c}-choice-other`} key="__other__">
                <button
                  type="button"
                  className={`${c}-choice${on ? " on" : ""}`}
                  onClick={() => {
                    if (isMulti) {
                      const arr = chosenMulti.filter((v) => !splitOther(v).other);
                      if (!on) arr.push(OTHER_PREFIX + otherText);
                      onChange(arr);
                    } else {
                      onChange(OTHER_PREFIX + otherText);
                    }
                  }}
                  aria-pressed={on}
                >
                  <span className={`${c}-choice-key`}>{on ? "✓" : ""}</span>
                  Other…
                </button>
                {on && (
                  <input
                    className={`${c}-input ${c}-other-input`}
                    value={otherText}
                    placeholder={field.other_placeholder || "Type your answer…"}
                    onChange={(e) => {
                      if (isMulti) {
                        const arr = chosenMulti.filter((v) => !splitOther(v).other);
                        arr.push(OTHER_PREFIX + e.target.value);
                        onChange(arr);
                      } else {
                        onChange(OTHER_PREFIX + e.target.value);
                      }
                    }}
                    aria-label="Other answer"
                  />
                )}
              </div>
            );
          }
          const on = isMulti ? chosenMulti.includes(item.label) : value === item.label;
          if (isPic) {
            return (
              <button
                type="button"
                key={item.label + oi}
                className={`${c}-pic${on ? " on" : ""}`}
                onClick={() => {
                  if (isMulti) {
                    const arr = chosenMulti.includes(item.label)
                      ? chosenMulti.filter((v) => v !== item.label)
                      : [...chosenMulti, item.label];
                    onChange(arr);
                  } else {
                    onChange(item.label);
                  }
                }}
                aria-pressed={on}
              >
                {item.img ? (
                  <img className={`${c}-pic-img`} src={item.img} alt="" />
                ) : (
                  <span className={`${c}-pic-img ${c}-pic-img--empty`} />
                )}
                <span className={`${c}-pic-label`}>{item.label}</span>
                <span className={`${c}-choice-key`}>{on ? "✓" : ""}</span>
              </button>
            );
          }
          return (
            <button
              type="button"
              key={item.label + oi}
              className={`${c}-choice${on ? " on" : ""}`}
              onClick={() => {
                if (isMulti) {
                  const arr = on
                    ? chosenMulti.filter((v) => v !== item.label)
                    : [...chosenMulti, item.label];
                  onChange(arr);
                } else {
                  onChange(item.label);
                }
              }}
              aria-pressed={on}
            >
              <span className={`${c}-choice-key`}>
                {isMulti ? on ? "✓" : String.fromCharCode(97 + (oi % 26)) : String.fromCharCode(97 + (oi % 26))}
              </span>
              {item.label}
            </button>
          );
        })}
      </div>
    );
  }

  if (field.type === "dropdown") {
    const { other: otherOn, text: otherText } = splitOther(value);
    return (
      <div className={`${c}-select-wrap`}>
        <select
          id={field.id}
          className={`${c}-input ${c}-select${invalid ? " invalid" : ""}`}
          value={otherOn ? "__other__" : (value as string) || ""}
          onChange={(e) => {
            if (e.target.value === "__other__") onChange(OTHER_PREFIX + otherText);
            else onChange(e.target.value);
          }}
          aria-label={field.title}
        >
          <option value="">Select an option…</option>
          {items.map((item, oi) =>
            item.label === "__other__" ? (
              <option key="__other__" value="__other__">
                Other…
              </option>
            ) : (
              <option key={item.label + oi} value={item.label}>
                {item.label}
              </option>
            )
          )}
        </select>
        {otherOn && (
          <input
            className={`${c}-input ${c}-other-input`}
            value={otherText}
            placeholder={field.other_placeholder || "Type your answer…"}
            onChange={(e) => onChange(OTHER_PREFIX + e.target.value)}
            aria-label="Other answer"
          />
        )}
      </div>
    );
  }

  if (field.type === "rating") {
    const max = field.max || 5;
    const num = Number(value) || 0;
    const shape = field.rating_shape || "star";
    const Icon = shape === "heart" ? Heart : shape === "thumb" ? ThumbsUp : Star;
    return (
      <div className={`${c}-scale ${c}-scale--${shape}`} role="group" aria-label={field.title}>
        {Array.from({ length: max }).map((_, k) => {
          const v = k + 1;
          const on = num >= v;
          return (
            <button
              type="button"
              key={v}
              className={`${c}-scale-btn${on ? " on" : ""}`}
              onClick={() => onChange(v)}
              aria-label={`${v} of ${max}`}
            >
              <Icon size={variant === "tf" ? 22 : 20} weight={on ? "fill" : "duotone"} />
              <span>{v}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (field.type === "opinion_scale" || field.type === "nps") {
    const min = field.scale_min ?? 0;
    const max = field.scale_max ?? 10;
    const num = value !== undefined && value !== null && value !== "" ? Number(value) : null;
    const len = Math.max(0, Math.min(max - min + 1, 51));
    return (
      <div
        className={`${c}-scale ${c}-scale--nums${field.type === "nps" ? ` ${c}-scale--nps` : ""}`}
        role="group"
        aria-label={field.title}
      >
        <div className={`${c}-scale-row`}>
          {Array.from({ length: len }).map((_, k) => {
            const v = min + k;
            const on = num === v;
            return (
              <button
                type="button"
                key={v}
                className={`${c}-scale-btn${on ? " on" : ""}`}
                onClick={() => onChange(v)}
                aria-label={String(v)}
                aria-pressed={on}
              >
                {v}
              </button>
            );
          })}
        </div>
        {(field.scale_label_low || field.scale_label_high) && (
          <div className={`${c}-scale-labels`}>
            <span>{field.scale_label_low}</span>
            {field.scale_label_center && <span>{field.scale_label_center}</span>}
            <span>{field.scale_label_high}</span>
          </div>
        )}
      </div>
    );
  }

  if (field.type === "ranking") {
    const ordered = Array.isArray(value) ? (value as string[]) : [...opts];
    const valid = ordered.filter((o) => opts.includes(o));
    for (const o of opts) if (!valid.includes(o)) valid.push(o);
    const move = (i: number, dir: -1 | 1) => {
      const j = i + dir;
      if (j < 0 || j >= valid.length) return;
      const next = [...valid];
      [next[i], next[j]] = [next[j], next[i]];
      onChange(next);
    };
    return (
      <ol className={`${c}-rank`}>
        {valid.map((label, i) => (
          <li className={`${c}-rank-item`} key={label}>
            <span className={`${c}-rank-num`}>{i + 1}</span>
            <span className={`${c}-rank-label`}>{label}</span>
            <span className={`${c}-rank-moves`}>
              <button
                type="button"
                className={`${c}-rank-btn`}
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label={`Move ${label} up`}
              >
                <ArrowUp size={14} weight="bold" />
              </button>
              <button
                type="button"
                className={`${c}-rank-btn`}
                onClick={() => move(i, 1)}
                disabled={i === valid.length - 1}
                aria-label={`Move ${label} down`}
              >
                <ArrowDown size={14} weight="bold" />
              </button>
            </span>
          </li>
        ))}
      </ol>
    );
  }

  if (field.type === "matrix") {
    const rows = field.rows || [];
    const cols = field.columns || [];
    const map = strMap(value);
    const multi = !!field.matrix_multi;
    const cellValue = (row: string): string[] => {
      const v = map[row];
      if (Array.isArray(v)) return v.map(String);
      return v === undefined || v === null || v === "" ? [] : [String(v)];
    };
    const chosenElsewhere = (col: string, row: string) => {
      if (multi || !field.limit_one_per_column) return false;
      return rows.some((r) => r !== row && String(map[r] ?? "") === col);
    };
    const toggle = (row: string, col: string) => {
      if (multi) {
        const cur = cellValue(row);
        const next = cur.includes(col) ? cur.filter((x) => x !== col) : [...cur, col];
        onChange({ ...map, [row]: next });
      } else {
        const next = { ...map };
        if (String(map[row] ?? "") === col) delete next[row];
        else next[row] = col;
        onChange(next);
      }
    };
    return (
      <div className={`${c}-matrix-wrap`}>
        <table className={`${c}-matrix`}>
          <thead>
            <tr>
              <th className={`${c}-matrix-corner`} />
              {cols.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row}>
                <th className={`${c}-matrix-rowhead`}>{row}</th>
                {cols.map((col) => {
                  const chosen = cellValue(row).includes(col);
                  const disabled = !chosen && chosenElsewhere(col, row);
                  return (
                    <td key={col}>
                      <button
                        type="button"
                        className={`${c}-matrix-cell${chosen ? " on" : ""}`}
                        onClick={() => toggle(row, col)}
                        disabled={disabled}
                        aria-label={`${row} — ${col}`}
                        aria-pressed={chosen}
                      >
                        {multi ? (
                          <span className={`${c}-matrix-box`}>{chosen ? "✓" : ""}</span>
                        ) : (
                          <span className={`${c}-matrix-dot`} />
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (field.type === "full_name") {
    const fields = field.name_fields?.length ? field.name_fields : ["first", "last"];
    const cur = strMap(value);
    return (
      <div className={`${c}-name-row`}>
        {fields.map((key) => (
          <label className={`${c}-name-part`} key={key}>
            <span>{NAME_LABELS[key] || key}</span>
            <input
              className={`${c}-input`}
              value={cur[key] || ""}
              onChange={(e) => onChange({ ...cur, [key]: e.target.value })}
              aria-label={NAME_LABELS[key] || key}
            />
          </label>
        ))}
      </div>
    );
  }

  if (field.type === "address") {
    const fields = field.address_fields?.length
      ? field.address_fields
      : ["street", "city", "state", "postcode", "country"];
    const cur = strMap(value);
    return (
      <div className={`${c}-addr-grid`}>
        {fields.map((key) => (
          <label
            className={`${c}-addr-part${key === "street" ? ` ${c}-addr-part--wide` : ""}`}
            key={key}
          >
            <span>{ADDR_LABELS[key] || key}</span>
            <input
              className={`${c}-input`}
              value={cur[key] || ""}
              onChange={(e) => onChange({ ...cur, [key]: e.target.value })}
              aria-label={ADDR_LABELS[key] || key}
            />
          </label>
        ))}
      </div>
    );
  }

  if (field.type === "file_upload") {
    const files = Array.isArray(value) ? (value as string[]) : value ? [String(value)] : [];
    const maxMb = field.max_file_mb ?? 10;
    const maxFiles = field.max_files ?? 1;

    const handleFiles = async (list: FileList | null) => {
      if (!list || list.length === 0) return;
      setFileErr(null);
      const picked = Array.from(list);
      const bad = picked.find((f) => f.size > maxMb * 1024 * 1024);
      if (bad) {
        setFileErr(`"${bad.name}" is larger than ${maxMb} MB`);
        return;
      }
      setBusy(true);
      try {
        const fd = new FormData();
        for (const f of picked) fd.append("files", f);
        const res = await fetch("/api/forms/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Upload failed");
        const urls: string[] = [...files, ...(data.urls as string[])].slice(0, maxFiles);
        onChange(urls);
      } catch (err: unknown) {
        setFileErr(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setBusy(false);
      }
    };

    return (
      <div className={`${c}-file`}>
        <label className={`${c}-file-btn`}>
          <UploadSimple size={18} />
          {busy ? "Uploading…" : files.length >= maxFiles ? "Replace file" : "Choose file"}
          <input
            type="file"
            hidden
            accept={field.file_accept || undefined}
            multiple={maxFiles > 1}
            disabled={busy}
            onChange={(e) => {
              void handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>
        <span className={`${c}-file-hint`}>
          {busy ? (
            <SpinnerGap size={14} className="spin" />
          ) : (
            `Max ${maxMb} MB${maxFiles > 1 ? `, up to ${maxFiles} files` : ""}`
          )}
        </span>
        {fileErr && <p className={`${c}-error`}>{fileErr}</p>}
        {files.length > 0 && (
          <ul className={`${c}-file-list`}>
            {files.map((url, i) => (
              <li key={url + i}>
                <a href={url} target="_blank" rel="noreferrer">
                  {fileLabel(url)}
                </a>
                <button
                  type="button"
                  className={`${c}-file-remove`}
                  aria-label="Remove file"
                  onClick={() => onChange(files.filter((_, k) => k !== i))}
                >
                  <X size={13} weight="bold" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (field.type === "signature") {
    const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    return (
      <div className={`${c}-sig-wrap`}>
        <canvas
          ref={canvasRef}
          className={`${c}-sig${invalid ? " invalid" : ""}`}
          onPointerDown={(e) => {
            const cv = e.currentTarget;
            cv.setPointerCapture(e.pointerId);
            drawing.current = true;
            last.current = pos(e);
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            const ctx = e.currentTarget.getContext("2d");
            if (!ctx) return;
            const p = pos(e);
            ctx.beginPath();
            ctx.moveTo(last.current.x, last.current.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            last.current = p;
            emitted.current = false;
          }}
          onPointerUp={(e) => {
            drawing.current = false;
            const cv = e.currentTarget;
            if (!emitted.current) {
              emitted.current = true;
              onChange(cv.toDataURL("image/png"));
            }
          }}
          onPointerLeave={(e) => {
            if (drawing.current) {
              drawing.current = false;
              if (!emitted.current) {
                emitted.current = true;
                onChange(e.currentTarget.toDataURL("image/png"));
              }
            }
          }}
        />
        <div className={`${c}-sig-actions`}>
          <span className={`${c}-file-hint`}>Draw your signature</span>
          <button
            type="button"
            className={`${c}-sig-clear`}
            onClick={() => {
              const cv = canvasRef.current;
              const ctx = cv?.getContext("2d");
              if (cv && ctx) ctx.clearRect(0, 0, cv.width, cv.height);
              emitted.current = true;
              onChange("");
            }}
          >
            Clear
          </button>
        </div>
      </div>
    );
  }

  return null;
}

function ThanksScreen({
  form,
  score,
}: {
  form: FormRecord;
  score: { score: number; max: number } | null;
}) {
  const s = withDefaults(form.settings);
  const ty = s.thank_you || {};
  const quiz = s.quiz || {};
  const showScore = score && quiz.enabled && quiz.show_score;
  return (
    <div className="jff-thanks">
      <div className="jff-thanks-icon">
        <Check size={34} weight="bold" />
      </div>
      <h1 className="jff-title">{resolveText(ty.title, form, {}) || "Thank You!"}</h1>
      <p className="jff-desc">
        {resolveText(ty.message, form, {}) || "Your response has been recorded."}
      </p>
      {showScore && (
        <div className="jff-score">
          <span className="jff-score-num">
            {score.score} / {score.max}
          </span>
          <span className="jff-score-label">
            {quiz.pass_mark && quiz.pass_mark > 0
              ? score.score >= quiz.pass_mark
                ? "Passed"
                : `Pass mark: ${quiz.pass_mark}`
              : "Your score"}
          </span>
        </div>
      )}
      {ty.confirmation_link && (
        <a className="jff-confirmation" href={ty.confirmation_link} target="_blank" rel="noreferrer">
          {ty.confirmation_link_text || "View your response"}
        </a>
      )}
      <div className="jff-foot" style={{ marginTop: 24 }}>
        Powered by Masjid As Sunnah
      </div>
    </div>
  );
}

function countdownStr(ms: number): string {
  let s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  s -= d * 86400;
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  const p = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return `${d}d ${p(h)}h ${p(m)}m ${p(s)}s`;
  if (h > 0) return `${p(h)}h ${p(m)}m ${p(s)}s`;
  return `${p(m)}m ${p(s)}s`;
}

function formatStamp(ts: number): string {
  return new Date(ts).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function FormRenderer({ form, preview }: Props) {
  const s = withDefaults(form.settings);
  const theme = { ...defaultTheme(), ...(s.theme || {}) };
  const mode: DisplayMode = s.display === "one_at_a_time" ? "one_at_a_time" : "classic";

  const [answers, setAnswers] = useState<AnswerMap>(() => initialAnswers(form));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [score, setScore] = useState<{ score: number; max: number } | null>(null);
  const [already, setAlready] = useState(false);

  const [stage, setStage] = useState<Stage>(
    s.welcome_enabled === false ? "questions" : "welcome"
  );
  const [index, setIndex] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [deadline, setDeadline] = useState<number | null>(null);
  const autoSubmitted = useRef(false);
  const startedAtRef = useRef(0);
  const pageViewsRef = useRef(1);
  useEffect(() => {
    if (!startedAtRef.current) startedAtRef.current = Date.now();
    pageViewsRef.current += 1;
  }, [pageIndex]);

  const [shuffleRank, setShuffleRank] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!s.presentation?.shuffle_questions) {
        setShuffleRank((prev) => (prev === null ? prev : null));
        return;
      }
      const ids = form.fields.map((f) => f.id);
      for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      const rank: Record<string, number> = {};
      ids.forEach((id, i) => (rank[id] = i));
      setShuffleRank(rank);
    }, 0);
    return () => window.clearTimeout(t);
  }, [s.presentation?.shuffle_questions, form.fields]);

  const pages: Page[] = useMemo(() => {
    const all = buildSections(form.fields);
    const routed = routeSections(all, answers);
    const conds = s.conditions;
    return routed.map((sec) => {
      const visible = sec.fields
        .filter((f) => f.type !== "section")
        .filter((f) => isFieldVisible(f.id, answers, conds))
        .map((f) => piped(f, form, answers));
      if (shuffleRank) {
        visible.sort((a, b) => (shuffleRank[a.id] ?? 0) - (shuffleRank[b.id] ?? 0));
      }
      return {
        sec: { ...sec, title: resolveText(sec.title, form, answers) },
        fields: visible,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.fields, answers, s.conditions, shuffleRank]);

  const pIdx = Math.min(pageIndex, Math.max(pages.length - 1, 0));
  const currentPage = pages[pIdx];

  const numbering = useMemo(() => {
    const map: Record<string, number> = {};
    let n = 1;
    for (const p of pages) {
      for (const f of p.fields) {
        if (!isLayout(f.type)) map[f.id] = n++;
      }
    }
    return map;
  }, [pages]);

  const steps: Step[] = useMemo(() => {
    const out: Step[] = [];
    for (const p of pages) {
      if (p.sec.index > 0 && (p.sec.title || p.sec.description)) {
        out.push({ kind: "section", section: p.sec });
      }
      for (const f of p.fields) {
        if (f.type === "divider") continue;
        out.push({ kind: "field", field: f });
      }
    }
    return out;
  }, [pages]);

  const themeVars = {
    "--jff-bg": theme.bg || "#f4f6f4",
    "--jff-primary": theme.primary || "#026839",
    "--jff-text": theme.text || "#14201a",
    fontFamily: fontStack(theme.font),
    ...(theme.background_image
      ? {
          backgroundImage: `linear-gradient(rgba(0,0,0,.25), rgba(0,0,0,.25)), url(${theme.background_image})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : {}),
  } as React.CSSProperties;

  const setAnswer = useCallback(
    (id: string, v: AnswerMap[string]) => {
      setAnswers((prev) => ({ ...prev, [id]: v }));
      setErrors((prev) => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setGlobalError(null);
    },
    [setAnswers, setErrors, setGlobalError]
  );

  const finish = useCallback(
    async (finalAnswers: AnswerMap) => {
      const ty = s.thank_you || {};
      if (s.quiz?.enabled) {
        const result = scoreQuiz(form, finalAnswers);
        setScore({ score: result.score, max: result.max });
      }
      if (preview) {
        setDone(true);
        return;
      }
      setSubmitting(true);
      setGlobalError(null);
      try {
        const words = Object.values(finalAnswers)
          .filter((v): v is string => typeof v === "string")
          .reduce((a, b) => a + (b.trim().split(/\s+/).filter(Boolean).length || 0), 0);
        const payload: AnswerMap = {
          ...finalAnswers,
          __meta: {
            started_at: startedAtRef.current,
            duration_ms: Math.max(0, Date.now() - startedAtRef.current),
            page_views: pageViewsRef.current,
            words,
            device: window.innerWidth < 700 ? "mobile" : "desktop",
          },
        };
        const res = await fetch("/api/forms/responses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ form_id: form.id, answers: payload }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        if (s.responses?.duplicate_per_browser) {
          document.cookie = `masjid_form_${form.id}=1; path=/; max-age=31536000; SameSite=Lax`;
        }
        if (ty.redirect_url) {
          window.location.href = ty.redirect_url;
          return;
        }
        setDone(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (err: unknown) {
        setGlobalError(err instanceof Error ? err.message : "Could not submit — please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [form, preview, s, setDone, setSubmitting, setGlobalError, setScore]
  );

  const validateSubmission = useCallback((): string | null => {
    const hit = evaluateValidation(s.validation, answers);
    if (!hit) return null;
    setErrors(Object.fromEntries(hit.fieldIds.map((fid) => [fid, hit.message])));
    setGlobalError(hit.message);
    const el = document.getElementById(`jff-q-${hit.fieldIds[0]}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    return hit.message;
  }, [s.validation, answers, setErrors, setGlobalError]);

  const validateList = useCallback(
    (fields: FormField[]): string | null => {
      for (const f of fields) {
        if (isLayout(f.type)) continue;
        const err = validateField(f, answers[f.id]);
        if (err) {
          setErrors({ [f.id]: err });
          setGlobalError(null);
          const el = document.getElementById(`jff-q-${f.id}`);
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
          return err;
        }
      }
      setErrors({});
      return null;
    },
    [answers, setErrors, setGlobalError]
  );

  const submitClassic = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting || done) return;
      const blocked = validateSubmission();
      if (blocked) return;
      const all = pages.flatMap((p) => p.fields);
      const err = validateList(all);
      if (err) return;
      void finish(answers);
    },
    [submitting, done, validateSubmission, pages, validateList, answers, finish]
  );

  const classicContinue = useCallback(() => {
    const err = validateList(currentPage?.fields || []);
    if (err) return;
    setPageIndex((i) => i + 1);
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [validateList, currentPage, setErrors, setPageIndex]);

  const classicBack = useCallback(() => {
    setErrors({});
    setPageIndex((i) => Math.max(0, i - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [setErrors, setPageIndex]);

  const idx = Math.min(index, Math.max(steps.length - 1, 0));
  const current = steps[idx];
  const isLast = idx === steps.length - 1;

  const advance = useCallback(() => {
    if (stage !== "questions" || !current) return;
    if (current.kind === "field" && current.field) {
      const f = current.field;
      if (!isLayout(f.type)) {
        const err = validateField(f, answers[f.id]);
        if (err) {
          setErrors({ [f.id]: err });
          return;
        }
      }
    }
    setErrors({});
    if (idx < steps.length - 1) {
      setIndex(idx + 1);
      return;
    }
    const blocked = validateSubmission();
    if (blocked) return;
    void finish(answers);
  }, [stage, current, answers, idx, steps.length, finish, validateSubmission, setErrors, setIndex]);

  const goBack = useCallback(() => {
    setErrors({});
    if (stage === "questions") {
      if (idx > 0) setIndex(idx - 1);
      else if (s.welcome_enabled !== false) setStage("welcome");
    }
  }, [stage, idx, s.welcome_enabled, setErrors, setIndex, setStage]);

  useEffect(() => {
    if (mode !== "one_at_a_time" || done) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || submitting) return;
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "TEXTAREA" && !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      if (stage === "welcome") setStage("questions");
      else if (stage === "questions") advance();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, stage, advance, submitting, done]);

  useEffect(() => {
    if (preview) return;
    const t = window.setTimeout(() => {
      try {
        if (s.responses?.duplicate_per_browser) {
          if (document.cookie.includes(`masjid_form_${form.id}=`)) {
            setAlready(true);
            return;
          }
        }
        const params = new URLSearchParams(window.location.search);
        const patch: AnswerMap = {};
        for (const name of s.hidden_fields || []) {
          const v = params.get(name);
          if (v !== null) patch["hidden:" + name] = v;
        }
        for (const f of form.fields) {
          const v = params.get("f_" + f.id);
          if (v !== null) patch[f.id] = v;
        }
        if (Object.keys(patch).length) {
          setAnswers((prev) => ({ ...prev, ...patch }));
        }
      } catch {
        /* no window */
      }
    }, 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const timerMinutes = s.presentation?.timer_minutes || 0;
  useEffect(() => {
    if (timerMinutes <= 0 || done) return;
    const t = window.setTimeout(() => {
      setDeadline((d) => d ?? Date.now() + timerMinutes * 60_000);
    }, 0);
    return () => window.clearTimeout(t);
  }, [timerMinutes, done]);

  useEffect(() => {
    if (deadline === null || done) return;
    const iv = window.setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= deadline && !autoSubmitted.current) {
        autoSubmitted.current = true;
        void finish(answers);
      }
    }, 500);
    return () => window.clearInterval(iv);
  }, [deadline, done, answers, finish]);

  const timerLeft =
    deadline !== null ? Math.max(0, Math.floor((deadline - now) / 1000)) : timerMinutes * 60;
  const timerStr = `${String(Math.floor(timerLeft / 60)).padStart(2, "0")}:${String(
    timerLeft % 60
  ).padStart(2, "0")}`;
  const timerHot = deadline !== null && timerLeft <= 60;

  // Registration window (settings.responses.start_at / end_at) — the form only
  // opens and closes at the exact configured date + time.
  const respWindow = s.responses || {};
  const startTs = respWindow.start_at ? new Date(respWindow.start_at).getTime() : NaN;
  const endTs = respWindow.end_at ? new Date(respWindow.end_at).getTime() : NaN;
  const hasWindow =
    !preview && ((!isNaN(startTs) && startTs > 0) || (!isNaN(endTs) && endTs > 0));
  useEffect(() => {
    if (!hasWindow) return;
    const iv = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(iv);
  }, [hasWindow]);

  const beforeStart = hasWindow && !isNaN(startTs) && now < startTs;
  const afterEnd = hasWindow && !isNaN(endTs) && now >= endTs;

  const title = resolveText(form.title, form, answers);
  const description = resolveText(form.description, form, answers);

  if (!preview && s.responses?.accept === false) {
    return (
      <div className={`jff jff--${mode}`} style={themeVars}>
        <div className="jff-card">
          <h1 className="jff-title">{title}</h1>
          <p className="jff-desc">{s.responses?.closed_message || "This form is no longer accepting responses."}</p>
          <div className="jff-foot">Powered by Masjid As Sunnah</div>
        </div>
      </div>
    );
  }

  if (beforeStart) {
    return (
      <div className={`jff jff--${mode}`} style={themeVars}>
        <div className="jff-card">
          {theme.logo_url && <img src={theme.logo_url} alt="" className="jff-logo" />}
          <h1 className="jff-title">{title}</h1>
          <p className="jff-desc">
            This form is not open yet. Responses can be submitted from{" "}
            <strong>{formatStamp(startTs)}</strong>.
          </p>
          <div className="jff-countdown" role="timer" aria-live="off">
            {countdownStr(startTs - now)}
          </div>
          <div className="jff-countdown-cap">until it opens</div>
          <div className="jff-foot">Powered by Masjid As Sunnah</div>
        </div>
      </div>
    );
  }

  if (afterEnd) {
    return (
      <div className={`jff jff--${mode}`} style={themeVars}>
        <div className="jff-card">
          {theme.logo_url && <img src={theme.logo_url} alt="" className="jff-logo" />}
          <h1 className="jff-title">{title}</h1>
          <p className="jff-desc">
            {s.responses?.closed_message && s.responses.accept === false
              ? s.responses.closed_message
              : `This form stopped accepting responses on ${formatStamp(endTs)}.`}
          </p>
          <div className="jff-foot">Powered by Masjid As Sunnah</div>
        </div>
      </div>
    );
  }

  if (already && !preview) {
    return (
      <div className={`jff jff--${mode}`} style={themeVars}>
        <div className="jff-card">
          <h1 className="jff-title">{resolveText(form.title, form, answers)}</h1>
          <p className="jff-desc">You have already responded to this form.</p>
          <div className="jff-foot">Powered by Masjid As Sunnah</div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className={`jff jff--${mode}`} style={themeVars}>
        <ThanksScreen form={form} score={score} />
      </div>
    );
  }

  if (mode === "classic") {
    const multiPage = pages.length > 1;
    const pageFields = currentPage?.fields || [];
    const isFirst = pIdx === 0;
    const isLastPage = pIdx >= pages.length - 1;
    const showBar = multiPage && s.presentation?.progress_bar !== false;

    return (
      <div className="jff jff--classic" style={themeVars}>
        {preview && <span className="jff-preview-chip">Preview mode — nothing is saved</span>}
        <div className="jff-card">
          {theme.logo_url && <img src={theme.logo_url} alt="" className="jff-logo" />}
          <h1 className="jff-title">{title}</h1>
          {description && <p className="jff-desc">{description}</p>}

          {showBar && (
            <div
              className="jff-progress"
              role="progressbar"
              aria-valuenow={Math.round(((pIdx + 1) / pages.length) * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="jff-progress-fill"
                style={{ width: `${Math.round(((pIdx + 1) / pages.length) * 100)}%` }}
              />
            </div>
          )}
          {timerMinutes > 0 && (
            <div className={`jff-timer${timerHot ? " hot" : ""}`} aria-label="Time remaining">
              {timerStr}
            </div>
          )}

          {multiPage && (currentPage?.sec.title || currentPage?.sec.description) && (
            <div className="jff-section-head">
              <h2 className="jff-section-title">{currentPage?.sec.title}</h2>
              {currentPage?.sec.description && (
                <p className="jff-section-desc">{currentPage?.sec.description}</p>
              )}
            </div>
          )}

          <form className="jff-form" onSubmit={submitClassic} noValidate>
            {pageFields.map((f) => {
              const err = errors[f.id];
              const num = numbering[f.id];
              if (f.type === "statement") {
                return (
                  <div className="jff-q jff-q--statement" key={f.id} id={`jff-q-${f.id}`}>
                    <FieldWidget
                      field={f}
                      value={answers[f.id]}
                      onChange={(v) => setAnswer(f.id, v)}
                      variant="jff"
                    />
                  </div>
                );
              }
              if (f.type === "image" || f.type === "video" || f.type === "divider") {
                return (
                  <div className="jff-q jff-q--media" key={f.id} id={`jff-q-${f.id}`}>
                    <FieldWidget
                      field={f}
                      value={answers[f.id]}
                      onChange={(v) => setAnswer(f.id, v)}
                      variant="jff"
                    />
                  </div>
                );
              }
              if (f.type === "legal") {
                return (
                  <div className={`jff-q jff-q--legal${err ? " has-error" : ""}`} key={f.id} id={`jff-q-${f.id}`}>
                    <div className="jff-label jff-label--legal">
                      {s.presentation?.question_numbers !== false && num !== undefined && (
                        <span className="jff-qnum">{num}.</span>
                      )}
                      <span className="jff-legal-title">Please accept to continue</span>
                      {f.required && <span className="jff-req">*</span>}
                    </div>
                    {f.description && <p className="jff-help">{f.description}</p>}
                    <FieldWidget
                      field={f}
                      value={answers[f.id]}
                      onChange={(v) => setAnswer(f.id, v)}
                      variant="jff"
                      invalid={!!err}
                    />
                    {err && <p className="jff-error">{err}</p>}
                  </div>
                );
              }
              return (
                <div className={`jff-q${err ? " has-error" : ""}`} key={f.id} id={`jff-q-${f.id}`}>
                  <label className="jff-label" htmlFor={f.id}>
                    {s.presentation?.question_numbers !== false && num !== undefined && (
                      <span className="jff-qnum">{num}.</span>
                    )}
                    {f.title || metaFor(f.type).label}
                    {f.required && <span className="jff-req">*</span>}
                  </label>
                  {f.description && <p className="jff-help">{f.description}</p>}
                  <FieldWidget
                    field={f}
                    value={answers[f.id]}
                    onChange={(v) => setAnswer(f.id, v)}
                    variant="jff"
                    invalid={!!err}
                  />
                  {err && <p className="jff-error">{err}</p>}
                </div>
              );
            })}

            {globalError && <p className="jff-error jff-error--form">{globalError}</p>}

            <div className="jff-actions">
              {pIdx > 0 && (
                <button className="jff-submit jff-submit--ghost" type="button" onClick={classicBack}>
                  <ArrowLeft size={16} /> Back
                </button>
              )}
              {isLastPage ? (
                <button className="jff-submit" type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <SpinnerGap size={16} className="spin" /> Submitting…
                    </>
                  ) : (
                    "Submit"
                  )}
                </button>
              ) : (
                <button className="jff-submit" type="button" onClick={classicContinue}>
                  Continue <ArrowRight size={16} />
                </button>
              )}
            </div>
            {!isFirst && null}
          </form>

          <div className="jff-foot">Powered by Masjid As Sunnah</div>
        </div>
      </div>
    );
  }

  const fieldStep = current?.kind === "field" ? current.field : undefined;
  const totalFields = steps.filter((st) => st.kind === "field").length;
  const fieldNum =
    fieldStep && !isLayout(fieldStep.type) ? numbering[fieldStep.id] ?? idx + 1 : idx + 1;

  return (
    <div className="jff jff--oaat" style={themeVars}>
      <div className="tf-page">
        <div className="tf-progress">
          <div
            className="tf-progress-fill"
            style={{ width: `${steps.length ? Math.round((idx / steps.length) * 100) : 0}%` }}
          />
        </div>

        {preview && <div className="tf-preview-chip">Preview mode — nothing is saved</div>}

        <header className="tf-head">
          <span className="tf-brand">
            {theme.logo_url ? <img src={theme.logo_url} alt="" className="tf-brand-logo" /> : "Masjid As Sunnah"}
          </span>
          <span className="tf-head-right">
            {timerMinutes > 0 && (
              <span className={`tf-timer${timerHot ? " hot" : ""}`}>{timerStr}</span>
            )}
            {stage === "questions" && (
              <span className="tf-count">
                {Math.min(fieldNum, Math.max(totalFields, 1))} / {Math.max(totalFields, 1)}
              </span>
            )}
          </span>
        </header>

        <main className="tf-stage" key={`${stage}-${index}`}>
          {stage === "welcome" && (
            <section className="tf-screen tf-in">
              <p className="tf-eyebrow">Registration</p>
              <h1 className="tf-title">{resolveText(s.welcome_title, form, answers) || title}</h1>
              <p className="tf-lead">
                {resolveText(s.welcome_description, form, answers) ||
                  description ||
                  "This will only take a minute."}
              </p>
              <button
                className="tf-btn tf-btn--lg"
                onClick={() => setStage("questions")}
                disabled={steps.length === 0}
              >
                {s.welcome_button || "Start"}
                <ArrowRight size={18} />
              </button>
              {steps.length === 0 && <p className="tf-hint">This form has no questions yet.</p>}
              <p className="tf-hint">
                press <kbd>Enter</kbd> <span className="tf-enter">↵</span>
              </p>
            </section>
          )}

          {stage === "questions" && current?.kind === "section" && current.section && (
            <section className="tf-screen tf-in" key={`sec-${idx}`}>
              <p className="tf-eyebrow">
                Section {current.section.index} of {Math.max(...pages.map((p) => p.sec.index), 1)}
              </p>
              <h1 className="tf-title">{current.section.title}</h1>
              {current.section.description && <p className="tf-lead">{current.section.description}</p>}
              <div className="tf-nav">
                <button className="tf-back" onClick={goBack} aria-label="Previous">
                  <ArrowLeft size={16} />
                </button>
                <div className="tf-ok-wrap">
                  <button className="tf-btn tf-ok" onClick={advance}>
                    Continue <ArrowRight size={16} />
                  </button>
                  <span className="tf-enter-label">
                    <kbd>Enter</kbd> <span className="tf-enter">↵</span>
                  </span>
                </div>
              </div>
            </section>
          )}

          {stage === "questions" && fieldStep && (
            <section className="tf-screen tf-in">
              {fieldStep.type !== "statement" &&
                fieldStep.type !== "image" &&
                fieldStep.type !== "video" && (
                  <div className="tf-q-head">
                    <span className="tf-q-num">{fieldNum}</span>
                    <div>
                      <h2 className="tf-q-title">
                        {fieldStep.title || metaFor(fieldStep.type).label}
                        {fieldStep.required && <span className="tf-req">*</span>}
                      </h2>
                      {fieldStep.description && <p className="tf-q-desc">{fieldStep.description}</p>}
                    </div>
                  </div>
                )}

              <div className="tf-answer">
                <FieldWidget
                  field={fieldStep}
                  value={answers[fieldStep.id]}
                  onChange={(v) => setAnswer(fieldStep.id, v)}
                  variant="tf"
                  invalid={!!errors[fieldStep.id]}
                />
              </div>

              {errors[fieldStep.id] && <p className="tf-error">{errors[fieldStep.id]}</p>}
              {globalError && <p className="tf-error">{globalError}</p>}

              <div className="tf-nav">
                <button className="tf-back" onClick={goBack} aria-label="Previous question">
                  <ArrowLeft size={16} />
                </button>
                <div className="tf-ok-wrap">
                  <button className="tf-btn tf-ok" onClick={advance} disabled={submitting}>
                    {submitting ? <SpinnerGap size={16} className="spin" /> : null}
                    {submitting
                      ? "Submitting…"
                      : isLayout(fieldStep.type)
                        ? "Continue"
                        : isLast
                          ? "Submit"
                          : "OK"}
                  </button>
                  <span className="tf-enter-label">
                    <kbd>Enter</kbd> <span className="tf-enter">↵</span>
                  </span>
                </div>
              </div>
            </section>
          )}
        </main>

        <footer className="tf-foot">
          <span>Powered by Masjid As Sunnah</span>
        </footer>
      </div>
    </div>
  );
}
