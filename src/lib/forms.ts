import {
  parsePhoneNumberFromString,
  getCountries,
  getCountryCallingCode,
  type CountryCode,
} from "libphonenumber-js";

export type FieldType =
  | "short_text"
  | "long_text"
  | "email"
  | "number"
  | "phone"
  | "url"
  | "date"
  | "time"
  | "multiple_choice"
  | "checkboxes"
  | "dropdown"
  | "yes_no"
  | "legal"
  | "picture_choice"
  | "rating"
  | "opinion_scale"
  | "nps"
  | "ranking"
  | "matrix"
  | "full_name"
  | "address"
  | "file_upload"
  | "signature"
  | "statement"
  | "image"
  | "video"
  | "section"
  | "divider";

export type LayoutType = "statement" | "image" | "video" | "section" | "divider";

export interface FormField {
  id: string;
  type: FieldType;
  title: string;
  description?: string;
  required?: boolean;
  placeholder?: string;
  default_value?: string;
  options?: string[];
  max?: number;

  images?: (string | undefined)[];
  allow_other?: boolean;
  other_placeholder?: string;
  shuffle_options?: boolean;

  min_length?: number;
  max_length?: number;
  min_value?: number;
  max_value?: number;
  min_selections?: number;
  max_selections?: number;
  regex?: string;
  regex_error?: string;

  image?: string;
  video?: string;

  scale_min?: number;
  scale_max?: number;
  scale_label_low?: string;
  scale_label_high?: string;
  scale_label_center?: string;
  rating_shape?: "star" | "heart" | "thumb";

  rows?: string[];
  columns?: string[];
  matrix_multi?: boolean;
  limit_one_per_column?: boolean;

  include_time?: boolean;
  time_kind?: "time" | "duration";

  name_fields?: string[];
  address_fields?: string[];

  file_accept?: string;
  max_file_mb?: number;
  max_files?: number;

  correct_value?: string | string[] | number;
  points?: number;

  branches?: Record<string, string>;

  link?: string;
  link_text?: string;

  phone_country?: string;
  allow_country_change?: boolean;
}

export type DisplayMode = "classic" | "one_at_a_time";

export interface FormTheme {
  bg?: string;
  primary?: string;
  text?: string;
  font?: string;
  logo_url?: string;
  background_image?: string;
}

export interface ThankYou {
  title?: string;
  message?: string;
  redirect_url?: string;
  confirmation_link?: string;
  confirmation_link_text?: string;
}

export type CompareOp =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "empty"
  | "not_empty"
  | "regex"
  | "before"
  | "after"
  | "age_lt"
  | "age_lte"
  | "age_gt"
  | "age_gte"
  | "one_of"
  | "not_one_of"
  | "is_true"
  | "is_false";

export type ConditionOp = CompareOp;

export interface ConditionRule {
  id: string;
  fieldId: string;
  op: ConditionOp;
  value: string;
  action: "show" | "hide";
  targetId: string;
}

/** A single "answer check" used by both show/hide rules and rejection rules. */
export interface ValidationCondition {
  id: string;
  fieldId: string;
  op: CompareOp;
  /** Literal value, comma list, date (`17/10/2026`, `today`, `-13y`) or `field:<id>`. */
  value: string;
}

/** Blocks submission with a custom message when the conditions match. */
export interface ValidationRule {
  id: string;
  match: "all" | "any";
  conditions: ValidationCondition[];
  message: string;
  enabled?: boolean;
}

export const CONDITION_OPS: { value: CompareOp; label: string }[] = [
  { value: "equals", label: "is equal to" },
  { value: "not_equals", label: "is not equal to" },
  { value: "contains", label: "contains" },
  { value: "not_contains", label: "does not contain" },
  { value: "gt", label: "is greater than" },
  { value: "gte", label: "is greater than or equal to" },
  { value: "lt", label: "is less than" },
  { value: "lte", label: "is less than or equal to" },
  { value: "empty", label: "is empty" },
  { value: "not_empty", label: "is not empty" },
  { value: "regex", label: "matches pattern (regex)" },
  { value: "before", label: "date is before" },
  { value: "after", label: "date is after" },
  { value: "age_lt", label: "is younger than (age)" },
  { value: "age_lte", label: "is this age or younger" },
  { value: "age_gt", label: "is older than (age)" },
  { value: "age_gte", label: "is this age or older" },
  { value: "one_of", label: "is one of" },
  { value: "not_one_of", label: "is none of" },
  { value: "is_true", label: "is checked / yes" },
  { value: "is_false", label: "is unchecked / no" },
];

