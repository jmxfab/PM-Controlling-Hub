"use client";

import { useState } from "react";
import { EmailDoneCard, EmailReviewCard } from "@/components/emails/email-review-card";
import type { ProcessedEmail } from "@/lib/emails/email-types";

interface EmailReviewListProps {
  initialEmails: ProcessedEmail[];
}

export function EmailReviewList({ initialEmails }: EmailReviewListProps) {
  const [emails, setEmails] = useState<ProcessedEmail[]>(initialEmails);

  const pending = emails.filter((e) => e.status === "pending");
  const done = emails.filter((e) => e.status === "pushed_to_notion");

  function handlePushed(id: string, notionPageId: string) {
    setEmails((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, status: "pushed_to_notion", notion_page_id: notionPageId } : e
      )
    );
  }

  function handleRejected(id: string) {
    setEmails((prev) => prev.filter((e) => e.id !== id));
  }

  if (emails.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg font-medium">Keine E-Mails zur Überprüfung</p>
        <p className="text-sm mt-1">Der Cron-Job prüft alle 15 Minuten auf neue E-Mails.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pending.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Ausstehend ({pending.length})
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pending.map((email) => (
              <EmailReviewCard
                key={email.id}
                email={email}
                onPushed={handlePushed}
                onRejected={handleRejected}
              />
            ))}
          </div>
        </section>
      )}

      {done.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Erledigt ({done.length})
          </h2>
          <div className="space-y-2">
            {done.map((email) => (
              <EmailDoneCard key={email.id} email={email} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
