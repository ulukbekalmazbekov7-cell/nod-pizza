import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Employee, Profile } from "@/lib/types";
import { fetchProfileRows, profileDisplayName } from "@/lib/profileData";

function uniqueNames(names: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const name of names) {
    const trimmed = name?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLocaleLowerCase("ru");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }

  return result.sort((left, right) => left.localeCompare(right, "ru"));
}

export async function fetchEmployeesDirectory(client: SupabaseClient) {
  const { data, error } = await client
    .from("employees")
    .select("id, full_name, position, status, branch_id, branches(name)")
    .order("full_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as Employee[];
}

export async function fetchAppProfiles(client: SupabaseClient) {
  return fetchProfileRows(client);
}

export { fetchInspectorProfiles } from "@/lib/profileData";

export function buildInspectorOptions(
  profiles: Profile[],
  currentProfile: Profile | null,
  sessionUser?: User | null
) {
  const inspectors = profiles.filter((profile) => profile.role === "admin" || profile.role === "qc");
  const names = inspectors.map((profile) => profileDisplayName(profile, sessionUser ?? null));

  if (currentProfile && (currentProfile.role === "admin" || currentProfile.role === "qc")) {
    names.push(profileDisplayName(currentProfile, sessionUser ?? null));
  }

  return uniqueNames(names);
}

export function employeeNameSet(employees: Employee[]) {
  return new Set(
    employees
      .map((employee) => employee.full_name.trim().toLocaleLowerCase("ru"))
      .filter(Boolean)
  );
}