export const NO_VALUE_OPS: CompareOp[] = [
  "empty",
  "not_empty",
  "is_true",
  "is_false",
];

/** Operators whose value can also be answered by another question (`field:<id>`). */
export const FIELD_VALUE_OPS: CompareOp[] = [
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "gt",
  "gte",
  "lt",
  "lte",
  "before",
  "after",
  "one_of",
  "not_one_of",
];

/** Operators whose value is a date (`17/10/2026`, `today`, `-13y`, `+7d`). */
export const DATE_VALUE_OPS: CompareOp[] = ["before", "after"];

export const THEME_FONTS: { value: string; label: string; stack: string }[] = [
  { value: "system", label: "System", stack: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" },
  { value: "inter", label: "Inter", stack: "Inter, system-ui, sans-serif" },
  { value: "outfit", label: "Outfit", stack: "Outfit, system-ui, sans-serif" },
  { value: "roboto", label: "Roboto", stack: "Roboto, system-ui, sans-serif" },
  { value: "poppins", label: "Poppins", stack: "Poppins, system-ui, sans-serif" },
  { value: "montserrat", label: "Montserrat", stack: "Montserrat, system-ui, sans-serif" },
  { value: "lato", label: "Lato", stack: "Lato, system-ui, sans-serif" },
  { value: "raleway", label: "Raleway", stack: "Raleway, system-ui, sans-serif" },
  { value: "nunito", label: "Nunito", stack: "Nunito, system-ui, sans-serif" },
  { value: "open-sans", label: "Open Sans", stack: "'Open Sans', system-ui, sans-serif" },
  { value: "dm-sans", label: "DM Sans", stack: "'DM Sans', system-ui, sans-serif" },
  { value: "manrope", label: "Manrope", stack: "Manrope, system-ui, sans-serif" },
  { value: "space-grotesk", label: "Space Grotesk", stack: "'Space Grotesk', system-ui, sans-serif" },
  { value: "rubik", label: "Rubik", stack: "Rubik, system-ui, sans-serif" },
  { value: "playfair", label: "Playfair Display", stack: "'Playfair Display', Georgia, serif" },
  { value: "merriweather", label: "Merriweather", stack: "Merriweather, Georgia, serif" },
  { value: "serif", label: "Classic serif", stack: "Georgia, Cambria, Times New Roman, serif" },
  { value: "mono", label: "Monospace", stack: "ui-monospace, Consolas, monospace" },
];

export function fontStack(value?: string): string {
  return (THEME_FONTS.find((f) => f.value === value) || THEME_FONTS[0]).stack;
}

export interface PresentationSettings {
  progress_bar?: boolean;
  question_numbers?: boolean;
  shuffle_questions?: boolean;
  width?: "comfortable" | "compact";
  timer_minutes?: number;
}

export interface ResponseSettings {
  accept?: boolean;
  closed_message?: string;
  start_at?: string;
  end_at?: string;
  max_responses?: number;
  duplicate_per_browser?: boolean;
  edit_enabled?: boolean;
}

export interface QuizSettings {
  enabled?: boolean;
  show_score?: boolean;
  show_answers?: boolean;
  pass_mark?: number;
}

export interface FormSettings {
  display?: DisplayMode;
  theme?: FormTheme;
  thank_you?: ThankYou;
  conditions?: ConditionRule[];
  validation?: ValidationRule[];
  welcome_enabled?: boolean;
  welcome_title?: string;
  welcome_description?: string;
  welcome_button?: string;
  ending_title?: string;
  ending_message?: string;
  presentation?: PresentationSettings;
  responses?: ResponseSettings;
  quiz?: QuizSettings;
  hidden_fields?: string[];
}

export interface FormRecord {
  id: string;
  title: string;
  slug: string;
  description: string;
  fields: FormField[];
  settings: FormSettings;
  status: string;
  created_at: string;
  updated_at?: string;
  response_count?: number;
}

export type AnswerValue = string | string[] | number | boolean | null | Record<string, unknown>;
export type AnswerMap = Record<string, AnswerValue>;

export const LAYOUT_TYPES: LayoutType[] = ["statement", "image", "video", "section", "divider"];

export function isLayout(type: FieldType): boolean {
  return LAYOUT_TYPES.includes(type as LayoutType);
}

export function isChoiceType(type: FieldType): boolean {
  return (
    type === "multiple_choice" ||
    type === "checkboxes" ||
    type === "dropdown" ||
    type === "picture_choice"
  );
}

export const FIELD_LABELS: Record<FieldType, string> = {
  short_text: "Short text",
  long_text: "Long text",
  email: "Email",
  number: "Number",
  phone: "Phone",
  url: "Website",
  date: "Date",
  time: "Time",
  multiple_choice: "Choice Picker",
  checkboxes: "Multiple Choice",
  dropdown: "Dropdown",
  yes_no: "Yes / No",
  legal: "Terms & conditions",
  picture_choice: "Picture choice",
  rating: "Rating",
  opinion_scale: "Opinion scale",
  nps: "Net Promoter Score",
  ranking: "Ranking",
  matrix: "Matrix",
  full_name: "Full name",
  address: "Address",
  file_upload: "File upload",
  signature: "Signature",
  statement: "Statement",
  image: "Image",
  video: "Video",
  section: "Section",
  divider: "Divider",
};

export const FIELD_SHORT: Record<FieldType, string> = {
  short_text: "Short answer",
  long_text: "Long answer",
  email: "Email",
  number: "Number",
  phone: "Phone number",
  url: "Website URL",
  date: "Date",
  time: "Time",
  multiple_choice: "Choice Picker",
  checkboxes: "Multiple Choice",
  dropdown: "Dropdown",
  yes_no: "Yes / No",
  legal: "Terms checkbox",
  picture_choice: "Picture choice",
  rating: "Rating scale",
  opinion_scale: "Opinion scale",
  nps: "NPS 0–10",
  ranking: "Ranking",
  matrix: "Matrix / grid",
  full_name: "Name (first + last)",
  address: "Address",
  file_upload: "File upload",
  signature: "Signature",
  statement: "Text block",
  image: "Image",
  video: "Video",
  section: "Section break",
  divider: "Divider line",
};

export const CHOICE_TYPES: FieldType[] = [
  "multiple_choice",
  "checkboxes",
  "dropdown",
  "picture_choice",
];

export const ANSWER_TYPES: FieldType[] = [
  "short_text",
  "long_text",
  "email",
  "number",
  "phone",
  "url",
  "date",
  "time",
  "multiple_choice",
  "checkboxes",
  "dropdown",
  "yes_no",
  "legal",
  "picture_choice",
  "rating",
  "opinion_scale",
  "nps",
  "ranking",
  "matrix",
  "full_name",
  "address",
  "file_upload",
  "signature",
];

export const DEFAULT_TITLES: Record<FieldType, string> = {
  short_text: "Your answer",
  long_text: "Your answer",
  email: "Your email address",
  number: "Your answer",
  phone: "Your phone number",
  url: "https://",
  date: "Pick a date",
  time: "Pick a time",
  multiple_choice: "Choose an option",
  checkboxes: "Choose all that apply",
  dropdown: "Choose an option",
  yes_no: "Yes or no?",
  legal: "I agree to the terms",
  picture_choice: "Choose a picture",
  rating: "How would you rate it?",
  opinion_scale: "How do you feel about this?",
  nps: "How likely are you to recommend us to a friend?",
  ranking: "Put these in order of preference",
  matrix: "Rate each of the following",
  full_name: "What is your name?",
  address: "What is your address?",
  file_upload: "Upload a file",
  signature: "Sign here",
  statement: "A quick note before we start",
  image: "",
  video: "",
  section: "Section",
  divider: "",
};

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function newField(type: FieldType): FormField {
  const field: FormField = { id: uid(), type, title: DEFAULT_TITLES[type], required: !isLayout(type) };

  if (type === "short_text") field.placeholder = "Type your answer…";
  if (type === "long_text") field.placeholder = "Type your answer…";
  if (type === "email") field.placeholder = "name@example.com";
  if (type === "phone") {
    field.placeholder = "04xx xxx xxx";
    field.phone_country = "au";
    field.allow_country_change = true;
  }
  if (type === "url") field.placeholder = "https://example.com";

  if (type === "multiple_choice" || type === "checkboxes" || type === "dropdown") {
    field.options = ["Option 1", "Option 2"];
  }
  if (type === "picture_choice") {
    field.options = ["Option 1", "Option 2"];
    field.images = ["", ""];
  }
  if (type === "legal") {
    field.link_text = "the terms";
    field.link = "";
    field.required = true;
  }
  if (type === "rating") {
    field.max = 5;
    field.rating_shape = "star";
  }
  if (type === "opinion_scale") {
    field.scale_min = 0;
    field.scale_max = 10;
    field.scale_label_low = "Not likely";
    field.scale_label_high = "Very likely";
  }
  if (type === "nps") {
    field.scale_min = 0;
    field.scale_max = 10;
    field.scale_label_low = "Not at all likely";
    field.scale_label_high = "Extremely likely";
  }
  if (type === "ranking") {
    field.options = ["First choice", "Second choice", "Third choice"];
  }
  if (type === "matrix") {
    field.rows = ["Item 1", "Item 2"];
    field.columns = ["Strongly disagree", "Disagree", "Agree", "Strongly agree"];
    field.matrix_multi = false;
    field.limit_one_per_column = false;
  }
  if (type === "full_name") field.name_fields = ["first", "last"];
  if (type === "address") field.address_fields = ["street", "city", "state", "postcode", "country"];
  if (type === "file_upload") {
    field.file_accept = "";
    field.max_file_mb = 10;
    field.max_files = 1;
  }
  if (type === "time") field.time_kind = "time";
  if (type === "date") field.include_time = false;
  if (type === "section") {
    field.title = "Section";
    field.description = "";
  }
  if (type === "image") field.image = "";
  if (type === "video") field.video = "";
  if (type === "statement") field.description = "";
  return field;
}

export function defaultTheme(): FormTheme {
  return {
    bg: "#f4f6f4",
    primary: "#026839",
    text: "#14201a",
    font: "system",
    logo_url: "",
    background_image: "",
  };
}

export function defaultPresentation(): PresentationSettings {
  return {
    progress_bar: true,
    question_numbers: true,
    shuffle_questions: false,
    width: "comfortable",
    timer_minutes: 0,
  };
}

export function defaultResponses(): ResponseSettings {
  return {
    accept: true,
    closed_message: "This form is no longer accepting responses.",
    start_at: "",
    end_at: "",
    max_responses: 0,
    duplicate_per_browser: false,
    edit_enabled: true,
  };
}

export function defaultQuiz(): QuizSettings {
  return { enabled: false, show_score: true, show_answers: true, pass_mark: 0 };
}

export function defaultSettings(): FormSettings {
  return {
    display: "classic",
    theme: defaultTheme(),
    thank_you: { title: "Thank You!", message: "Your response has been recorded." },
    conditions: [],
    validation: [],
    welcome_enabled: true,
    welcome_title: "Hey there!",
    welcome_description: "This will only take a minute.",
    welcome_button: "Start",
    ending_title: "Thanks for your time!",
    ending_message: "Your response has been recorded.",
    presentation: defaultPresentation(),
    responses: defaultResponses(),
    quiz: defaultQuiz(),
    hidden_fields: [],
  };
}

export function withDefaults(settings?: FormSettings): FormSettings {
  const s = settings || {};
  return {
    ...defaultSettings(),
    ...s,
    theme: { ...defaultTheme(), ...(s.theme || {}) },
    thank_you: { ...(defaultSettings().thank_you || {}), ...(s.thank_you || {}) },
    presentation: { ...defaultPresentation(), ...(s.presentation || {}) },
    responses: { ...defaultResponses(), ...(s.responses || {}) },
    quiz: { ...defaultQuiz(), ...(s.quiz || {}) },
    conditions: s.conditions || [],
    validation: s.validation || [],
    hidden_fields: s.hidden_fields || [],
  };
}

/* ================= conditions & visibility ================= */

function isEmptyAnswer(value: AnswerValue): boolean {
  if (typeof value === "string" && value.startsWith("__other__:")) {
    return value.slice("__other__:".length).trim() === "";
  }
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0)
  );
}

