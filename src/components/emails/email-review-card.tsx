"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  type ProcessedEmail,
} from "@/lib/emails/email-types";
import { CheckCircle, XCircle, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";

interface EmailReviewCardProps {
  email: ProcessedEmail;
  onPushed: (id: string, notionPageId: string) => void;
  onRejected: (id: string) => void;
}

export function EmailReviewCard({ email, onPushed, onRejected }: EmailReviewCardProps) {
  const [title, setTitle] = useState(email.extracted_title ?? email.subject ?? "");
  const [summary, setSummary] = useState(email.extracted_summary ?? "");
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState<"push" | "reject" | null>(null);

  const receivedDate = email.received_at
    ? new Date(email.received_at).toLocaleDateString("de-AT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  async function handlePushToNotion() {
    setLoading("push");
    try {
      const res = await fetch("/api/emails/push-to-notion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: email.id, title, summary }),
      });
      if (!res.ok) throw new Error("Fehler beim Push");
      const data = (await res.json()) as { notion_page_id: string };
      onPushed(email.id, data.notion_page_id);
    } catch {
      toast.error("Fehler beim Eintragen in Notion. Bitte nochmal versuchen.");
    } finally {
      setLoading(null);
    }
  }

  async function handleReject() {
    setLoading("reject");
    try {
      await fetch(`/api/emails/${email.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" }),
      });
      onRejected(email.id);
    } catch {
      toast.error("Fehler beim Ablehnen.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card className="border border-border">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CATEGORY_COLORS[email.category]}`}
              >
                {CATEGORY_LABELS[email.category]}
              </span>
              {receivedDate && (
                <span className="text-xs text-muted-foreground">{receivedDate}</span>
              )}
            </div>
            <p className="text-sm font-medium truncate">{email.subject ?? "(kein Betreff)"}</p>
            <p className="text-xs text-muted-foreground">
              {email.sender_name ? `${email.sender_name} ` : ""}
              {email.sender_email ? `<${email.sender_email}>` : ""}
            </p>
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            aria-label={expanded ? "Einklappen" : "Ausklappen"}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor={`title-${email.id}`} className="text-xs text-muted-foreground">
            Todo-Titel
          </Label>
          <Input
            id={`title-${email.id}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor={`summary-${email.id}`} className="text-xs text-muted-foreground">
            Zusammenfassung
          </Label>
          <Textarea
            id={`summary-${email.id}`}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            className="text-sm resize-none"
          />
        </div>

        {email.extracted_due_date && (
          <p className="text-xs text-muted-foreground">
            Fälligkeit: <span className="font-medium">{email.extracted_due_date}</span>
          </p>
        )}

        {expanded && email.body_preview && (
          <div className="rounded bg-muted/50 p-3 text-xs text-muted-foreground leading-relaxed">
            {email.body_preview}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            onClick={handlePushToNotion}
            disabled={loading !== null || !title.trim()}
            className="flex-1"
          >
            <ExternalLink size={14} className="mr-1.5" />
            {loading === "push" ? "Wird eingetragen…" : "Zu Notion"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleReject}
            disabled={loading !== null}
            className="text-destructive hover:text-destructive"
          >
            <XCircle size={14} className="mr-1.5" />
            {loading === "reject" ? "…" : "Ablehnen"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface EmailDoneCardProps {
  email: ProcessedEmail;
}

export function EmailDoneCard({ email }: EmailDoneCardProps) {
  return (
    <Card className="border border-border opacity-60">
      <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <CheckCircle size={16} className="text-green-600 shrink-0" />
          <span className="text-sm truncate">
            {email.extracted_title ?? email.subject ?? "(kein Betreff)"}
          </span>
        </div>
        <Badge variant="outline" className="shrink-0 text-xs">
          In Notion
        </Badge>
      </CardContent>
    </Card>
  );
}
