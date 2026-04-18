import {
  DEFAULT_DASHBOARD_TIMEFRAME,
  getDashboardTimeframeRange,
  type DashboardTimeframe,
} from "@/lib/dashboard/dashboard-timeframe";
import type {
  DashboardProjectDocument,
  DashboardProjectListItem,
} from "@/lib/dashboard/dashboard-types";
import { HistoricDataPoint } from "@/components/dashboard/dashboard-charts";
import { KPIData } from "@/components/dashboard/dashboard-cards";
import {
  DASHBOARD_KPI_KEYS,
  computeKPIsFromProjectsAt,
  getDashboardKpiProjectGroupsFromProjectsAt,
  groupProjectsByDepartment,
  type DashboardKpiKey,
} from "@/lib/hero/hero-aggregator";
import {
  getDepartmentFromProjectNumber,
  HeroDepartment,
  HeroProject,
} from "@/lib/hero/hero-client";
import {
  aggregateSnapshotsByWeek,
  HistoricSnapshotRow,
} from "@/lib/supabase/dashboard-historic";

export type SampleDepartment = "GESAMT" | HeroDepartment;

interface DepartmentSeed {
  active: number;
  completed: number;
  accounting: number;
  accountingAmount: number;
  openReworks: number;
  scheduledReworks: number;
  openCommitments: number;
  scheduledClosings: number;
}

interface HeroSampleSnapshot {
  snapshotDate: string;
  projects: HeroProject[];
}

interface HeroSampleDashboardData {
  kpiData: KPIData;
  historicData: HistoricDataPoint[];
  projectList: DashboardProjectListItem[];
  kpiProjectGroups: Record<DashboardKpiKey, DashboardProjectListItem[]>;
  hasDataInRange: boolean;
}

const EMPTY_SAMPLE_KPIS: KPIData = {
  activeProjects: 0,
  completedProjectsWeek: 0,
  accountingTransferredCount: 0,
  accountingTransferredAmount: 0,
  openReworks: 0,
  scheduledReworks: 0,
  openCustomerCommitments: 0,
  scheduledClosings: 0,
};

const SNAPSHOT_SERIES: Array<Record<HeroDepartment, DepartmentSeed>> = [
  {
    PV: { active: 18, completed: 2, accounting: 2, accountingAmount: 28000, openReworks: 4, scheduledReworks: 1, openCommitments: 4, scheduledClosings: 1 },
    WP: { active: 9, completed: 1, accounting: 1, accountingAmount: 12000, openReworks: 2, scheduledReworks: 1, openCommitments: 2, scheduledClosings: 1 },
    HAUSTECHNIK: { active: 7, completed: 1, accounting: 1, accountingAmount: 8500, openReworks: 2, scheduledReworks: 0, openCommitments: 2, scheduledClosings: 0 },
  },
  {
    PV: { active: 19, completed: 3, accounting: 2, accountingAmount: 32000, openReworks: 4, scheduledReworks: 2, openCommitments: 5, scheduledClosings: 2 },
    WP: { active: 10, completed: 1, accounting: 1, accountingAmount: 14000, openReworks: 2, scheduledReworks: 1, openCommitments: 3, scheduledClosings: 1 },
    HAUSTECHNIK: { active: 7, completed: 1, accounting: 1, accountingAmount: 9100, openReworks: 2, scheduledReworks: 1, openCommitments: 2, scheduledClosings: 1 },
  },
  {
    PV: { active: 20, completed: 3, accounting: 2, accountingAmount: 36000, openReworks: 5, scheduledReworks: 2, openCommitments: 5, scheduledClosings: 2 },
    WP: { active: 11, completed: 2, accounting: 1, accountingAmount: 16500, openReworks: 3, scheduledReworks: 1, openCommitments: 3, scheduledClosings: 1 },
    HAUSTECHNIK: { active: 8, completed: 1, accounting: 1, accountingAmount: 9600, openReworks: 2, scheduledReworks: 1, openCommitments: 2, scheduledClosings: 1 },
  },
  {
    PV: { active: 21, completed: 3, accounting: 3, accountingAmount: 42000, openReworks: 5, scheduledReworks: 2, openCommitments: 6, scheduledClosings: 2 },
    WP: { active: 12, completed: 2, accounting: 2, accountingAmount: 21000, openReworks: 3, scheduledReworks: 1, openCommitments: 4, scheduledClosings: 1 },
    HAUSTECHNIK: { active: 8, completed: 1, accounting: 1, accountingAmount: 10800, openReworks: 3, scheduledReworks: 1, openCommitments: 2, scheduledClosings: 1 },
  },
  {
    PV: { active: 22, completed: 4, accounting: 3, accountingAmount: 47000, openReworks: 5, scheduledReworks: 3, openCommitments: 6, scheduledClosings: 3 },
    WP: { active: 13, completed: 2, accounting: 2, accountingAmount: 23500, openReworks: 3, scheduledReworks: 1, openCommitments: 4, scheduledClosings: 2 },
    HAUSTECHNIK: { active: 9, completed: 1, accounting: 1, accountingAmount: 11900, openReworks: 3, scheduledReworks: 1, openCommitments: 3, scheduledClosings: 1 },
  },
  {
    PV: { active: 23, completed: 4, accounting: 3, accountingAmount: 51000, openReworks: 6, scheduledReworks: 3, openCommitments: 7, scheduledClosings: 3 },
    WP: { active: 14, completed: 3, accounting: 2, accountingAmount: 26000, openReworks: 3, scheduledReworks: 2, openCommitments: 4, scheduledClosings: 2 },
    HAUSTECHNIK: { active: 10, completed: 2, accounting: 1, accountingAmount: 13400, openReworks: 3, scheduledReworks: 1, openCommitments: 3, scheduledClosings: 1 },
  },
  {
    PV: { active: 24, completed: 5, accounting: 4, accountingAmount: 59000, openReworks: 6, scheduledReworks: 3, openCommitments: 7, scheduledClosings: 3 },
    WP: { active: 15, completed: 3, accounting: 2, accountingAmount: 29500, openReworks: 4, scheduledReworks: 2, openCommitments: 5, scheduledClosings: 2 },
    HAUSTECHNIK: { active: 11, completed: 2, accounting: 2, accountingAmount: 16100, openReworks: 4, scheduledReworks: 2, openCommitments: 3, scheduledClosings: 1 },
  },
  {
    PV: { active: 25, completed: 5, accounting: 4, accountingAmount: 64000, openReworks: 7, scheduledReworks: 4, openCommitments: 8, scheduledClosings: 4 },
    WP: { active: 16, completed: 4, accounting: 3, accountingAmount: 33800, openReworks: 4, scheduledReworks: 2, openCommitments: 5, scheduledClosings: 3 },
    HAUSTECHNIK: { active: 12, completed: 2, accounting: 2, accountingAmount: 18400, openReworks: 4, scheduledReworks: 2, openCommitments: 4, scheduledClosings: 2 },
  },
];