/* ================= comparison engine ================= */

function answerString(value: AnswerValue): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") {
    return value.startsWith("__other__:") ? value.slice("__other__:".length) : value;
  }
  if (Array.isArray(value)) return value.map((v) => String(v)).join(", ");
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map((v) => String(v ?? ""))
      .join(" ");
  }
  return String(value);
}

function answerNumbers(value: AnswerValue): number[] {
  if (Array.isArray(value)) {
    return value.map((v) => Number(v)).filter((n) => !Number.isNaN(n));
  }
  const n = Number(value);
  return Number.isNaN(n) || value === "" || value === null ? [] : [n];
}

/** Accepts `YYYY-MM-DD[THH:mm]`, `DD/MM/YYYY`, `D-M-YYYY`, `today`, `now`. */
export function parseLooseDate(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;

  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (iso) {
    return new Date(
      +iso[1],
      +iso[2] - 1,
      +iso[3],
      iso[4] ? +iso[4] : 0,
      iso[5] ? +iso[5] : 0,
      iso[6] ? +iso[6] : 0
    ).getTime();
  }

  const p = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})(?:[T ,]+(\d{1,2}):(\d{2}))?/);
  if (p) {
    const a = +p[1];
    const b = +p[2];
    let year = +p[3];
    let day = a;
    let month = b;
    if (a <= 12 && b > 12) {
      day = b;
      month = a; // mm/dd/yyyy — only when the second part cannot be a month
    } else if (a > 12) {
      day = a;
      month = b; // dd/mm/yyyy
    } else {
      day = a;
      month = b; // ambiguous → assume day-first (en-AU)
    }
    if (year < 100) year += 2000;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return new Date(year, month - 1, day, p[4] ? +p[4] : 0, p[5] ? +p[5] : 0).getTime();
  }

  const fallback = new Date(s);
  return Number.isNaN(fallback.getTime()) ? null : fallback.getTime();
}

