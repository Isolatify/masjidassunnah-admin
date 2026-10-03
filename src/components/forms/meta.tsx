import {
  TextAa,
  AlignLeft,
  EnvelopeSimple,
  Hash,
  Phone,
  ToggleLeft,
  Radio,
  Checks,
  ListBullets,
  Star,
  CalendarBlank,
  Clock,
  Quotes,
  ImageSquare,
  ChartLineUp,
  TrendUp,
  SortAscending,
  Table,
  User,
  MapPin,
  UploadSimple,
  PencilSimple,
  Scroll,
  SquaresFour,
  Image,
  VideoCamera,
  Minus,
  LinkSimple,
} from "@phosphor-icons/react";
import type { FieldType } from "@/lib/forms";

export type FieldGroup = "basic" | "choice" | "scale" | "advanced" | "layout";

export interface FieldMeta {
  value: FieldType;
  rail: string;
  label: string;
  group: FieldGroup;
  icon: React.ReactNode;
}

export const FIELD_META: FieldMeta[] = [
  { value: "short_text", rail: "Short Text", label: "Short answer", group: "basic", icon: <TextAa size={17} weight="duotone" /> },
  { value: "long_text", rail: "Long Text", label: "Long answer", group: "basic", icon: <AlignLeft size={17} weight="duotone" /> },
  { value: "email", rail: "Email", label: "Email", group: "basic", icon: <EnvelopeSimple size={17} weight="duotone" /> },
  { value: "number", rail: "Number", label: "Number", group: "basic", icon: <Hash size={17} weight="duotone" /> },
  { value: "phone", rail: "Phone", label: "Phone number", group: "basic", icon: <Phone size={17} weight="duotone" /> },
  { value: "url", rail: "Website", label: "Website URL", group: "basic", icon: <LinkSimple size={17} weight="duotone" /> },
  { value: "date", rail: "Date Picker", label: "Date", group: "basic", icon: <CalendarBlank size={17} weight="duotone" /> },
  { value: "time", rail: "Time", label: "Time", group: "basic", icon: <Clock size={17} weight="duotone" /> },
  { value: "full_name", rail: "Full Name", label: "Name (first + last)", group: "basic", icon: <User size={17} weight="duotone" /> },
  { value: "address", rail: "Address", label: "Address", group: "basic", icon: <MapPin size={17} weight="duotone" /> },

  { value: "multiple_choice", rail: "Choice Picker", label: "Choice Picker", group: "choice", icon: <Radio size={17} weight="duotone" /> },
  { value: "checkboxes", rail: "Multiple Choice", label: "Multiple Choice", group: "choice", icon: <Checks size={17} weight="duotone" /> },
  { value: "dropdown", rail: "Dropdown", label: "Dropdown", group: "choice", icon: <ListBullets size={17} weight="duotone" /> },
  { value: "picture_choice", rail: "Picture Choice", label: "Picture choice", group: "choice", icon: <ImageSquare size={17} weight="duotone" /> },
  { value: "yes_no", rail: "Yes / No", label: "Yes / No", group: "choice", icon: <ToggleLeft size={17} weight="duotone" /> },
  { value: "legal", rail: "Terms Checkbox", label: "Terms & conditions", group: "choice", icon: <Scroll size={17} weight="duotone" /> },

  { value: "rating", rail: "Rating Stars", label: "Rating scale", group: "scale", icon: <Star size={17} weight="duotone" /> },
  { value: "opinion_scale", rail: "Opinion Scale", label: "Opinion scale", group: "scale", icon: <ChartLineUp size={17} weight="duotone" /> },
  { value: "nps", rail: "NPS (0–10)", label: "Net Promoter Score", group: "scale", icon: <TrendUp size={17} weight="duotone" /> },
  { value: "ranking", rail: "Ranking", label: "Ranking", group: "scale", icon: <SortAscending size={17} weight="duotone" /> },
  { value: "matrix", rail: "Matrix / Grid", label: "Matrix", group: "scale", icon: <Table size={17} weight="duotone" /> },

  { value: "file_upload", rail: "File Upload", label: "File upload", group: "advanced", icon: <UploadSimple size={17} weight="duotone" /> },
  { value: "signature", rail: "Signature", label: "Signature", group: "advanced", icon: <PencilSimple size={17} weight="duotone" /> },

  { value: "section", rail: "Section Break", label: "Section", group: "layout", icon: <SquaresFour size={17} weight="duotone" /> },
  { value: "statement", rail: "Text Block", label: "Statement", group: "layout", icon: <Quotes size={17} weight="duotone" /> },
  { value: "image", rail: "Image", label: "Image", group: "layout", icon: <Image size={17} weight="duotone" alt="" /> },
  { value: "video", rail: "Video", label: "Video", group: "layout", icon: <VideoCamera size={17} weight="duotone" /> },
  { value: "divider", rail: "Divider", label: "Divider line", group: "layout", icon: <Minus size={17} weight="duotone" /> },
];

export const FIELD_GROUPS: { value: FieldGroup; label: string }[] = [
  { value: "basic", label: "Basic elements" },
  { value: "choice", label: "Choice elements" },
  { value: "scale", label: "Scales & grids" },
  { value: "advanced", label: "Advanced" },
  { value: "layout", label: "Layout & media" },
];

export function metaFor(type: FieldType): FieldMeta {
  return FIELD_META.find((m) => m.value === type) || FIELD_META[0];
}
