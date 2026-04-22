import {
  getDepartmentFromHeroTypeId,
  HeroDepartment,
  HeroProject,
} from "@/lib/hero/hero-client";
import { KPIData } from "@/components/dashboard/dashboard-cards";

/** Status values in Hero that count as "active" */
const ACTIVE_STATUSES = [
  "in_progress",
  "active",
  "in_bearbeitung",
  "aktiv",
  "laufend",
  "erstkontakt",
  "auftragsvergabe",
  "neu",
];

/** Status values that count as "completed this week" */
const COMPLETED_STATUSES = [
  "completed",
  "abgeschlossen",
  "archiviert",
  "fertig",
  "done",
  "finished",
];

/** Status values that mean project was handed to accounting */
const ACCOUNTING_STATUSES = [
  "invoiced",
  "accounting",
  "fakturiert",
  "abgerechnet",
  "an_buchhaltung",
  "buchhaltung",
  "kundenrechnung",
  "schlussrechnung",
];

/** Status values indicating open rework */
const REWORK_STATUSES = [
  "rework",
  "reklamation",
  "nacharbeit",
  "nacharbeiten",
  "in_nacharbeit",
];

export const DASHBOARD_KPI_KEYS = [
  "activeProjects",
  "completedProjectsWeek",
  "accountingTransferredCount",
  "openReworks",
  "scheduledReworks",
  "openCustomerCommitments",
  "scheduledClosings",
] as const;

export type DashboardKpiKey = (typeof DASHBOARD_KPI_KEYS)[number];

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type DashboardKpiMatcher = (
  project: HeroProject,
  referenceTime: number
) => boolean;

type DashboardKpiProjectGroups = Record<DashboardKpiKey, HeroProject[]>;

const DASHBOARD_KPI_MATCHERS: Record<DashboardKpiKey, DashboardKpiMatcher> = {
  activeProjects: (project) => isActiveProject(project),
  completedProjectsWeek: (project, referenceTime) =>
    matchesStatus(project, COMPLETED_STATUSES) &&
    isCompletedSince(project, referenceTime),
  accountingTransferredCount: (project) => hasAccountingTransfer(project),
  openReworks: (project) => matchesStatus(project, REWORK_STATUSES),
  scheduledReworks: (project) =>
    matchesStatus(project, REWORK_STATUSES) && isReworkScheduled(project),
  openCustomerCommitments: (project) => isOpenCustomerCommitment(project),
  scheduledClosings: (project) => isClosingScheduled(project),
};

function isCompletedSince(project: HeroProject, referenceTime: number): boolean {
  if (!project.completion_date) return false;
  const completedAt = new Date(project.completion_date).getTime();
  const weekAgo = referenceTime - ONE_WEEK_MS;
  return completedAt >= weekAgo;
}

function matchesStatus(
  project: HeroProject,
  statusList: string[]
): boolean {
  const val = (project.status ?? "").toLowerCase();
  return statusList.some((s) => val.includes(s));
}

function isReworkScheduled(project: HeroProject): boolean {
  return !!project.rework_scheduled_date;
}

function isClosingScheduled(project: HeroProject): boolean {
  return !!project.closing_appointment_date;
}

function isOpenCustomerCommitment(project: HeroProject): boolean {
  const val = (project.customer_commitment_status ?? "").toLowerCase();
  return (
    val.includes("open") ||
    val.includes("offen") ||
    val.includes("pending") ||
    val.includes("auftragsbestätigung") ||
    val.includes("zusage")
  );
}

function hasAccountingTransfer(project: HeroProject): boolean {
  return matchesStatus(project, ACCOUNTING_STATUSES) || !!project.accounting_date;
}

type ProjectsByDept = Record<HeroDepartment | "GESAMT", HeroProject[]>;

/**
 * Group projects by department based on Hero type_id. Projects without a
 * mapped type_id (e.g. Leads) are silently dropped — the read layer is
 * expected to have already filtered them.
 */
export function groupProjectsByDepartment(projects: HeroProject[]): ProjectsByDept {
  const result: ProjectsByDept = {
    PV: [],
    PV_GEWERBE: [],
    WP: [],
    KLIMA: [],
    GEBAEUDETECHNIK: [],
    GESAMT: projects,
  };

  for (const project of projects) {
    const dept = project.department ?? getDepartmentFromHeroTypeId(project.type_id);
    if (dept) {
      result[dept].push(project);
    }
  }

  return result;
}

/** Compute KPI metrics from a list of Hero projects */
export function computeKPIsFromProjects(projects: HeroProject[]): KPIData {
  return computeKPIsFromProjectsAt(projects, Date.now());
}

export function matchesProjectDashboardKpi(
  project: HeroProject,
  kpiKey: DashboardKpiKey,
  referenceDate: Date | number = Date.now()
): boolean {
  return DASHBOARD_KPI_MATCHERS[kpiKey](project, toReferenceTime(referenceDate));
}

export function getDashboardKpiProjectGroupsFromProjects(
  projects: HeroProject[]
): DashboardKpiProjectGroups {
  return getDashboardKpiProjectGroupsFromProjectsAt(projects, Date.now());
}

export function getDashboardKpiProjectGroupsFromProjectsAt(
  projects: HeroProject[],
  referenceDate: Date | number
): DashboardKpiProjectGroups {
  const referenceTime = toReferenceTime(referenceDate);
  const groups = createEmptyDashboardKpiProjectGroups();

  for (const project of projects) {
    for (const kpiKey of DASHBOARD_KPI_KEYS) {
      if (DASHBOARD_KPI_MATCHERS[kpiKey](project, referenceTime)) {
        groups[kpiKey].push(project);
      }
    }
  }

  return groups;
}

export function computeKPIsFromProjectsAt(
  projects: HeroProject[],
  referenceDate: Date | number
): KPIData {
  const kpiProjectGroups = getDashboardKpiProjectGroupsFromProjectsAt(
    projects,
    referenceDate
  );
  const accountingAmount = kpiProjectGroups.accountingTransferredCount.reduce(
    (sum, p) => sum + (p.accounting_amount ?? 0),
    0
  );

  return {
    activeProjects: kpiProjectGroups.activeProjects.length,
    completedProjectsWeek: kpiProjectGroups.completedProjectsWeek.length,
    accountingTransferredCount: kpiProjectGroups.accountingTransferredCount.length,
    accountingTransferredAmount: accountingAmount,
    openReworks: kpiProjectGroups.openReworks.length,
    scheduledReworks: kpiProjectGroups.scheduledReworks.length,
    openCustomerCommitments: kpiProjectGroups.openCustomerCommitments.length,
    scheduledClosings: kpiProjectGroups.scheduledClosings.length,
  };
}

function createEmptyDashboardKpiProjectGroups(): DashboardKpiProjectGroups {
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

function toReferenceTime(referenceDate: Date | number): number {
  return typeof referenceDate === "number"
    ? referenceDate
    : referenceDate.getTime();
}

function isActiveProject(project: HeroProject): boolean {
  if (matchesStatus(project, ACTIVE_STATUSES)) {
    return true;
  }

  if (
    matchesStatus(project, COMPLETED_STATUSES) ||
    matchesStatus(project, ACCOUNTING_STATUSES) ||
    matchesStatus(project, REWORK_STATUSES)
  ) {
    return false;
  }

  return !!project.status;
}
