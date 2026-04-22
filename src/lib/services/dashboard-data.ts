import "server-only";

import { cache } from "react";

import { KPIData } from "@/components/dashboard/dashboard-cards";
import { HistoricDataPoint } from "@/components/dashboard/dashboard-charts";
import { type DashboardTimeframe } from "@/lib/dashboard/dashboard-timeframe";
import {
  type DashboardProjectDocument,
  type DashboardProjectListItem,
  type Department,
} from "@/lib/dashboard/dashboard-types";
import {
  DASHBOARD_KPI_KEYS,
  computeKPIsFromProjectsAt,
  getDashboardKpiProjectGroupsFromProjectsAt,
  type DashboardKpiKey,
  groupProjectsByDepartment,
} from "@/lib/hero/hero-aggregator";
import {
  fetchAllHeroProjects,
  getDepartmentFromProjectNumber,
  type HeroCustomerDocument,
  type HeroProject,
} from "@/lib/hero/hero-client";
import { getActiveHeroApiKey } from "@/lib/settings/hero-settings";
import { getHistoricKPIs } from "@/lib/supabase/dashboard-queries";
import { filterHeroProjectsByTimeframe } from "./dashboard-live-filter";

const EMPTY_KPIS: KPIData = {
  activeProjects: 0,
  completedProjectsWeek: 0,
  accountingTransferredCount: 0,
  accountingTransferredAmount: 0,
  openReworks: 0,
  scheduledReworks: 0,
  openCustomerCommitments: 0,
  scheduledClosings: 0,
};

