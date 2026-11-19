// Site settings: schema, defaults, path helpers.
// Persisted in Supabase Auth `app_metadata.site_settings` (service-role only) — no SQL needed.

export type FieldType = "text" | "textarea" | "number" | "toggle" | "select" | "color" | "email";

export interface FieldDef {
  key: string;
  label: string;
  hint?: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  placeholder?: string;
  min?: number;
  max?: number;
}

export interface SectionDef {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  fields: FieldDef[];
}

export const DEFAULT_SETTINGS = {
  site: {
    name: "Masjid As Sunnah",
    tagline: "A house of worship, knowledge and community",
    address: "132-136 Haldon St, Lakemba NSW 2195, Australia",
    email: "info@masjidassunnah.com.au",
    phone: "+61 484 518 332",
    currency: "AUD",
    language: "en",
    timezone: "Australia/Sydney",
    maintenance: false,
  },
  appearance: {
    theme: "light",
    accent: "#0f4a36",
    density: "comfortable",
    motion: "full",
    pattern: "subtle",
    fontScale: 100,
    timeFormat: "12",
  },
  events: {
    upcomingOnly: true,
    homeMax: 7,
    showPast: true,
    defaultOpen: true,
    reminderDays: 3,
    slugPrefix: "",
  },
  signup: {
    enabled: true,
    approval: "manual",
    autoReply: true,
    maxImageMb: 5,
    allowPdf: true,
    deadlineHours: 2,
    confirmation: "Jazak Allahu khayran. Your registration has been received.",
  },
  donations: {
    enabled: true,
    showBank: true,
    showCard: true,
    accountName: "Sunnah Foundation Australia",
    bsb: "611 100",
    account: "401328",
    abn: "61 678 328 599",
    stripeKey: "",
    goal: 0,
    minAmount: 5,
  },
  socials: {
    facebook: "https://www.facebook.com/masjidassunnahlakemba/",
    instagram: "https://www.instagram.com/masjid.as.sunnah/",
    youtube: "https://www.youtube.com/@MasjidAsSunnahLakemba",
    tiktok: "",
    telegram: "",
    whatsapp: "",
  },
  seo: {
    title: "Masjid As Sunnah",
    description: "",
    ogImage: "",
    robots: "index,follow",
    analyticsId: "",
  },
  notifications: {
    newResponse: true,
    dailyDigest: false,
    eventReminders: true,
    managerInvites: true,
    replyTo: "info@masjidassunnah.com.au",
  },
  security: {
    sessionHours: 12,
    reauthDeletes: true,
    auditDays: 90,
    logIp: true,
    allowedDomains: "",
  },
  advanced: {
    cacheSeconds: 60,
    featureForms: true,
    featureEvents: true,
    featureDonations: true,
    debug: false,
  },
  prayer: {
    // The changeable slug that follows the hardcoded Masjidbox prefix.
    // Fetch URL = https://masjidbox.com/prayer-times/<slug>
    // API URL    = https://api.masjidbox.com/1.0/masjidbox/landing/athany/<slug>
    slug: "masjidassunnah",
    // Mirrors `prayer_settings.autosave` — the toggle lives here in Settings
    // rather than on each prayer page. /api/prayer/config stays authoritative
    // (the Settings page re-reads it on load); this copy is the offline
    // fallback so the page still renders a sensible value if that read fails.
    autosave: true,
  },
} as const;

export type Settings = typeof DEFAULT_SETTINGS;

