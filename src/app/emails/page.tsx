import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase";
import { EmailReviewList } from "@/components/emails/email-review-list";
import type { ProcessedEmail } from "@/lib/emails/email-types";

export const metadata: Metadata = {
  title: "E-Mail Posteingang | JMX",
  description: "Klassifizierte E-Mails prüfen und als Todos in Notion eintragen",
};

export const dynamic = "force-dynamic";

export default async function EmailsPage() {
  let emails: ProcessedEmail[] = [];
  let loadError: string | null = null;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("emails_processed")
      .select("*")
      .in("status", ["pending", "pushed_to_notion"])
      .order("received_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    emails = (data as ProcessedEmail[]) ?? [];
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Unbekannter Fehler";
  }

  const pendingCount = emails.filter((e) => e.status === "pending").length;

  return (
    <div className="flex-1 space-y-4 p-8 pt-6 max-w-[1200px] mx-auto min-h-screen">
      {pendingCount > 0 ? (
        <p className="text-sm text-muted-foreground">
          {pendingCount} E-Mail{pendingCount !== 1 ? "s" : ""} warten auf Freigabe.
        </p>
      ) : null}

      {loadError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Fehler beim Laden: {loadError}
        </div>
      ) : (
        <EmailReviewList initialEmails={emails} />
      )}
    </div>
  );
}
