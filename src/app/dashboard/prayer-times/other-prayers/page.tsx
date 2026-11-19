"use client";

/* ==========================================================================
   Other Prayers — a page, not a popup.

   Pick ONE thing to edit (Jumuah / Taraweeh / Imsak / Iftar) and you get a
   focused editor for just that; nothing is bundled into a single long form.
   With autosave on there is no Save button at all — every keystroke is
   written for you. With it off, Save changes appears in the footer.
   ========================================================================== */

import { useState } from "react";
import {
  ArrowRight,
  Clock,
  MoonStars,
  Plus,
  SunDim,
  Trash,
  UsersThree,
} from "@phosphor-icons/react";
import {
  type JumuahEntry,
  type OtherKey,
  type PrayerConfig,
  type RelativeTime,
} from "@/lib/prayerConfig";
import {
  FooterActions,
  Loading,
  LoadError,
  ROW_STYLE,
  Segment,
  SettingsShell,
  Stepper,
  usePrayerConfig,
} from "../settings-shared";
import s from "../page.module.css";

/* ── The four choices ────────────────────────────────────────────────────── */

const CHOICES: {
  key: OtherKey;
  name: string;
  desc: string;
  icon: React.ElementType;
}[] = [
  {
    key: "jumuah",
    name: "Jumuah",
    desc: "Up to four sittings, each with its own athan and optional iqamah.",
    icon: UsersThree,
  },
  {
    key: "taraweeh",
    name: "Taraweeh",
    desc: "Night prayers in Ramadan — anchored to Isha or set to a fixed time.",
    icon: MoonStars,
  },
  {
    key: "imsak",
    name: "Imsak",
    desc: "The pre-dawn cutoff, usually a few minutes before the Fajr athan.",
    icon: SunDim,
  },
  {
    key: "iftar",
    name: "Iftar",
    desc: "Breaking the fast — by default, exactly at the Maghrib athan.",
    icon: Clock,
  },
];

const ANCHORS: { value: string; name: string }[] = [
  { value: "isha_athan", name: "Isha — Athan time" },
  { value: "isha_iqamah", name: "Isha — Iqamah time" },
  { value: "fajr_athan", name: "Fajr — Athan time" },
  { value: "fajr_iqamah", name: "Fajr — Iqamah time" },
  { value: "maghrib_athan", name: "Maghrib — Athan time" },
  { value: "maghrib_iqamah", name: "Maghrib — Iqamah time" },
];

const REL_MODES: { value: RelativeTime["mode"]; name: string }[] = [
  { value: "relative", name: "Relative" },
  { value: "fixed", name: "Fixed time" },
];

export default function OtherPrayersPage() {
  const { config, loaded, error, saving, set, save, reload } = usePrayerConfig();
  const [picked, setPicked] = useState<OtherKey | null>(null);

  if (!loaded) {
    return (
      <SettingsShell eyebrow="Prayer Settings · Beyond the Five" title="Other Prayers">
        <Loading />
      </SettingsShell>
    );
  }

  if (!config) {
    return (
      <SettingsShell eyebrow="Prayer Settings · Beyond the Five" title="Other Prayers">
        <LoadError message={error || "The settings could not be read."} onRetry={() => void reload()} />
      </SettingsShell>
    );
  }

  const autosave = config.autosave;
  const choice = CHOICES.find((c) => c.key === picked);

  /* ── Choose ────────────────────────────────────────────────────────────── */

  if (!picked) {
    return (
      <SettingsShell
        eyebrow="Prayer Settings · Beyond the Five"
        title="Which prayer?"
        sub="Pick one to edit — each opens its own page."
      >
        <div className={s.choiceGrid}>
          {CHOICES.map((c, i) => {
            const Icon = c.icon;
            return (
              <button
                key={c.key}
                className={s.choice}
                style={ROW_STYLE(i)}
                onClick={() => setPicked(c.key)}
              >
                <span className={s.choiceIcon}>
                  <Icon size={22} weight="fill" />
                </span>
                <span className={s.choiceName}>{c.name}</span>
                <span className={s.choiceDesc}>{c.desc}</span>
                <ArrowRight className={s.choiceArrow} size={18} weight="bold" />
              </button>
            );
          })}
        </div>
      </SettingsShell>
    );
  }

  /* ── Edit ──────────────────────────────────────────────────────────────── */

  const onSave = () => void save(undefined, `${choice?.name ?? "Other prayers"} saved`);

  return (
    <SettingsShell
      eyebrow="Prayer Settings · Beyond the Five"
      title={choice?.name ?? "Other Prayers"}
      sub={choice?.desc}
      foot={
        <FooterActions
          autosave={autosave}
          saving={saving}
          backLabel="All other prayers"
          onBack={() => setPicked(null)}
          saveLabel="Save changes"
          onSave={onSave}
        />
      }
    >
      {error && <span className={s.saveError}>{error}</span>}

      {picked === "jumuah" ? (
        <JumuahEditor config={config} set={set} />
      ) : (
        <RelativeEditor
          label={choice?.name ?? ""}
          icon={
            picked === "taraweeh" ? (
              <MoonStars size={14} weight="fill" />
            ) : picked === "imsak" ? (
              <SunDim size={14} weight="fill" />
            ) : (
              <Clock size={14} weight="fill" />
            )
          }
          value={config.other[picked]}
          onChange={(v) => set((c) => ({ ...c, other: { ...c.other, [picked]: v } }))}
        />
      )}
    </SettingsShell>
  );
}