export const SECTIONS: SectionDef[] = [
  {
    id: "site",
    title: "Site identity",
    subtitle: "Name, tagline, contact and locale",
    icon: "building",
    fields: [
      { key: "site.name", label: "Site name", type: "text" },
      { key: "site.tagline", label: "Tagline", type: "text" },
      { key: "site.address", label: "Address", type: "text" },
      { key: "site.email", label: "Public email", type: "email" },
      { key: "site.phone", label: "Phone", type: "text", placeholder: "02 0000 0000" },
      {
        key: "site.currency",
        label: "Currency",
        type: "select",
        options: [
          { value: "AUD", label: "AUD — Australian dollar" },
          { value: "USD", label: "USD — US dollar" },
          { value: "GBP", label: "GBP — Pound sterling" },
          { value: "EUR", label: "EUR — Euro" },
        ],
      },
      {
        key: "site.language",
        label: "Default language",
        type: "select",
        options: [
          { value: "en", label: "English" },
          { value: "ar", label: "العربية (Arabic)" },
        ],
      },
      {
        key: "site.timezone",
        label: "Time zone",
        type: "select",
        options: [
          { value: "Australia/Sydney", label: "Australia/Sydney" },
          { value: "Australia/Perth", label: "Australia/Perth" },
          { value: "Europe/London", label: "Europe/London" },
          { value: "America/New_York", label: "America/New_York" },
        ],
      },
      { key: "site.maintenance", label: "Maintenance mode", hint: "Shows a maintenance notice on the public site.", type: "toggle" },
    ],
  },
  {
    id: "prayer-times",
    title: "Prayer times",
    subtitle: "Autosave behaviour for the prayer pages",
    icon: "clock",
    fields: [
      {
        key: "prayer.autosave",
        label: "Autosave changes",
        hint: "When on, every edit on the Athan, Iqamah, Other Prayers and Salah Duration pages is written immediately and those pages show no Save button. Turn it off to review changes and press Save yourself.",
        type: "toggle",
      },
    ],
  },
  {
    id: "appearance",
    title: "Appearance",
    subtitle: "Theme, motion, pattern and type scale",
    icon: "palette",
    fields: [
      {
        key: "appearance.theme",
        label: "Theme",
        type: "select",
        options: [
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
          { value: "auto", label: "Follow system" },
        ],
      },
      { key: "appearance.accent", label: "Accent colour", type: "color" },
      {
        key: "appearance.density",
        label: "Density",
        type: "select",
        options: [
          { value: "comfortable", label: "Comfortable" },
          { value: "compact", label: "Compact" },
        ],
      },
      {
        key: "appearance.motion",
        label: "Motion",
        hint: "Full = smooth reveals. Reduced = minimal transitions.",
        type: "select",
        options: [
          { value: "full", label: "Full" },
          { value: "reduced", label: "Reduced" },
        ],
      },
      {
        key: "appearance.pattern",
        label: "Islamic pattern layer",
        type: "select",
        options: [
          { value: "subtle", label: "Subtle" },
          { value: "off", label: "Off" },
        ],
      },
      { key: "appearance.fontScale", label: "Font scale (%)", type: "number", min: 85, max: 130 },
      {
        key: "appearance.timeFormat",
        label: "Time format",
        type: "select",
        options: [
          { value: "12", label: "12-hour" },
          { value: "24", label: "24-hour" },
        ],
      },
    ],
  },
  {
    id: "events",
    title: "Events",
    subtitle: "What the public events listing shows",
    icon: "calendar",
    fields: [
      { key: "events.upcomingOnly", label: "Show upcoming events only", hint: "Past events stay reachable on their own page.", type: "toggle" },
      { key: "events.homeMax", label: "Max events on the listing", hint: "Home page and events page cap.", type: "number", min: 1, max: 30 },
      { key: "events.showPast", label: "Show past events", type: "toggle" },
      { key: "events.defaultOpen", label: "New events open for registration", type: "toggle" },
      { key: "events.reminderDays", label: "Reminder lead time (days)", type: "number", min: 0, max: 30 },
      { key: "events.slugPrefix", label: "Slug prefix", hint: "Optional, e.g. “syd-”.", type: "text", placeholder: "optional" },
    ],
  },
  {
    id: "signup",
    title: "Forms & registration",
    subtitle: "Approvals, uploads and confirmations",
    icon: "form",
    fields: [
      { key: "signup.enabled", label: "Registration enabled", type: "toggle" },
      {
        key: "signup.approval",
        label: "New responses",
        type: "select",
        options: [
          { value: "manual", label: "Pending — manual approval" },
          { value: "auto", label: "Approved automatically" },
          { value: "closed", label: "Closed to new responses" },
        ],
      },
      { key: "signup.autoReply", label: "Send confirmation reply", type: "toggle" },
      { key: "signup.maxImageMb", label: "Max image size (MB)", type: "number", min: 1, max: 20 },
      { key: "signup.allowPdf", label: "Allow PDF uploads", type: "toggle" },
      { key: "signup.deadlineHours", label: "Edit window (hours after submit)", type: "number", min: 0, max: 168 },
      { key: "signup.confirmation", label: "Confirmation message", type: "textarea" },
    ],
  },
  {
    id: "donations",
    title: "Donations",
    subtitle: "Bank transfer and card payments",
    icon: "heart",
    fields: [
      { key: "donations.enabled", label: "Donations enabled", type: "toggle" },
      { key: "donations.showBank", label: "Show bank transfer", type: "toggle" },
      { key: "donations.showCard", label: "Show card payments (Stripe)", type: "toggle" },
      { key: "donations.accountName", label: "Account name", type: "text" },
      { key: "donations.bsb", label: "BSB", type: "text" },
      { key: "donations.account", label: "Account number", type: "text" },
      { key: "donations.abn", label: "ABN", type: "text" },
      { key: "donations.stripeKey", label: "Stripe publishable key", hint: "Uses VITE_STRIPE_PUBLISHABLE_KEY when empty.", type: "text", placeholder: "pk_test_…" },
      { key: "donations.goal", label: "Fundraising goal (0 = none)", type: "number", min: 0, max: 100000000 },
      { key: "donations.minAmount", label: "Minimum amount", type: "number", min: 1, max: 10000 },
    ],
  },
  {
    id: "socials",
    title: "Social links",
    subtitle: "Shown in the site footer",
    icon: "share",
    fields: [
      { key: "socials.facebook", label: "Facebook", type: "text", placeholder: "https://facebook.com/…" },
      { key: "socials.instagram", label: "Instagram", type: "text", placeholder: "https://instagram.com/…" },
      { key: "socials.youtube", label: "YouTube", type: "text", placeholder: "https://youtube.com/@…" },
      { key: "socials.tiktok", label: "TikTok", type: "text", placeholder: "https://tiktok.com/@…" },
      { key: "socials.telegram", label: "Telegram", type: "text", placeholder: "https://t.me/…" },
      { key: "socials.whatsapp", label: "WhatsApp", type: "text", placeholder: "https://wa.me/…" },
    ],
  },
  {
    id: "seo",
    title: "SEO & analytics",
    subtitle: "Search appearance and tracking",
    icon: "search",
    fields: [
      { key: "seo.title", label: "Meta title", type: "text" },
      { key: "seo.description", label: "Meta description", type: "textarea" },
      { key: "seo.ogImage", label: "Share image URL", type: "text", placeholder: "https://…/og.jpg" },
      {
        key: "seo.robots",
        label: "Robots",
        type: "select",
        options: [
          { value: "index,follow", label: "index, follow" },
          { value: "noindex,nofollow", label: "noindex, nofollow" },
        ],
      },
      { key: "seo.analyticsId", label: "Analytics ID", hint: "GA4 or Plausible domain.", type: "text", placeholder: "G-XXXXXXXXXX" },
    ],
  },
  {
    id: "notifications",
    title: "Notifications",
    subtitle: "What the team gets emailed about",
    icon: "bell",
    fields: [
      { key: "notifications.newResponse", label: "New form response", type: "toggle" },
      { key: "notifications.dailyDigest", label: "Daily digest", type: "toggle" },
      { key: "notifications.eventReminders", label: "Event reminders", type: "toggle" },
      { key: "notifications.managerInvites", label: "Manager invitations", type: "toggle" },
      { key: "notifications.replyTo", label: "Reply-to address", type: "email" },
    ],
  },
  {
    id: "security",
    title: "Security",
    subtitle: "Sessions, audit trail and access",
    icon: "shield",
    fields: [
      { key: "security.sessionHours", label: "Session length (hours)", type: "number", min: 1, max: 720 },
      { key: "security.reauthDeletes", label: "Confirm before deleting", type: "toggle" },
      { key: "security.auditDays", label: "Audit log retention (days)", type: "number", min: 7, max: 3650 },
      { key: "security.logIp", label: "Record IP addresses", type: "toggle" },
      { key: "security.allowedDomains", label: "Allowed email domains", hint: "Comma separated. Empty = any domain.", type: "text", placeholder: "masjidassunnah.com.au" },
    ],
  },
  {
    id: "advanced",
    title: "Advanced",
    subtitle: "Feature flags, caching and diagnostics",
    icon: "sliders",
    fields: [
      { key: "advanced.featureForms", label: "Feature: forms", type: "toggle" },
      { key: "advanced.featureEvents", label: "Feature: events", type: "toggle" },
      { key: "advanced.featureDonations", label: "Feature: donations", type: "toggle" },
      { key: "advanced.cacheSeconds", label: "Public cache (seconds)", type: "number", min: 0, max: 3600 },
      { key: "advanced.debug", label: "Debug logging", type: "toggle" },
    ],
  },
];