export function buildHeroSampleDashboardData(
  department: SampleDepartment,
  timeframeOrReferenceDate: DashboardTimeframe | Date = DEFAULT_DASHBOARD_TIMEFRAME,
  maybeReferenceDate: Date = new Date()
): HeroSampleDashboardData {
  const timeframe =
    timeframeOrReferenceDate instanceof Date
      ? DEFAULT_DASHBOARD_TIMEFRAME
      : timeframeOrReferenceDate;
  const referenceDate =
    timeframeOrReferenceDate instanceof Date
      ? timeframeOrReferenceDate
      : maybeReferenceDate;
  const timeline = buildHeroSampleTimeline(referenceDate);
  const timeframeRange = getDashboardTimeframeRange(timeframe, referenceDate);
  const snapshotsInRange = timeframeRange
    ? timeline.filter(
        (snapshot) =>
          snapshot.snapshotDate >= timeframeRange.from &&
          snapshot.snapshotDate <= timeframeRange.to
      )
    : timeline;
  const latestSnapshot = snapshotsInRange[snapshotsInRange.length - 1];

  if (!latestSnapshot) {
    return {
      kpiData: EMPTY_SAMPLE_KPIS,
      historicData: [],
      projectList: [],
      kpiProjectGroups: createEmptyDashboardKpiProjectGroups(),
      hasDataInRange: false,
    };
  }

  const latestGrouped = groupProjectsByDepartment(latestSnapshot.projects);
  const latestDepartmentProjects = latestGrouped[department];
  const latestProjectList = buildProjectListForProjects(
    latestDepartmentProjects,
    latestSnapshot.snapshotDate
  );
  const latestKpiProjectGroups = getDashboardKpiProjectGroupsFromProjectsAt(
    latestDepartmentProjects,
    new Date(latestSnapshot.snapshotDate)
  );

  const historicRows = snapshotsInRange.map((snapshot) => {
    const grouped = groupProjectsByDepartment(snapshot.projects);
    const kpis = computeKPIsFromProjectsAt(
      grouped[department],
      new Date(snapshot.snapshotDate)
    );

    return {
      snapshot_date: snapshot.snapshotDate,
      active_projects: kpis.activeProjects,
      completed_projects_week: kpis.completedProjectsWeek,
      accounting_transferred_count: kpis.accountingTransferredCount,
      } satisfies HistoricSnapshotRow;
  });

  const projectSnapshots =
    timeframe.mode === "current" ? [latestSnapshot] : snapshotsInRange;

  return {
    kpiData: computeKPIsFromProjectsAt(
      latestDepartmentProjects,
      new Date(latestSnapshot.snapshotDate)
    ),
    historicData: aggregateSnapshotsByWeek(historicRows).slice(-8),
    projectList:
      timeframe.mode === "current"
        ? latestProjectList
        : buildProjectList(projectSnapshots, department),
    kpiProjectGroups: buildKpiProjectGroups(
      latestProjectList,
      latestKpiProjectGroups
    ),
    hasDataInRange: true,
  };
}