/** Value side of date operators: `today`, `now`, `+7d`, `-13y`, or any date string. */
function resolveDateOperand(raw: string, now: number): number | null {
  const v = (raw || "").trim().toLowerCase();
  if (!v) return null;
  if (v === "now") return now;
  if (v === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  const rel = v.match(/^([+-])(\d+)\s*([dwmy])$/);
  if (rel) {
    const sign = rel[1] === "-" ? -1 : 1;
    const n = +rel[2];
    const d = new Date(now);
    if (rel[3] === "d") d.setDate(d.getDate() + sign * n);
    else if (rel[3] === "w") d.setDate(d.getDate() + sign * n * 7);
    else if (rel[3] === "m") d.setMonth(d.getMonth() + sign * n);
    else d.setFullYear(d.getFullYear() + sign * n);
    return d.getTime();
  }
  return parseLooseDate(raw);
}

function ageFromTs(ts: number, now: number): number {
  const dob = new Date(ts);
  const ref = new Date(now);
  let age = ref.getFullYear() - dob.getFullYear();
  const m = ref.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < dob.getDate())) age--;
  return age;
}

function splitList(raw: string): string[] {
  return (raw || "")
    .split(/[,|]/)
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

export function evaluateCompare(
  op: CompareOp,
  answer: AnswerValue,
  raw: string,
  now: number = Date.now()
): boolean {
  const str = answerString(answer);
  const needle = (raw ?? "").trim();
  const lcNeedle = needle.toLowerCase();
  const lcStr = str.trim().toLowerCase();

  switch (op) {
    case "empty":
      return isEmptyAnswer(answer);
    case "not_empty":
      return !isEmptyAnswer(answer);
    case "equals":
      if (Array.isArray(answer))
        return answer.some((v) => String(v).trim().toLowerCase() === lcNeedle);
      return lcStr === lcNeedle;
    case "not_equals":
      if (Array.isArray(answer))
        return !answer.some((v) => String(v).trim().toLowerCase() === lcNeedle);
      return lcStr !== lcNeedle;
    case "contains":
      if (Array.isArray(answer))
        return answer.some((v) => String(v).toLowerCase().includes(lcNeedle));
      return lcStr.includes(lcNeedle);
    case "not_contains":
      if (Array.isArray(answer))
        return !answer.some((v) => String(v).toLowerCase().includes(lcNeedle));
      return !lcStr.includes(lcNeedle);
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const an = answerNumbers(answer);
      const bn = Number(needle);
      if (an.length && needle !== "" && !Number.isNaN(bn)) {
        const a = an[0];
        if (op === "gt") return a > bn;
        if (op === "gte") return a >= bn;
        if (op === "lt") return a < bn;
        return a <= bn;
      }
      const ad = parseLooseDate(str);
      const bd = parseLooseDate(needle);
      if (ad !== null && bd !== null && needle !== "") {
        if (op === "gt") return ad > bd;
        if (op === "gte") return ad >= bd;
        if (op === "lt") return ad < bd;
        return ad <= bd;
      }
      const c = lcStr.localeCompare(lcNeedle, undefined, {
        numeric: true,
        sensitivity: "base",
      });
      if (op === "gt") return c > 0;
      if (op === "gte") return c >= 0;
      if (op === "lt") return c < 0;
      return c <= 0;
    }
    case "regex": {
      if (!needle) return false;
      try {
        return new RegExp(needle, "i").test(str);
      } catch {
        return false;
      }
    }
    case "before":
    case "after": {
      const ad = parseLooseDate(str);
      const bd = resolveDateOperand(needle, now);
      if (ad === null || bd === null) return false;
      return op === "before" ? ad < bd : ad > bd;
    }
    case "age_lt":
    case "age_lte":
    case "age_gt":
    case "age_gte": {
      const dob = parseLooseDate(str);
      const limit = Number(needle);
      if (dob === null || needle === "" || Number.isNaN(limit)) return false;
      const age = ageFromTs(dob, now);
      if (op === "age_lt") return age < limit;
      if (op === "age_lte") return age <= limit;
      if (op === "age_gt") return age > limit;
      return age >= limit;
    }
    case "one_of":
    case "not_one_of": {
      const list = splitList(needle);
      const hit = Array.isArray(answer)
        ? answer.some((v) => list.includes(String(v).trim().toLowerCase()))
        : list.includes(lcStr);
      return op === "one_of" ? hit : !hit;
    }
    case "is_true":
      if (typeof answer === "boolean") return answer;
      if (Array.isArray(answer)) return answer.length > 0;
      return ["true", "yes", "on", "1"].includes(lcStr);
    case "is_false":
      if (typeof answer === "boolean") return !answer;
      if (Array.isArray(answer)) return answer.length === 0;
      return isEmptyAnswer(answer) || ["false", "no", "off", "0"].includes(lcStr);
    default:
      return false;
  }
}

