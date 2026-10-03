"use client";

import { useRef, useState } from "react";
import { Image as ImageIcon, SpinnerGap, X, UploadSimple } from "@phosphor-icons/react";

interface Props {
  value?: string;
  onChange: (url: string) => void;
  label?: string;
  hint?: string;
  compact?: boolean;
}

export default function ImageUploader({ value, onChange, label, hint, compact }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  const upload = async (file: File | undefined | null) => {
    if (!file) return;
    setErr(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("files", file);
      const res = await fetch("/api/forms/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Upload failed");
      onChange((data.urls as string[])[0]);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`upld${compact ? " upld--compact" : ""}${over ? " over" : ""}`}>
      {label && <span className="upld-label">{label}</span>}
      <button
        type="button"
        className="upld-zone"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void upload(e.dataTransfer.files?.[0]);
        }}
        disabled={busy}
      >
        {busy ? (
          <SpinnerGap size={20} className="spin" />
        ) : (
          <UploadSimple size={20} />
        )}
        <span className="upld-text">
          {busy
            ? "Uploading…"
            : value
              ? "Drag & drop to replace"
              : "Drag & drop or click to upload"}
        </span>
        {!busy && !value && hint && <span className="upld-hint">{hint}</span>}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {value && (
        <div className="upld-thumb-row">
          <img src={value} alt="" className="upld-thumb" />
        </div>
      )}
      <div className="upld-row">
        <ImageIcon size={13} />
        <input
          className="jf-input"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://…/image.png (paste a URL instead)"
          aria-label="Image URL"
        />
        {value && (
          <button
            className="jf-tool danger"
            onClick={() => onChange("")}
            aria-label="Remove image"
            type="button"
          >
            <X size={13} />
          </button>
        )}
      </div>
      {err && <p className="upld-err">{err}</p>}
    </div>
  );
}