export function buildHeroSampleTimeline(
  referenceDate: Date = new Date()
): HeroSampleSnapshot[] {
  return SNAPSHOT_SERIES.map((seed, index) => {
    const snapshotDate = toIsoDate(daysAgo(referenceDate, (SNAPSHOT_SERIES.length - 1 - index) * 7));
    return {
      snapshotDate,
      projects: [
        ...createDepartmentProjects("PV", seed.PV, snapshotDate, index),
        ...createDepartmentProjects("WP", seed.WP, snapshotDate, index),
        ...createDepartmentProjects("HAUSTECHNIK", seed.HAUSTECHNIK, snapshotDate, index),
      ],
    };
  });
}

function createDepartmentProjects(
  department: HeroDepartment,
  seed: DepartmentSeed,
  snapshotDate: string,
  snapshotIndex: number
): HeroProject[] {
  const prefix = getDepartmentPrefix(department);
  const projects: HeroProject[] = [];
  const accountingAmounts = splitAmount(seed.accountingAmount, seed.accounting);

  for (let i = 0; i < seed.active; i += 1) {
    projects.push({
      id: `${prefix}-active-${snapshotIndex}-${i}`,
      project_number: `${prefix}${(snapshotIndex + 1).toString().padStart(2, "0")}-${(i + 1)
        .toString()
        .padStart(3, "0")}`,
      name: `${department} Musterprojekt ${i + 1}`,
      status: i % 2 === 0 ? "aktiv" : "in_bearbeitung",
      customer_commitment_status: i < seed.openCommitments ? "offen" : null,
      closing_appointment_date:
        i < seed.scheduledClosings ? addDays(snapshotDate, i + 1) : null,
    });
  }

  for (let i = 0; i < seed.completed; i += 1) {
    projects.push({
      id: `${prefix}-completed-${snapshotIndex}-${i}`,
      project_number: `${prefix}${(snapshotIndex + 1).toString().padStart(2, "0")}-C${(i + 1)
        .toString()
        .padStart(2, "0")}`,
      name: `${department} Abschluss ${i + 1}`,
      status: "abgeschlossen",
      completion_date: addDays(snapshotDate, -(i + 1)),
    });
  }

  for (let i = 0; i < seed.accounting; i += 1) {
    projects.push({
      id: `${prefix}-accounting-${snapshotIndex}-${i}`,
      project_number: `${prefix}${(snapshotIndex + 1).toString().padStart(2, "0")}-A${(i + 1)
        .toString()
        .padStart(2, "0")}`,
      name: `${department} Buchhaltung ${i + 1}`,
      status: "an_buchhaltung",
      accounting_date: addDays(snapshotDate, -(i + 1)),
      accounting_amount: accountingAmounts[i] ?? 0,
    });
  }

  for (let i = 0; i < seed.openReworks; i += 1) {
    projects.push({
      id: `${prefix}-rework-${snapshotIndex}-${i}`,
      project_number: `${prefix}${(snapshotIndex + 1).toString().padStart(2, "0")}-N${(i + 1)
        .toString()
        .padStart(2, "0")}`,
      name: `${department} Nacharbeit ${i + 1}`,
      status: "nacharbeit",
      rework_status: i < seed.scheduledReworks ? "terminiert" : "offen",
      rework_scheduled_date:
        i < seed.scheduledReworks ? addDays(snapshotDate, i + 2) : null,
    });
  }

  return projects;
}

function buildProjectList(
  snapshots: HeroSampleSnapshot[],
  department: SampleDepartment
): DashboardProjectListItem[] {
  return snapshots
    .flatMap((snapshot) => {
      const grouped = groupProjectsByDepartment(snapshot.projects);

      return buildProjectListForProjects(grouped[department], snapshot.snapshotDate);
    })
    .sort(compareDashboardProjects);
}