function resolveOperand(raw: string, answers: AnswerMap): string {
  const v = (raw || "").trim();
  if (v.toLowerCase().startsWith("field:")) {
    return answerString(answers[v.slice(6).trim()]);
  }
  return raw ?? "";
}

function conditionPasses(
  cond: { fieldId: string; op: CompareOp; value: string },
  answers: AnswerMap,
  now: number
): boolean {
  if (!cond.fieldId) return false;
  return evaluateCompare(cond.op, answers[cond.fieldId], resolveOperand(cond.value, answers), now);
}

export function conditionMatches(rule: ConditionRule, answers: AnswerMap): boolean {
  return conditionPasses(rule, answers, Date.now());
}

export function isFieldVisible(
  fieldId: string,
  answers: AnswerMap,
  conditions: ConditionRule[] | undefined
): boolean {
  const rules = (conditions || []).filter((r) => r.targetId === fieldId);
  if (rules.length === 0) return true;
  if (rules.some((r) => r.action === "hide" && conditionMatches(r, answers))) return false;
  const showRules = rules.filter((r) => r.action === "show");
  if (showRules.length === 0) return true;
  return showRules.some((r) => conditionMatches(r, answers));
}

export interface ValidationHit {
  rule: ValidationRule;
  message: string;
  fieldIds: string[];
}

