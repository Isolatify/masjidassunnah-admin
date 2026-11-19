"use client";

/* ==========================================================================
   Salah Duration — a page, not a popup.

   How long each prayer is held for. With autosave on there is no Save
   button; with it off, Save changes appears in the footer.
   ========================================================================== */

import {
  IQAMAH_KEYS,
  PRAYER_LABELS,
  type DurationConfig,
} from "@/lib/prayerConfig";
import {
  FooterActions,
  Loading,
  LoadError,
  PRAYER_ICONS,
  ROW_STYLE,
  SettingsShell,
  Stepper,
  usePrayerConfig,
} from "../settings-shared";
import s from "../page.module.css";

export default function SalahDurationPage() {
  const { config, loaded, error, saving, set, save, reload } = usePrayerConfig();

  if (!loaded) {
    return (
      <SettingsShell eyebrow="Prayer Settings · Timings" title="Salah Duration">
        <Loading />
      </SettingsShell>
    );
  }

  if (!config) {
    return (
      <SettingsShell eyebrow="Prayer Settings · Timings" title="Salah Duration">
        <LoadError
          message={error || "The settings could not be read."}
          onRetry={() => void reload()}
        />
      </SettingsShell>
    );
  }

  const autosave = config.autosave;
  const durations = config.durations;

  const setDuration = (key: keyof DurationConfig, value: number) =>
    set((c) => ({ ...c, durations: { ...c.durations, [key]: value } }));

  return (
    <SettingsShell
      eyebrow="Prayer Settings · Timings"
      title="Salah Duration"
      sub="How long each prayer is held for, in minutes after the iqamah."
      foot={
        <FooterActions
          autosave={autosave}
          saving={saving}
          saveLabel="Save changes"
          onSave={() => void save(undefined, "Salah durations saved")}
        />
      }
    >
      {error && <span className={s.saveError}>{error}</span>}

      <div className={s.durationList}>
        {IQAMAH_KEYS.map((key, i) => {
          const Icon = PRAYER_ICONS[key];
          return (
            <div key={key} className={s.durationRow} style={ROW_STYLE(i)}>
              <span className={s.ruleIcon}>
                <Icon size={17} weight="fill" />
              </span>
              <span className={s.durationName}>
                <strong>{PRAYER_LABELS[key]}</strong>
                <em>Minutes</em>
              </span>
              <Stepper
                value={durations[key]}
                onChange={(v) => setDuration(key, v)}
                min={0}
                max={180}
                unit="min"
              />
            </div>
          );
        })}
      </div>
    </SettingsShell>
  );
}
