import { ExternalLink } from "lucide-react";

/**
 * Einheitlicher „Projekt-Nr. → Hero"-Button. Wird überall im Dashboard
 * eingesetzt wo eine Projektnummer angezeigt wird, damit der User immer
 * mit einem Klick im Hero-Projekt landet.
 *
 * Darstellung:
 *  - Klein, wie ein Inline-Pill/Button (border + padding + mono font).
 *  - Hover wechselt auf Blau (bg-blue-500 + weißer Text + Icon).
 *  - Ohne Link-Template oder ohne ID wird nur der reine Text gerendert
 *    (kein Button), damit die Tabellen nicht "leer" wirken.
 */
export function HeroProjectLink({
  projectId,
  projectNumber,
  linkTemplate,
  size = "sm",
  className = "",
}: {
  projectId: string | null | undefined;
  projectNumber: string | null | undefined;
  linkTemplate: string | null | undefined;
  /** sm = table-size, md = card-headline-size */
  size?: "sm" | "md";
  className?: string;
}) {
  const label = projectNumber ?? "–";
  const href =
    linkTemplate && projectId
      ? linkTemplate.replace("{projectId}", projectId)
      : null;

  const sizeClasses =
    size === "md"
      ? "px-2.5 py-1 text-xs"
      : "px-2 py-0.5 text-[11px]";

  if (!href) {
    return (
      <span
        className={`inline-flex items-center rounded-md border border-input ${sizeClasses} font-mono text-foreground ${className}`}
      >
        {label}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      title="Im Hero öffnen"
      onClick={(event) => event.stopPropagation()}
      className={`inline-flex items-center gap-1 rounded-md border border-input bg-transparent ${sizeClasses} font-mono font-semibold text-foreground transition-colors hover:bg-blue-500 hover:border-blue-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${className}`}
    >
      {label}
      <ExternalLink className={size === "md" ? "h-3 w-3" : "h-2.5 w-2.5"} />
    </a>
  );
}