/** First validation rule that matches → submission must be rejected with its message. */
export function evaluateValidation(
  rules: ValidationRule[] | undefined,
  answers: AnswerMap,
  now: number = Date.now()
): ValidationHit | null {
  for (const rule of rules || []) {
    if (!rule || rule.enabled === false) continue;
    const conds = (rule.conditions || []).filter((c) => c && c.fieldId);
    if (conds.length === 0) continue;
    const results = conds.map((c) => conditionPasses(c, answers, now));
    const matched =
      rule.match === "any" ? results.some(Boolean) : results.every(Boolean);
    if (matched) {
      return {
        rule,
        message:
          rule.message?.trim() ||
          "Sorry, you are not eligible to fill out this form.",
        fieldIds: conds.map((c) => c.fieldId),
      };
    }
  }
  return null;
}

/* ================= sections & branching ================= */

export interface SectionInfo {
  id: string;
  index: number;
  title: string;
  description: string;
  fields: FormField[];
}

export function buildSections(fields: FormField[]): SectionInfo[] {
  const sections: SectionInfo[] = [];
  let current: SectionInfo = { id: "__s0", index: 0, title: "", description: "", fields: [] };
  sections.push(current);
  for (const f of fields) {
    if (f.type === "section") {
      current = {
        id: "__s" + sections.length,
        index: sections.length,
        title: f.title,
        description: f.description || "",
        fields: [],
      };
      sections.push(current);
    } else {
      current.fields.push(f);
    }
  }
  return sections;
}