export interface DashboardTabData {
  kpiData: KPIData;
  historicData: HistoricDataPoint[];
  projectList: DashboardProjectListItem[];
  kpiProjectGroups: Record<DashboardKpiKey, DashboardProjectListItem[]>;
  source: "hero" | "empty";
  notice?: string;
  projectListNotice?: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getDashboardTabData(
  department: Department,
  timeframe: DashboardTimeframe
): Promise<DashboardTabData> {
  const heroApiKey = await getActiveHeroApiKey();

  if (!heroApiKey) {
    throw new Error(
      "Hero API-Key ist nicht konfiguriert. Bitte im Admin-Bereich eintragen oder als Umgebungsvariable HERO_API_KEY setzen."
    );
  }

  return await getLiveData(department, timeframe);
}

async function getLiveData(
  department: Department,
  timeframe: DashboardTimeframe
): Promise<DashboardTabData> {
  const allProjects = await getCachedHeroProjects();
  const filteredProjects = filterHeroProjectsByTimeframe(allProjects, timeframe);
  const departmentProjects = groupProjectsByDepartment(filteredProjects)[department];

  let historicData: HistoricDataPoint[] = [];
  try {
    historicData = await getHistoricKPIs(department, timeframe);
  } catch {
    // Supabase nicht konfiguriert oder Tabellen fehlen — leere History ist ok
  }

  if (departmentProjects.length === 0) {
    return {
      kpiData: EMPTY_KPIS,
      historicData: [],
      projectList: [],
      kpiProjectGroups: createEmptyDashboardKpiProjectGroups(),
      source: "empty",
      projectListNotice:
        timeframe.mode === "current"
          ? "Aktuell wurden in Hero keine Projekte für diese Abteilung gefunden."
          : "Im gewählten Zeitraum wurden in Hero keine passenden Projekte gefunden.",
    };
  }

  const projectList = buildLiveProjectList(departmentProjects);
  const referenceDate = getReferenceDateForTimeframe(timeframe, projectList);
  const kpiProjectGroups = getDashboardKpiProjectGroupsFromProjectsAt(
    departmentProjects,
    referenceDate
  );

  return {
    kpiData: computeKPIsFromProjectsAt(departmentProjects, referenceDate),
    historicData,
    projectList,
    kpiProjectGroups: buildKpiProjectGroups(projectList, kpiProjectGroups),
    source: "hero",
  };
}

const getCachedHeroProjects = cache(fetchAllHeroProjects);

function buildLiveProjectList(projects: HeroProject[]): DashboardProjectListItem[] {
  return projects
    .map((project) => {
      const customerDocuments = mapHeroCustomerDocuments(
        project.customerDocuments ?? project.customer_documents ?? []
      );

      return {
        id: project.id,
        projectNumber: project.project_number,
        projectName: project.name,
        status: project.status,
        department: getDepartmentFromProjectNumber(project.project_number),
        snapshotDate: getProjectSnapshotDate(project),
        projectType: project.project_type,
        measureShort: project.measure_short,
        measureName: project.measure_name,
        createdAt: project.created_at ?? null,
        modifiedAt: project.modified_at ?? null,
        maturityDate:
          project.maturity_date ??
          project.closing_appointment_date ??
          project.rework_scheduled_date ??
          null,
        customerName: project.customer_name ?? project.customerName ?? null,
        customerContactName:
          project.customer_contact_name ?? project.customerContactName ?? null,
        customerPhone: project.customer_phone ?? project.customerPhone ?? null,
        customerEmail: project.customer_email ?? project.customerEmail ?? null,
        customerAddress: project.customer_address ?? project.customerAddress ?? null,
        customer: project.customer ? { ...project.customer } : null,
        contact: project.contact ? { ...project.contact } : null,
        address: project.address ? { ...project.address } : null,
        customerDocuments,
        customer_documents: customerDocuments,
      } satisfies DashboardProjectListItem;
    })
    .sort(compareDashboardProjects);
}

function buildKpiProjectGroups(
  projectList: DashboardProjectListItem[],
  kpiProjectGroups: Record<DashboardKpiKey, HeroProject[]>
): Record<DashboardKpiKey, DashboardProjectListItem[]> {
  return DASHBOARD_KPI_KEYS.reduce<Record<DashboardKpiKey, DashboardProjectListItem[]>>(
    (result, kpiKey) => {
      const projectIds = new Set(kpiProjectGroups[kpiKey].map((project) => project.id));
      result[kpiKey] = projectList.filter((project) => projectIds.has(project.id));
      return result;
    },
    createEmptyDashboardKpiProjectGroups()
  );
}

function createEmptyDashboardKpiProjectGroups(): Record<
  DashboardKpiKey,
  DashboardProjectListItem[]
> {
  return {
    activeProjects: [],
    completedProjectsWeek: [],
    accountingTransferredCount: [],
    openReworks: [],
    scheduledReworks: [],
    openCustomerCommitments: [],
    scheduledClosings: [],
  };
}

function mapHeroCustomerDocuments(
  documents: HeroCustomerDocument[]
): DashboardProjectDocument[] {
  return documents.map((document) => ({
    id: document.id ? String(document.id) : undefined,
    documentNumber: document.nr ?? null,
    document_number: document.nr ?? null,
    type: document.type ?? document.document_type?.name ?? null,
    baseType: document.document_type?.base_type ?? null,
    base_type: document.document_type?.base_type ?? null,
    value: document.value ?? null,
    statusCode:
      document.status_code === null || document.status_code === undefined
        ? null
        : String(document.status_code),
    status_code:
      document.status_code === null || document.status_code === undefined
        ? null
        : String(document.status_code),
    statusText: document.status_name ?? null,
    status_text: document.status_name ?? null,
    createdAt: document.created ?? null,
    created_at: document.created ?? null,
    created: document.created ?? null,
    fileUrl: document.file_upload?.url ?? null,
    file_url: document.file_upload?.url ?? null,
    fileName: getDocumentFileName(document.file_upload?.url),
    file_name: getDocumentFileName(document.file_upload?.url),
  }));
}

function getDocumentFileName(fileUrl: string | null | undefined): string | null {
  if (!fileUrl) {
    return null;
  }

  try {
    const url = new URL(fileUrl);
    const fileName = url.pathname.split("/").pop();
    return fileName && fileName.length > 0 ? fileName : null;
  } catch {
    return null;
  }
}

function getProjectSnapshotDate(project: HeroProject): string {
  return (
    toIsoDate(project.modified_at) ??
    toIsoDate(project.maturity_date) ??
    toIsoDate(project.created_at) ??
    toIsoDate(project.closing_appointment_date) ??
    toIsoDate(project.rework_scheduled_date) ??
    new Date().toISOString().slice(0, 10)
  );
}

function toIsoDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value.slice(0, 10);
}

function getReferenceDateForTimeframe(
  timeframe: DashboardTimeframe,
  projectList: DashboardProjectListItem[]
): Date {
  if (timeframe.to) {
    return new Date(`${timeframe.to}T12:00:00.000Z`);
  }

  return new Date(`${projectList[0]?.snapshotDate ?? new Date().toISOString().slice(0, 10)}T12:00:00.000Z`);
}

function compareDashboardProjects(
  leftProject: DashboardProjectListItem,
  rightProject: DashboardProjectListItem
): number {
  if (leftProject.snapshotDate !== rightProject.snapshotDate) {
    return rightProject.snapshotDate.localeCompare(leftProject.snapshotDate);
  }

  return (leftProject.projectNumber ?? "").localeCompare(
    rightProject.projectNumber ?? ""
  );
}

