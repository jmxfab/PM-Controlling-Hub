export type EmailStatus = "pending" | "approved" | "rejected" | "pushed_to_notion";
export type EmailCategory = "info" | "aufgabe" | "dringend";

export interface ProcessedEmail {
  id: string;
  message_id: string;
  subject: string | null;
  sender_email: string | null;
  sender_name: string | null;
  received_at: string | null;
  body_preview: string | null;
  category: EmailCategory;
  extracted_title: string | null;
  extracted_summary: string | null;
  extracted_due_date: string | null;
  status: EmailStatus;
  notion_page_id: string | null;
  created_at: string;
}

export const CATEGORY_LABELS: Record<EmailCategory, string> = {
  info: "Info",
  aufgabe: "Todo",
  dringend: "Dringend",
};

export const CATEGORY_COLORS: Record<EmailCategory, string> = {
  info: "bg-blue-100 text-blue-800",
  aufgabe: "bg-yellow-100 text-yellow-800",
  dringend: "bg-red-100 text-red-800",
};