export const BRANCH_END = "__end__";

export function routeSections(sections: SectionInfo[], answers: AnswerMap): SectionInfo[] {
  const visited: SectionInfo[] = [];
  let idx = 0;
  let guard = 0;
  while (idx < sections.length && guard < 200) {
    guard++;
    const sec = sections[idx];
    visited.push(sec);
    let nextIdx = idx + 1;
    for (const f of sec.fields) {
      if (!f.branches || Object.keys(f.branches).length === 0) continue;
      const ans = answers[f.id];
      const labels = Array.isArray(ans) ? ans.map(String) : ans !== undefined && ans !== null ? [String(ans)] : [];
      for (const label of labels) {
        const target = f.branches[label];
        if (!target) continue;
        if (target === BRANCH_END) return visited;
        const found = sections.findIndex((s) => s.id === target);
        if (found >= 0) nextIdx = found;
      }
      break;
    }
    if (nextIdx <= idx && nextIdx !== idx + 1) break;
    idx = nextIdx;
  }
  return visited;
}

export interface Step {
  kind: "section" | "field";
  section?: SectionInfo;
  field?: FormField;
}

export function activeFlow(form: FormRecord, answers: AnswerMap): Step[] {
  const all = buildSections(form.fields);
  const routed = routeSections(all, answers);
  const steps: Step[] = [];
  for (const sec of routed) {
    if (sec.index > 0 && (sec.title || sec.description)) {
      steps.push({ kind: "section", section: sec });
    }
    for (const f of sec.fields) {
      if (isLayout(f.type) && f.type !== "statement") continue;
      if (!isFieldVisible(f.id, answers, form.settings?.conditions)) continue;
      steps.push({ kind: "field", field: f });
    }
  }
  return steps;
}

export function visibleFields(form: FormRecord, answers: AnswerMap): FormField[] {
  return activeFlow(form, answers)
    .filter((s) => s.kind === "field")
    .map((s) => s.field as FormField);
}

/* ================= piping / recall ================= */

export function resolveText(
  text: string | undefined,
  form: FormRecord,
  answers: AnswerMap
): string {
  if (!text) return text === undefined ? "" : text;
  return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, rawKey: string) => {
    const key = rawKey.trim();
    if (key.startsWith("hidden:")) {
      const v = answers["hidden:" + key.slice(7)];
      return v === undefined || v === null ? "" : String(v);
    }
    const field =
      form.fields.find((f) => f.id === key) ||
      form.fields.find((f) => f.title.toLowerCase() === key.toLowerCase());
    if (!field) return "";
    const v = answers[field.id];
    if (v === undefined || v === null) return "";
    if (Array.isArray(v)) return v.join(", ");
    if (typeof v === "object") return Object.values(v).join(" ");
    return String(v);
  });
}

/* ================= quiz scoring ================= */

function correctMatches(field: FormField, answer: AnswerValue): boolean {
  const cv = field.correct_value;
  if (cv === undefined || cv === null || cv === "") return false;
  if (field.type === "checkboxes") {
    const correct = Array.isArray(cv) ? cv : [cv];
    const given = Array.isArray(answer) ? answer.map(String) : [];
    return (
      correct.length === given.length &&
      correct.every((c) => given.includes(String(c)))
    );
  }
  if (field.type === "yes_no") {
    const want = Array.isArray(cv) ? cv[0] : cv;
    return String(answer) === String(want === "Yes" || want === "true" ? true : want);
  }
  if (field.type === "number") return Number(answer) === Number(cv);
  const want = Array.isArray(cv) ? cv[0] : cv;
  return String(answer ?? "").trim().toLowerCase() === String(want).trim().toLowerCase();
}

export interface FieldScore {
  fieldId: string;
  got: number;
  max: number;
}

export function scoreQuiz(form: FormRecord, answers: AnswerMap): {
  score: number;
  max: number;
  details: FieldScore[];
} {
  const details: FieldScore[] = [];
  let score = 0;
  let max = 0;
  for (const f of form.fields) {
    if (isLayout(f.type)) continue;
    if (f.correct_value === undefined || f.correct_value === null || f.correct_value === "") continue;
    const pts = f.points ?? 1;
    max += pts;
    const got = correctMatches(f, answers[f.id]) ? pts : 0;
    score += got;
    details.push({ fieldId: f.id, got, max: pts });
  }
  return { score, max, details };
}

