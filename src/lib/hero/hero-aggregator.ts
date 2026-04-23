import {
  getDepartmentFromHeroTypeId,
  HeroDepartment,
  HeroProject,
} from "@/lib/hero/hero-client";
import { KPIData } from "@/components/dashboard/dashboard-cards";
import {
  ACCOUNTING_STEP_PATTERNS,
  BEWERTUNGSPOOL_STEP_PATTERNS,
  CLOSING_STEP_PATTERNS,
  COMMITMENT_STEP_PATTERNS,
  FINISHED_STEP_PATTERNS,
  REWORK_STEP_PATTERNS,
} from "@/lib/hero/step-classifier";

/**
 * KPI matching rules — aligned to Hero's UI pipeline.
 *
 * We match against `step_name` (the fine-grained Hero step, e.g.
 * "🔧 Zählermontage", "💸 Abschlussrechnung") rather than the rolled-up
 * status name. The high-level status for most in-flight projects is just
 * "In Umsetzung", so the old approach undercounted almost everything.
 *
 * Alle Pattern-Listen kommen aus step-classifier.ts — damit Aggregator,
 * Pipeline-View und Cash-RPC dieselbe Definition von "Abschluss-Step",
 * "Nacharbeit", etc. nutzen. Die früheren lokalen ACCOUNTING_PATTERNS
 * haben noch `fakturiert`/`abgerechnet`/`buchhaltung` matchen wollen,
 * die per MCP-Check aber in Production an keinem Step/Status auftauchen
 * und dafür `teil-rg`/`teilrechnung` (20 Projekte in PV+WP) übersehen.
 */
const FINISHED_PATTERNS = FINISHED_STEP_PATTERNS;
const REWORK_PATTERNS = REWORK_STEP_PATTERNS;
const ACCOUNTING_PATTERNS = ACCOUNTING_STEP_PATTERNS;
const CLOSING_PATTERNS = CLOSING_STEP_PATTERNS;
const COMMITMENT_PATTERNS = COMMITMENT_STEP_PATTERNS;
const BEWERTUNGSPOOL_PATTERNS = BEWERTUNGSPOOL_STEP_PATTERNS;

export const DASHBOARD_KPI_KEYS = [
  "activeProjects",
  "completedProjectsWeek",
  "accountingTransferredCount",
  "openReworks",
  "scheduledReworks",
  "openCustomerCommitments",
  "scheduledClosings",
  "bewertungspoolCount",
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
    isFinished(project) && isCompletedSince(project, referenceTime),
  accountingTransferredCount: (project) => hasAccountingTransfer(project),
  openReworks: (project) =>
    !isFinished(project) &&
    (matchesStep(project, REWORK_PATTERNS) ||
      matchesHighLevelStatus(project, REWORK_PATTERNS)),
  scheduledReworks: (project) =>
    !isFinished(project) &&
    (matchesStep(project, REWORK_PATTERNS) ||
      matchesHighLevelStatus(project, REWORK_PATTERNS)) &&
    !!project.rework_scheduled_date,
  openCustomerCommitments: (project) =>
    !isFinished(project) && matchesStep(project, COMMITMENT_PATTERNS),
  scheduledClosings: (project) =>
    !isFinished(project) &&
    matchesStep(project, CLOSING_PATTERNS) &&
    !!project.maturity_date,
  bewertungspoolCount: (project) =>
    !isFinished(project) && matchesStep(project, BEWERTUNGSPOOL_PATTERNS),
};

function currentStepText(project: HeroProject): string {
  return (project.step_name ?? project.status ?? "").toLowerCase();
}

function matchesStep(project: HeroProject, patterns: string[]): boolean {
  const value = currentStepText(project);
  if (!value) return false;
  return patterns.some((pattern) => value.includes(pattern));
}

function matchesHighLevelStatus(
  project: HeroProject,
  patterns: string[]
): boolean {
  const value = (project.status ?? "").toLowerCase();
  if (!value) return false;
  return patterns.some((pattern) => value.includes(pattern));
}

function isFinished(project: HeroProject): boolean {
  return matchesStep(project, FINISHED_PATTERNS);
}

function isActiveProject(project: HeroProject): boolean {
  return !isFinished(project) && !!currentStepText(project);
}

function isCompletedSince(project: HeroProject, referenceTime: number): boolean {
  if (!project.completion_date) return false;
  const completedAt = new Date(project.completion_date).getTime();
  const weekAgo = referenceTime - ONE_WEEK_MS;
  return completedAt >= weekAgo;
}

function hasAccountingTransfer(project: HeroProject): boolean {
  if (isFinished(project)) return false;
  return (
    matchesStep(project, ACCOUNTING_PATTERNS) ||
    matchesHighLevelStatus(project, ACCOUNTING_PATTERNS) ||
    !!project.accounting_date
  );
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
    bewertungspoolCount: kpiProjectGroups.bewertungspoolCount.length,
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
    bewertungspoolCount: [],
  };
}

function toReferenceTime(referenceDate: Date | number): number {
  return typeof referenceDate === "number"
    ? referenceDate
    : referenceDate.getTime();
}

