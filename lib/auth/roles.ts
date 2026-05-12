import type { Branch, Profile, UserRole } from "@/lib/types";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Администратор",
  manager: "Менеджер филиала",
  qc: "Контроль качества",
  operator: "Оператор",
};

export function canAccessAudit(profile: Profile | null): boolean {
  return profile?.role === "admin";
}

export function canManageBranches(profile: Profile | null): boolean {
  return profile?.role === "admin";
}

export function canManageEmployees(profile: Profile | null): boolean {
  return profile?.role === "admin";
}

export function canEditShiftSchedule(profile: Profile | null): boolean {
  return profile?.role === "admin" || profile?.role === "manager" || profile?.role === "qc";
}

export function canCreateInspection(profile: Profile | null): boolean {
  return Boolean(profile);
}

export function canManageInspectionCatalog(profile: Profile | null): boolean {
  return profile?.role === "admin" || profile?.role === "qc";
}

export function canCreateApplication(profile: Profile | null): boolean {
  if (!profile) return false;
  return (
    profile.role === "admin" ||
    profile.role === "operator" ||
    profile.role === "manager"
  );
}

export function canAccessInspections(profile: Profile | null): boolean {
  return Boolean(profile && profile.role !== "operator");
}

export function canAccessTasksDashboard(profile: Profile | null): boolean {
  return profile?.role === "admin" || profile?.role === "qc";
}

export function canViewAllApplications(profile: Profile | null): boolean {
  return profile?.role === "admin";
}

export function canPerformQcInspection(profile: Profile | null): boolean {
  return profile?.role === "admin" || profile?.role === "qc" || profile?.role === "manager";
}

export function canReviewComplaintApplication(profile: Profile | null): boolean {
  return canPerformQcInspection(profile);
}

export function canCreateManualComplaintInspection(profile: Profile | null): boolean {
  return profile?.role === "admin" || profile?.role === "qc";
}

export function canAccessBranch(profile: Profile | null, branchId: number | null | undefined): boolean {
  if (!profile || branchId == null) return false;
  if (profile.role === "admin") return true;
  if (profile.role === "operator") return true;
  if (profile.role === "manager") return profile.branch_id === branchId;
  if (profile.role === "qc") return profile.branch_ids.includes(branchId);
  return false;
}

export function accessibleBranchIds(profile: Profile | null): number[] | "all" {
  if (!profile) return [];
  if (profile.role === "admin" || profile.role === "operator") return "all";
  if (profile.role === "manager" && profile.branch_id != null) return [profile.branch_id];
  return profile.branch_ids;
}

export function selectableBranchesForApplication(
  profile: Profile | null,
  branches: Branch[]
): Branch[] {
  if (!profile) return [];
  if (profile.role === "admin" || profile.role === "operator") return branches;
  return selectableBranchesForInspection(profile, branches);
}

export function filterAccessibleBranches(profile: Profile | null, branches: Branch[]): Branch[] {
  const access = accessibleBranchIds(profile);
  if (access === "all") return branches;
  const set = new Set(access);
  return branches.filter((branch) => branch.id != null && set.has(branch.id));
}

export function selectableBranchesForInspection(
  profile: Profile | null,
  branches: Branch[]
): Branch[] {
  const accessible = filterAccessibleBranches(profile, branches);
  if (accessible.length > 0) return accessible;
  return branches;
}
