"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  ChevronDown,
  ExternalLink,
  FileText,
  Link2Off,
  Phone,
  User,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getDashboardTimeframeLabel,
  type DashboardTimeframe,
} from "@/lib/dashboard/dashboard-timeframe";
import {
  DASHBOARD_DEPARTMENT_SHORT_LABELS,
  type DashboardProjectListItem,
} from "@/lib/dashboard/dashboard-types";
import { formatHeroProjectLink } from "@/lib/hero/hero-admin-config";

interface DashboardProjectListProps {
  departmentName: string;
  heroProjectLinkTemplate: string | null;
  projects: DashboardProjectListItem[];
  source: "hero" | "empty";
  timeframe: DashboardTimeframe;
  variant?: "card" | "embedded";
}

interface NormalizedProjectDocument {
  id: string;
  documentNumber: string | null;
  type: string | null;
  baseType: string | null;
  value: number | null;
  statusCode: string | null;
  statusText: string | null;
  createdAt: string | null;
  fileUrl: string | null;
  fileName: string | null;
}

interface ProjectRow extends DashboardProjectListItem {
  documents: NormalizedProjectDocument[];
  heroLink: string | null;
  rowKey: string;
}

export function DashboardProjectList({
  departmentName,
  heroProjectLinkTemplate,
  projects,
  source,
  timeframe,
  variant = "card",
}: DashboardProjectListProps) {
  const [expandedProjectKey, setExpandedProjectKey] = useState<string | null>(null);

  const projectRows = useMemo<ProjectRow[]>(
    () =>
      projects.map((project, index) => {
        const formattedHeroLink = formatHeroProjectLink(
          heroProjectLinkTemplate ?? "",
          {
            id: project.id,
            project_number: project.projectNumber,
          }
        );

        return {
          ...project,
          documents: getProjectDocuments(project),
          heroLink: isValidExternalUrl(formattedHeroLink) ? formattedHeroLink : null,
          rowKey: `${project.id}-${project.snapshotDate}-${index}`,
        };
      }),
    [heroProjectLinkTemplate, projects]
  );

  if (projectRows.length === 0) {
    const emptyState = (
      <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-8 text-center">
        <Link2Off className="h-5 w-5 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium">Keine Projekte im gewählten Zeitraum</p>
          <p className="text-sm text-muted-foreground">
            {getEmptyStateDescription(source)}
          </p>
        </div>
      </div>
    );

    if (variant === "embedded") {
      return emptyState;
    }

    return (
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl">Projekte im Überblick</CardTitle>
              <CardDescription>
                {departmentName} · {getDashboardTimeframeLabel(timeframe)}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {emptyState}
        </CardContent>
      </Card>
    );
  }

  const projectListContent = (
    <div className="space-y-3">
      {projectRows.map((project) => {
        const isExpanded = expandedProjectKey === project.rowKey;
        const contextSummary = getProjectContextSummary(project);
        const customerSummary = getProjectCustomerSummary(project);
        const contactSummary = getProjectContactSummary(project);
        const addressSummary = getProjectAddressSummary(project);
        const contactSecondary = getContactSecondary(project);
        const openInvoiceDocuments = getOpenInvoiceDocuments(project.documents);

        return (
          <Collapsible
            key={project.rowKey}
            open={isExpanded}
            onOpenChange={(open) =>
              setExpandedProjectKey(open ? project.rowKey : null)
            }
          >
            <div className="overflow-hidden rounded-lg border bg-background">
              <div className="flex flex-col gap-4 p-4 sm:p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="space-y-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-lg font-semibold leading-tight sm:text-xl">
                          {getDisplayTitle(project)}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          {project.projectNumber ? (
                            <Badge variant="outline" className="font-medium text-foreground">
                              {project.projectNumber}
                            </Badge>
                          ) : (
                            <span>Ohne Projektnummer</span>
                          )}
                          <span>{DASHBOARD_DEPARTMENT_SHORT_LABELS[project.department]}</span>
                          {project.maturityDate ? (
                            <>
                              <span aria-hidden="true">•</span>
                              <span>Fällig {formatDate(project.maturityDate)}</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <SummaryBlock
                        label="Kontext"
                        primary={contextSummary ?? "Kein Kontext verfügbar"}
                        secondary={
                          project.maturityDate
                            ? `Fällig ${formatDate(project.maturityDate)}`
                            : null
                        }
                        muted={!contextSummary}
                      />
                      <SummaryBlock
                        label="Kunde"
                        icon={User}
                        primary={customerSummary ?? "Keine Kundendaten"}
                        secondary={addressSummary}
                        muted={!customerSummary && !addressSummary}
                      />
                      <SummaryBlock
                        label="Kontakt"
                        icon={Phone}
                        primary={contactSummary ?? "Keine Kontaktdaten"}
                        secondary={contactSecondary}
                        muted={!contactSummary && !contactSecondary}
                      />
                      <SummaryBlock
                        label="Dokumente"
                        icon={FileText}
                        primary={formatDocumentSummary(project.documents)}
                        secondary={
                          openInvoiceDocuments.length > 0
                            ? formatOpenInvoiceSummary(openInvoiceDocuments)
                            : getLatestDocumentLabel(project.documents)
                        }
                        muted={project.documents.length === 0}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                    <Badge variant={getStatusBadgeVariant(project.status)}>
                      {project.stepName ?? formatStatusLabel(project.status)}
                    </Badge>
                    {project.heroLink ? (
                      <Button asChild size="sm" variant="outline">
                        <a
                          href={project.heroLink}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Hero öffnen
                        </a>
                      </Button>
                    ) : null}
                    <CollapsibleTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        aria-label={`Details zu ${getDisplayTitle(project)}`}
                      >
                        Details
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                </div>
              </div>

              <CollapsibleContent>
                <div className="border-t bg-muted/20 px-4 py-4 sm:px-5">
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-1">
                      <DetailSection title="Projektdetails">
                        <DetailList
                          items={[
                            {
                              label: "Projektname",
                              value: project.projectName ?? "–",
                            },
                            {
                              label: "Projektnummer",
                              value: project.projectNumber ?? "–",
                            },
                            {
                              label: "Status",
                              value: formatStatusLabel(project.status),
                            },
                            {
                              label: "Abteilung",
                              value: DASHBOARD_DEPARTMENT_SHORT_LABELS[project.department],
                            },
                            {
                              label: "Maßnahme",
                              value: getProjectMeasureShort(project) ?? "–",
                            },
                            {
                              label: "Projektart",
                              value: getProjectType(project) ?? "–",
                            },
                            {
                              label: "Erstellt",
                              value: formatDate(project.createdAt),
                            },
                            {
                              label: "Letzte Änderung",
                              value: formatDate(project.modifiedAt),
                            },
                            {
                              label: "Fälligkeit",
                              value: formatDate(project.maturityDate),
                            },
                          ]}
                        />
                      </DetailSection>

                      <DetailSection title="Kunde & Kontakt">
                        <DetailList
                          items={[
                            {
                              label: "Kunde",
                              value: getProjectCustomerSummary(project) ?? "–",
                            },
                            {
                              label: "Ansprechperson",
                              value: getProjectContactSummary(project) ?? "–",
                            },
                            {
                              label: "Telefon",
                              value: getProjectPhone(project) ?? "–",
                            },
                            {
                              label: "E-Mail",
                              value: getProjectEmail(project) ?? "–",
                            },
                            {
                              label: "Adresse",
                              value: getProjectAddressSummary(project) ?? "–",
                            },
                          ]}
                        />
                      </DetailSection>
                    </div>

                    <DetailSection
                      title={`Offene Rechnungen${openInvoiceDocuments.length > 0 ? ` (${openInvoiceDocuments.length})` : ""}`}
                    >
                      {openInvoiceDocuments.length > 0 ? (
                        <div className="space-y-3">
                          {openInvoiceDocuments.map((document) => (
                            <div
                              key={`open-${document.id}`}
                              className="rounded-md border bg-background p-3"
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-semibold">
                                      {getInvoiceLabel(document)}
                                    </p>
                                    <Badge variant="destructive">Offen</Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {formatDocumentType(document)}
                                  </p>
                                </div>
                                <div className="space-y-1 text-sm sm:text-right">
                                  <p className="font-semibold">{formatCurrency(document.value)}</p>
                                  <p className="text-muted-foreground">
                                    {formatDocumentStatus(document) ?? "Ohne Status"}
                                  </p>
                                  <p className="text-muted-foreground">
                                    Erstellt {formatDate(document.createdAt)}
                                  </p>
                                </div>
                              </div>

                              {document.fileUrl ? (
                                <Button asChild size="sm" variant="outline" className="mt-3">
                                  <a
                                    href={document.fileUrl}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                    Rechnung öffnen
                                  </a>
                                </Button>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-md border border-dashed bg-background/80 px-4 py-6 text-sm text-muted-foreground">
                          Für dieses Projekt wurden aktuell keine offenen Rechnungen erkannt.
                        </div>
                      )}
                    </DetailSection>

                    <DetailSection
                      title={`Dokumente${project.documents.length > 0 ? ` (${project.documents.length})` : ""}`}
                    >
                      {project.documents.length > 0 ? (
                        <>
                          <div className="hidden md:block">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Dokument</TableHead>
                                  <TableHead>Typ</TableHead>
                                  <TableHead>Wert</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Erstellt</TableHead>
                                  <TableHead className="text-right">Datei</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {project.documents.map((document) => (
                                  <TableRow key={document.id}>
                                    <TableCell className="font-medium">
                                      <div className="space-y-1">
                                        <p>{getInvoiceLabel(document)}</p>
                                        {isInvoiceLikeDocument(document) ? (
                                          <p className="text-xs text-muted-foreground">
                                            {isOpenInvoiceDocument(document)
                                              ? "Offene Rechnung"
                                              : "Rechnungsdokument"}
                                          </p>
                                        ) : null}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="space-y-1">
                                        <p>{document.type ?? "–"}</p>
                                        {document.baseType &&
                                        document.baseType !== document.type ? (
                                          <p className="text-xs text-muted-foreground">
                                            {document.baseType}
                                          </p>
                                        ) : null}
                                      </div>
                                    </TableCell>
                                    <TableCell>{formatCurrency(document.value)}</TableCell>
                                    <TableCell>
                                      <div className="space-y-1">
                                        <p>{formatDocumentStatus(document) ?? "–"}</p>
                                        {isInvoiceLikeDocument(document) ? (
                                          <p className="text-xs text-muted-foreground">
                                            {getInvoiceLabel(document)}
                                          </p>
                                        ) : null}
                                      </div>
                                    </TableCell>
                                    <TableCell>{formatDate(document.createdAt)}</TableCell>
                                    <TableCell className="text-right">
                                      {document.fileUrl ? (
                                        <Button asChild size="sm" variant="ghost">
                                          <a
                                            href={document.fileUrl}
                                            target="_blank"
                                            rel="noreferrer noopener"
                                          >
                                            <ExternalLink className="h-4 w-4" />
                                            Datei
                                          </a>
                                        </Button>
                                      ) : (
                                        <span className="text-xs text-muted-foreground">–</span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>

                          <div className="grid gap-3 md:hidden">
                            {project.documents.map((document) => (
                              <div key={document.id} className="rounded-md border bg-background p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-medium">
                                      {getInvoiceLabel(document)}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      {formatDocumentType(document)}
                                    </p>
                                  </div>
                                  <Badge variant="outline">
                                    {isOpenInvoiceDocument(document)
                                      ? "Offen"
                                      : formatDocumentStatus(document) ?? "Ohne Status"}
                                  </Badge>
                                </div>
                                <dl className="mt-3 space-y-2 text-sm">
                                  <div className="flex items-center justify-between gap-4">
                                    <dt className="text-muted-foreground">Wert</dt>
                                    <dd>{formatCurrency(document.value)}</dd>
                                  </div>
                                  <div className="flex items-center justify-between gap-4">
                                    <dt className="text-muted-foreground">Erstellt</dt>
                                    <dd>{formatDate(document.createdAt)}</dd>
                                  </div>
                                </dl>
                                {document.fileUrl ? (
                                  <Button asChild size="sm" variant="ghost" className="mt-3 px-0">
                                    <a
                                      href={document.fileUrl}
                                      target="_blank"
                                      rel="noreferrer noopener"
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                      Datei öffnen
                                    </a>
                                  </Button>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-background/80 px-6 py-8 text-center">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div className="space-y-1">
                            <p className="text-sm font-medium">
                              Keine verknüpften Dokumente vorhanden
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Sobald Hero Dokumente liefert, erscheinen sie hier mit Status,
                              Wert und Datei-Link.
                            </p>
                          </div>
                        </div>
                      )}
                    </DetailSection>
                  </div>
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}
    </div>
  );

  if (variant === "embedded") {
    return projectListContent;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">Projekte im Überblick</CardTitle>
            <CardDescription>
              {departmentName} · {getDashboardTimeframeLabel(timeframe)} · {formatCountLabel(
                projectRows.length,
                "Projekt",
                "Projekte"
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>{projectListContent}</CardContent>
    </Card>
  );
}

function SummaryBlock({
  label,
  primary,
  secondary,
  muted,
  icon: Icon,
}: {
  label: string;
  primary: string;
  secondary: string | null;
  muted?: boolean;
  icon?: typeof User;
}) {
  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        <span>{label}</span>
      </div>
      <p className={`mt-2 text-sm font-medium ${muted ? "text-muted-foreground" : "text-foreground"}`}>
        {primary}
      </p>
      {secondary ? (
        <p className="mt-1 text-xs text-muted-foreground">{secondary}</p>
      ) : null}
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function DetailList({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <dl className="space-y-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex flex-col gap-1 border-t pt-3 first:border-t-0 first:pt-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
        >
          <dt className="text-sm text-muted-foreground">{item.label}</dt>
          <dd className="text-sm font-medium text-foreground sm:max-w-[60%] sm:text-right">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function formatStatusLabel(status: string | null): string {
  if (!status) {
    return "Unbekannt";
  }

  return status.replaceAll("_", " ");
}

function formatDocumentType(document: NormalizedProjectDocument): string {
  if (document.type && document.baseType && document.type !== document.baseType) {
    return `${document.type} · ${document.baseType}`;
  }

  return document.type ?? document.baseType ?? "–";
}

function formatDocumentStatus(
  document: NormalizedProjectDocument
): string | null {
  return document.statusText ?? document.statusCode ?? null;
}

function formatDocumentSummary(documents: NormalizedProjectDocument[]): string {
  if (documents.length === 0) {
    return "Keine Dokumente";
  }

  const summaryParts = [formatCountLabel(documents.length, "Dokument", "Dokumente")];
  const invoiceCount = documents.filter(isInvoiceLikeDocument).length;
  const openInvoiceCount = documents.filter(isOpenInvoiceDocument).length;
  const fileCount = documents.filter((document) => !!document.fileUrl).length;

  if (invoiceCount > 0) {
    summaryParts.push(formatCountLabel(invoiceCount, "Rechnung", "Rechnungen"));
  }

  if (openInvoiceCount > 0) {
    summaryParts.push(formatCountLabel(openInvoiceCount, "offen", "offen"));
  }

  if (fileCount > 0) {
    summaryParts.push(formatCountLabel(fileCount, "Datei", "Dateien"));
  }

  return summaryParts.join(" · ");
}

function getLatestDocumentLabel(
  documents: NormalizedProjectDocument[]
): string | null {
  const datedDocuments = documents.filter((document) => document.createdAt);

  if (datedDocuments.length === 0) {
    return null;
  }

  const latestDocument = [...datedDocuments].sort((leftDocument, rightDocument) =>
    (rightDocument.createdAt ?? "").localeCompare(leftDocument.createdAt ?? "")
  )[0];

  if (!latestDocument?.createdAt) {
    return null;
  }

  return `Zuletzt ${formatDate(latestDocument.createdAt)}`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "–";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "–";
  }

  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatCurrency(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "–";
  }

  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function formatCountLabel(
  count: number,
  singularLabel: string,
  pluralLabel: string
): string {
  return `${count} ${count === 1 ? singularLabel : pluralLabel}`;
}

function getEmptyStateDescription(source: "hero" | "sample" | "empty"): string {
  if (source === "sample") {
    return "Im gewählten Zeitraum sind in den verfügbaren Beispieldaten keine Projekte vorhanden.";
  }

  return "Passe Zeitraum oder Abteilung an, um weitere Projekte zu sehen.";
}

function getStatusBadgeVariant(status: string | null):
  | "default"
  | "secondary"
  | "destructive"
  | "outline" {
  const normalizedStatus = (status ?? "").toLowerCase();

  if (
    normalizedStatus.includes("abgeschlossen") ||
    normalizedStatus.includes("completed")
  ) {
    return "secondary";
  }

  if (
    normalizedStatus.includes("nacharbeit") ||
    normalizedStatus.includes("rework")
  ) {
    return "destructive";
  }

  if (normalizedStatus.includes("buchhaltung")) {
    return "outline";
  }

  return "default";
}

/**
 * Pick the nicest title we can show for a project. Hero sometimes stores
 * junk like "-7305 | --, --, --" when a project was created without a real
 * name — we fall back through customer name, address, and project number.
 */
function getDisplayTitle(project: ProjectRow): string {
  const name = project.projectName?.trim();
  if (name && /[A-Za-zÄÖÜäöüß]{2,}/.test(name)) return name;
  const customer = project.customerName?.trim();
  if (customer) return customer;
  if (project.projectNumber) return project.projectNumber;
  return "Projekt ohne Titel";
}

function getProjectContextSummary(project: DashboardProjectListItem): string | null {
  const parts = [
    DASHBOARD_DEPARTMENT_SHORT_LABELS[project.department],
    getProjectMeasureShort(project),
    getProjectType(project),
  ].filter((value): value is string => !!value);

  return parts.length > 0 ? parts.join(" · ") : null;
}

function getProjectType(project: DashboardProjectListItem): string | null {
  const projectRecord = project as Record<string, unknown>;
  const raw = firstNonEmptyString(
    project.projectType,
    projectRecord.project_type
  );
  // Hero returns "unmanaged" as a filler for project_type on every project —
  // it's noise, not information the user wants in a context chip.
  if (!raw || raw.toLowerCase() === "unmanaged") return null;
  return raw;
}

function getProjectMeasureShort(project: DashboardProjectListItem): string | null {
  const projectRecord = project as Record<string, unknown>;
  const measureRecord = asRecord(projectRecord.measure);

  return firstNonEmptyString(
    project.measureShort,
    project.measureName,
    projectRecord.measure_short,
    projectRecord.measure_name,
    measureRecord?.short,
    measureRecord?.name
  );
}

function getProjectCustomerSummary(project: DashboardProjectListItem): string | null {
  const projectRecord = project as Record<string, unknown>;
  const customerRecord = asRecord(projectRecord.customer);

  return firstNonEmptyString(
    project.customerName,
    projectRecord.customer_name,
    customerRecord?.name,
    customerRecord?.company,
    customerRecord?.company_name
  );
}

function getProjectContactSummary(project: DashboardProjectListItem): string | null {
  const projectRecord = project as Record<string, unknown>;
  const contactRecord = asRecord(projectRecord.contact);
  const customerRecord = asRecord(projectRecord.customer);

  return firstNonEmptyString(
    project.customerContactName,
    projectRecord.contact_name,
    projectRecord.customer_contact_name,
    contactRecord?.name,
    contactRecord?.full_name,
    [contactRecord?.first_name, contactRecord?.last_name]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join(" "),
    customerRecord?.contact_name
  );
}

function getProjectPhone(project: DashboardProjectListItem): string | null {
  const projectRecord = project as Record<string, unknown>;
  const contactRecord = asRecord(projectRecord.contact);
  const customerRecord = asRecord(projectRecord.customer);

  return firstNonEmptyString(
    project.customerPhone,
    projectRecord.customer_phone,
    projectRecord.phone,
    contactRecord?.phone_home,
    contactRecord?.phone,
    customerRecord?.phone_home,
    customerRecord?.phone
  );
}

function getProjectEmail(project: DashboardProjectListItem): string | null {
  const projectRecord = project as Record<string, unknown>;
  const contactRecord = asRecord(projectRecord.contact);
  const customerRecord = asRecord(projectRecord.customer);

  return firstNonEmptyString(
    project.customerEmail,
    projectRecord.customer_email,
    projectRecord.email,
    contactRecord?.email,
    customerRecord?.email
  );
}

function getProjectAddressSummary(project: DashboardProjectListItem): string | null {
  const projectRecord = project as Record<string, unknown>;
  const addressRecord =
    asRecord(projectRecord.address) ??
    asRecord(asRecord(projectRecord.customer)?.address);

  const explicitAddress = firstNonEmptyString(
    project.customerAddress,
    projectRecord.customer_address,
    projectRecord.address_summary,
    addressRecord?.formatted,
    addressRecord?.full
  );

  if (explicitAddress) {
    return explicitAddress;
  }

  const street = firstNonEmptyString(
    projectRecord.street,
    projectRecord.address_street,
    addressRecord?.street,
    addressRecord?.line1
  );
  const postalCode = firstNonEmptyString(
    projectRecord.postal_code,
    projectRecord.zip,
    addressRecord?.postal_code,
    addressRecord?.zip
  );
  const city = firstNonEmptyString(projectRecord.city, addressRecord?.city);
  const locality = [postalCode, city].filter((value): value is string => !!value).join(" ");
  const parts = [street, locality].filter((value): value is string => !!value);

  return parts.length > 0 ? parts.join(", ") : null;
}

function getContactSecondary(project: DashboardProjectListItem): string | null {
  const phone = getProjectPhone(project);
  const email = getProjectEmail(project);
  const parts = [phone, email].filter((value): value is string => !!value);

  return parts.length > 0 ? parts.join(" · ") : null;
}

function getProjectDocuments(
  project: DashboardProjectListItem
): NormalizedProjectDocument[] {
  const projectRecord = project as Record<string, unknown>;
  const rawDocuments =
    toObjectArray(project.customerDocuments) ??
    toObjectArray(project.customer_documents) ??
    toObjectArray(projectRecord.customer_documents) ??
    toObjectArray(projectRecord.documents) ??
    [];

  return rawDocuments
    .map((document, index) => normalizeProjectDocument(document, index))
    .sort((leftDocument, rightDocument) => {
      const createdComparison = (rightDocument.createdAt ?? "").localeCompare(
        leftDocument.createdAt ?? ""
      );

      if (createdComparison !== 0) {
        return createdComparison;
      }

      return (leftDocument.documentNumber ?? "").localeCompare(
        rightDocument.documentNumber ?? ""
      );
    });
}

function normalizeProjectDocument(
  document: Record<string, unknown>,
  index: number
): NormalizedProjectDocument {
  return {
    id:
      firstNonEmptyString(document.id, document.documentNumber, document.document_number) ??
      `document-${index}`,
    documentNumber: firstNonEmptyString(
      document.documentNumber,
      document.document_number,
      document.number
    ),
    type: firstNonEmptyString(document.type),
    baseType: firstNonEmptyString(document.baseType, document.base_type),
    value: toNumber(document.value),
    statusCode: firstNonEmptyString(document.statusCode, document.status_code),
    statusText: firstNonEmptyString(
      document.statusText,
      document.status_text,
      document.status
    ),
    createdAt: firstNonEmptyString(
      document.createdAt,
      document.created_at,
      document.created
    ),
    fileUrl: normalizeExternalUrl(
      firstNonEmptyString(document.fileUrl, document.file_url, document.url)
    ),
    fileName: firstNonEmptyString(document.fileName, document.file_name, document.name),
  };
}

function isInvoiceLikeDocument(document: NormalizedProjectDocument): boolean {
  const descriptor = [document.type, document.baseType]
    .filter((value): value is string => !!value)
    .join(" ")
    .toLowerCase();

  return descriptor.includes("invoice") || descriptor.includes("rechnung");
}

function isOpenInvoiceDocument(document: NormalizedProjectDocument): boolean {
  if (!isInvoiceLikeDocument(document)) {
    return false;
  }

  const status = [document.statusText, document.statusCode]
    .filter((value): value is string => !!value)
    .join(" ")
    .toLowerCase();

  if (!status) {
    return true;
  }

  if (
    status.includes("bezahlt") ||
    status.includes("paid") ||
    status.includes("storniert") ||
    status.includes("cancel") ||
    status.includes("geschlossen") ||
    status.includes("closed")
  ) {
    return false;
  }

  return true;
}

function getOpenInvoiceDocuments(
  documents: NormalizedProjectDocument[]
): NormalizedProjectDocument[] {
  return documents.filter(isOpenInvoiceDocument);
}

function getInvoiceLabel(document: NormalizedProjectDocument): string {
  if (document.documentNumber) {
    return document.documentNumber;
  }

  if (isInvoiceLikeDocument(document)) {
    return "Rechnung ohne Nummer";
  }

  return "Dokument";
}

function formatOpenInvoiceSummary(
  documents: NormalizedProjectDocument[]
): string | null {
  if (documents.length === 0) {
    return null;
  }

  const labels = documents
    .slice(0, 2)
    .map(getInvoiceLabel)
    .filter((value): value is string => value.length > 0);

  if (documents.length > 2) {
    labels.push(`+${documents.length - 2} weitere`);
  }

  return labels.join(" · ");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function toObjectArray(value: unknown): Record<string, unknown>[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  return value.filter(
    (entry): entry is Record<string, unknown> =>
      typeof entry === "object" && entry !== null && !Array.isArray(entry)
  );
}

function firstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const trimmedValue = value.trim();

    if (trimmedValue.length > 0) {
      return trimmedValue;
    }
  }

  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalizedValue = Number(value);

    if (Number.isFinite(normalizedValue)) {
      return normalizedValue;
    }
  }

  return null;
}

function normalizeExternalUrl(url: string | null): string | null {
  return isValidExternalUrl(url) ? url : null;
}

function isValidExternalUrl(url: string | null): url is string {
  if (!url) {
    return false;
  }

  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}
