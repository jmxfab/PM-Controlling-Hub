import {
  fetchAllHeroProjects,
  getDepartmentFromProjectNumber,
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
];

/** Status values that count as "completed this week" */
const COMPLETED_STATUSES = [
  "completed",
  "abgeschlossen",
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
];

/** Status values indicating open rework */
const REWORK_STATUSES = [
  "rework",
  "nacharbeit",
  "nacharbeiten",
  "in_nacharbeit",
];

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function isCompletedThisWeek(project: HeroProject): boolean {
  if (!project.completion_date) return false;
  const completedAt = new Date(project.completion_date).getTime();
  const weekAgo = Date.now() - ONE_WEEK_MS;
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
  return val.includes("open") || val.includes("offen") || val.includes("pending");
}

type ProjectsByDept = Record<HeroDepartment | "GESAMT", HeroProject[]>;

/** Group projects by department based on project number prefix */
export function groupProjectsByDepartment(projects: HeroProject[]): ProjectsByDept {
  const result: ProjectsByDept = {
    PV: [],
    WP: [],
    HAUSTECHNIK: [],
    GESAMT: projects, // GESAMT = all departments combined
  };

  for (const project of projects) {
    const dept = getDepartmentFromProjectNumber(project.project_number);
    result[dept].push(project);
  }

  return result;
}

/** Compute KPI metrics from a list of Hero projects */
export function computeKPIsFromProjects(projects: HeroProject[]): KPIData {
  const active = projects.filter((p) =>
    matchesStatus(p, ACTIVE_STATUSES)
  );
  const completedWeek = projects.filter(
    (p) => matchesStatus(p, COMPLETED_STATUSES) && isCompletedThisWeek(p)
  );
  const accountingProjects = projects.filter((p) =>
    matchesStatus(p, ACCOUNTING_STATUSES)
  );
  const accountingAmount = accountingProjects.reduce(
    (sum, p) => sum + (p.accounting_amount ?? 0),
    0
  );
  const openReworks = projects.filter((p) =>
    matchesStatus(p, REWORK_STATUSES)
  );
  const scheduledReworks = openReworks.filter(isReworkScheduled);
  const openCommitments = projects.filter(isOpenCustomerCommitment);
  const scheduledClosings = projects.filter(isClosingScheduled);

  return {
    activeProjects: active.length,
    completedProjectsWeek: completedWeek.length,
    accountingTransferredCount: accountingProjects.length,
    accountingTransferredAmount: accountingAmount,
    openReworks: openReworks.length,
    scheduledReworks: scheduledReworks.length,
    openCustomerCommitments: openCommitments.length,
    scheduledClosings: scheduledClosings.length,
  };
}