/* ================= validation ================= */

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function answerText(answer: AnswerValue): string {
  if (answer === undefined || answer === null) return "";
  if (Array.isArray(answer)) return answer.join(", ");
  if (typeof answer === "object") return Object.values(answer).join(" ");
  return String(answer);
}

export function isValidPhone(value: string): boolean {
  const s = value.trim();
  if (!s) return false;
  const direct = parsePhoneNumberFromString(s);
  if (direct?.isValid()) return true;
  const body = s.replace(/^\+/, "").replace(/\D/g, "");
  if (!body) return false;
  for (const iso of getCountries()) {
    let code = "";
    try {
      code = String(getCountryCallingCode(iso as CountryCode));
    } catch {
      continue;
    }
    if (!code || !body.startsWith(code)) continue;
    const rest = body.slice(code.length);
    if (!rest) continue;
    try {
      const p = parsePhoneNumberFromString(rest, iso);
      if (p?.isValid()) return true;
    } catch {
      /* try next */
    }
  }
  return false;
}

export function validateField(field: FormField, answer: AnswerValue): string | null {
  if (isLayout(field.type)) return null;

  let empty = isEmptyAnswer(answer);
  if (Array.isArray(answer) && answer.some((v) => isEmptyAnswer(v))) {
    answer = answer.filter((v) => !isEmptyAnswer(v));
    empty = isEmptyAnswer(answer);
  }

  if (field.type === "legal") {
    if (field.required && answer !== true) return "You must accept the terms to continue";
    return null;
  }

  if (empty) {
    if (!field.required) return null;
    if (field.type === "matrix") return "Please answer every row";
    return "This question is required";
  }

  const text = answerText(answer);

  if (field.type === "email" && !isValidEmail(text)) return "Please enter a valid email address";
  if (field.type === "phone" && !isValidPhone(text)) return "Please enter a valid phone number";
  if (field.type === "url" && !isValidUrl(text)) return "Please enter a valid URL (https://…)";
  if (field.type === "number") {
    if (Number.isNaN(Number(text))) return "Please enter a number";
    if (field.min_value !== undefined && Number(text) < field.min_value)
      return `Must be at least ${field.min_value}`;
    if (field.max_value !== undefined && Number(text) > field.max_value)
      return `Must be at most ${field.max_value}`;
  }

  if ((field.type === "short_text" || field.type === "long_text") && !field.regex) {
    if (field.min_length && text.length < field.min_length)
      return `Must be at least ${field.min_length} characters`;
    if (field.max_length && text.length > field.max_length)
      return `Must be at most ${field.max_length} characters`;
  }

  if (field.regex) {
    let re: RegExp | null = null;
    try {
      re = new RegExp(field.regex);
    } catch {
      re = null;
    }
    if (re && !re.test(text)) return field.regex_error || "This answer doesn't match the required format";
  }

  if (Array.isArray(answer) && (field.type === "checkboxes" || field.type === "picture_choice")) {
    if (field.min_selections && answer.length < field.min_selections)
      return `Select at least ${field.min_selections} option${field.min_selections === 1 ? "" : "s"}`;
    if (field.max_selections && answer.length > field.max_selections)
      return `Select at most ${field.max_selections} option${field.max_selections === 1 ? "" : "s"}`;
  }

  if (field.type === "file_upload") {
    const files = Array.isArray(answer) ? answer : [answer];
    if (field.max_files && files.length > field.max_files)
      return `You can upload up to ${field.max_files} file${field.max_files === 1 ? "" : "s"}`;
  }

  if (field.type === "matrix") {
    const map = (typeof answer === "object" && !Array.isArray(answer) ? answer : {}) as Record<string, unknown>;
    if (field.rows) {
      for (const row of field.rows) {
        const v = map[row];
        const rowEmpty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
        if (rowEmpty && field.required) return "Please answer every row";
      }
    }
    if (field.limit_one_per_column && field.columns && !field.matrix_multi) {
      const seen = new Set<string>();
      for (const row of field.rows || []) {
        const v = String(map[row] ?? "");
        if (!v) continue;
        if (seen.has(v)) return "Each option can only be used once";
        seen.add(v);
      }
    }
  }

  return null;
}