function buildProjectListForProjects(
  projects: HeroProject[],
  snapshotDate: string
): DashboardProjectListItem[] {
  return projects
    .map((project, index) => ({
      id: project.id,
      projectNumber: project.project_number,
      projectName: project.name,
      status: project.status,
      department: getDepartmentFromProjectNumber(project.project_number),
      snapshotDate,
      ...buildSampleProjectDetails(project, snapshotDate, index),
    }))
    .sort(compareDashboardProjects);
}

function buildKpiProjectGroups(
  latestProjectList: DashboardProjectListItem[],
  kpiProjectGroups: Record<DashboardKpiKey, HeroProject[]>
): Record<DashboardKpiKey, DashboardProjectListItem[]> {
  return DASHBOARD_KPI_KEYS.reduce<Record<DashboardKpiKey, DashboardProjectListItem[]>>(
    (result, kpiKey) => {
      const projectIds = new Set(kpiProjectGroups[kpiKey].map((project) => project.id));

      result[kpiKey] = latestProjectList.filter((project) => projectIds.has(project.id));
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

function buildSampleProjectDetails(
  project: HeroProject,
  snapshotDate: string,
  index: number
): Pick<
  DashboardProjectListItem,
  | "projectType"
  | "measureShort"
  | "createdAt"
  | "modifiedAt"
  | "maturityDate"
  | "customerName"
  | "customerContactName"
  | "customerPhone"
  | "customerEmail"
  | "customerAddress"
  | "customerDocuments"
  | "customer_documents"
> {
  const customerDocuments = buildSampleCustomerDocuments(project, snapshotDate, index);

  return {
    projectType: getSampleProjectType(project),
    measureShort: getSampleMeasureShort(project.project_number),
    createdAt: addDays(snapshotDate, -(index % 14) - 3),
    modifiedAt: addDays(snapshotDate, -(index % 5)),
    maturityDate:
      project.closing_appointment_date ?? project.rework_scheduled_date ?? null,
    customerName: `Kunde ${project.project_number ?? index + 1}`,
    customerContactName: `Ansprechperson ${index + 1}`,
    customerPhone: `+49 40 555 ${String((index + 1) % 10000).padStart(4, "0")}`,
    customerEmail: `projekt-${index + 1}@example.invalid`,
    customerAddress: `${(index % 28) + 1}. Musterstraße, ${20095 + (index % 40)} Hamburg`,
    customerDocuments,
    customer_documents: customerDocuments,
  };
}

function buildSampleCustomerDocuments(
  project: HeroProject,
  snapshotDate: string,
  index: number
): DashboardProjectDocument[] {
  const documentPrefix = project.project_number ?? `DOK-${index + 1}`;
  const createdAt = addDays(snapshotDate, -(index % 6));
  const documents: DashboardProjectDocument[] = [
    {
      id: `${project.id}-summary`,
      documentNumber: `${documentPrefix}-D1`,
      type: project.status === "abgeschlossen" ? "Abnahmeprotokoll" : "Projektakte",
      baseType: "document",
      value: project.accounting_amount ?? null,
      statusText: project.status === "abgeschlossen" ? "freigegeben" : "abgelegt",
      createdAt,
      fileUrl: null,
    },
  ];

  if (project.accounting_amount) {
    documents.push({
      id: `${project.id}-accounting`,
      documentNumber: `${documentPrefix}-D2`,
      type: "Buchhaltungsdokument",
      baseType: "accounting",
      value: project.accounting_amount,
      statusText: "übergeben",
      createdAt: addDays(createdAt, 1),
      fileUrl: null,
    });
  }

  return documents;
}

function getSampleMeasureShort(projectNumber: string | null): string {
  const department = getDepartmentFromProjectNumber(projectNumber);

  switch (department) {
    case "PV":
      return "Dachanlage";
    case "WP":
      return "Heizungsmodernisierung";
    default:
      return "Serviceauftrag";
  }
}

function getSampleProjectType(project: HeroProject): string {
  if (project.status === "abgeschlossen") {
    return "Abschluss";
  }

  if (project.status === "an_buchhaltung") {
    return "Buchhaltung";
  }

  if (project.status === "nacharbeit") {
    return "Nacharbeit";
  }

  return "Laufendes Projekt";
}

function splitAmount(total: number, count: number): number[] {
  if (count === 0) return [];
  const base = Math.floor(total / count);
  return Array.from({ length: count }, (_, index) =>
    index === count - 1 ? total - base * (count - 1) : base
  );
}

function getDepartmentPrefix(department: HeroDepartment): string {
  switch (department) {
    case "PV":
      return "PV";
    case "WP":
      return "WÄP";
    default:
      return "HT";
  }
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

function daysAgo(referenceDate: Date, days: number): Date {
  const date = new Date(referenceDate);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