/* ==========================================================================
   Editors
   ========================================================================== */

function JumuahEditor({
  config,
  set,
}: {
  config: PrayerConfig;
  set: ReturnType<typeof usePrayerConfig>["set"];
}) {
  const jumuah = config.other.jumuah;

  const patch = (i: number, p: Partial<JumuahEntry>) =>
    set((c) => ({
      ...c,
      other: {
        ...c.other,
        jumuah: c.other.jumuah.map((j, idx) => (idx === i ? { ...j, ...p } : j)),
      },
    }));

  const add = () =>
    set((c) =>
      c.other.jumuah.length >= 4
        ? c
        : {
            ...c,
            other: {
              ...c.other,
              jumuah: [
                ...c.other.jumuah,
                { name: `${c.other.jumuah.length + 1}st Jumuah`, athan: "13:15", iqamah: "" },
              ],
            },
          }
    );

  const remove = (i: number) =>
    set((c) => ({
      ...c,
      other: { ...c.other, jumuah: c.other.jumuah.filter((_, idx) => idx !== i) },
    }));

  return (
    <div className={s.field}>
      <span className={s.fieldLabel}>
        <UsersThree size={13} weight="bold" className={s.labelIcon} /> Jumuah — up to 4
      </span>
      <span className={s.fieldHint}>Each Jumuah needs an athan; the iqamah is optional.</span>

      <div className={s.jumuahList}>
        {jumuah.map((j, i) => (
          <div key={i} className={s.jumuah} style={ROW_STYLE(i)}>
            <div className={s.jumuahHead}>
              <input
                className={s.input}
                value={j.name}
                onChange={(e) => patch(i, { name: e.target.value })}
                style={{ maxWidth: 240, height: 38 }}
              />
              <button className={s.jumuahRemove} onClick={() => remove(i)}>
                <Trash size={13} weight="bold" /> Remove
              </button>
            </div>
            <div className={s.timePair}>
              <label>
                Athan
                <input
                  className={s.input}
                  type="time"
                  value={j.athan}
                  onChange={(e) => patch(i, { athan: e.target.value })}
                />
              </label>
              <label>
                Iqamah (optional)
                <input
                  className={s.input}
                  type="time"
                  value={j.iqamah}
                  onChange={(e) => patch(i, { iqamah: e.target.value })}
                  min={j.athan || undefined}
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      <button className={s.addBtn} onClick={add} disabled={jumuah.length >= 4}>
        <Plus size={14} weight="bold" />
        {jumuah.length >= 4 ? "All 4 Jumuah added" : "Add Jumuah"}
      </button>
    </div>
  );
}

function RelativeEditor({
  label,
  icon,
  value,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  value: RelativeTime;
  onChange: (v: RelativeTime) => void;
}) {
  return (
    <div className={s.subCard}>
      <h3 className={s.subTitle}>
        <span className={s.subTitleIcon}>{icon}</span>
        {label}
      </h3>

      <Segment
        options={REL_MODES}
        value={value.mode}
        onChange={(v) => onChange({ ...value, mode: v })}
        small
      />

      {value.mode === "relative" ? (
        <>
          <div className={s.stack}>
            <span className={s.fieldLabel}>Relative to</span>
            <select
              className={s.select}
              value={value.anchor}
              onChange={(e) => onChange({ ...value, anchor: e.target.value })}
            >
              {ANCHORS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <Stepper
            value={value.minutes}
            onChange={(v) => onChange({ ...value, minutes: v })}
            min={-180}
            max={180}
            unit="minutes"
          />
          <span className={s.rangeNote}>Negative = before the anchor, positive = after.</span>
        </>
      ) : (
        <div className={s.stack}>
          <span className={s.fieldLabel}>Fixed time</span>
          <input
            className={s.input}
            type="time"
            value={value.time}
            onChange={(e) => onChange({ ...value, time: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