/* Prayer settings live on their own dedicated page (/dashboard/prayer-settings),
   so this section is intentionally kept out of the main SECTIONS list (it won't
   show in the general Settings drill-in). Its fields are still registered with
   the settings API via allFieldKeys() below. */
export const PRAYER_SECTION: SectionDef = {
  id: "prayer",
  title: "Prayer times source",
  subtitle: "Where athan & iqamah times are fetched from",
  icon: "clock",
  fields: [
    {
      key: "prayer.slug",
      label: "Masjidbox slug",
      hint: "The segment after https://masjidbox.com/prayer-times/. Changing it re-points every prayer container everywhere.",
      type: "text",
      placeholder: "masjidassunnah",
    },
  ],
};

/* The Masjidbox prefix is fixed; only the slug after it is changeable. */
export const MASJIDBOX_WIDGET_PREFIX = "https://masjidbox.com/prayer-times/";
export const MASJIDBOX_API_PREFIX = "https://api.masjidbox.com/1.0/masjidbox/landing/athany/";
export const DEFAULT_PRAYER_SLUG = "masjidassunnah";

export function prayerWidgetUrl(slug: string): string {
  return `${MASJIDBOX_WIDGET_PREFIX}${slug || DEFAULT_PRAYER_SLUG}`;
}
export function prayerApiUrl(slug: string): string {
  return `${MASJIDBOX_API_PREFIX}${slug || DEFAULT_PRAYER_SLUG}`;
}
export function normaliseSlug(input: string): string {
  return input.trim().replace(/^\/+|\/+$/g, "");
}

export function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[part];
    return undefined;
  }, obj);
}

export function setPath<T extends object>(obj: T, path: string, value: unknown): T {
  const parts = path.split(".");
  const clone: Record<string, unknown> = { ...(obj as Record<string, unknown>) };
  let cursor: Record<string, unknown> = clone;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const next = cursor[key];
    cursor[key] = next && typeof next === "object" ? { ...(next as Record<string, unknown>) } : {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
  return clone as T;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function mergeSettings<T extends object>(base: T, incoming: unknown): T {
  if (!isPlainObject(incoming)) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(incoming)) {
    const current = out[k];
    out[k] = isPlainObject(current) && isPlainObject(v) ? mergeSettings(current, v) : v;
  }
  return out as T;
}

export function allFieldKeys(): string[] {
  return [...SECTIONS, PRAYER_SECTION].flatMap((s) => s.fields.map((f) => f.key));
}
