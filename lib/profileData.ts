import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Profile, UserRole } from "@/lib/types";

const PROFILE_EXTENDED_COLUMNS =
  "id, role, full_name, branch_id, branch_ids, created_at, updated_at" as const;
const PROFILE_BASE_COLUMNS = "id, role, branch_id" as const;

function isMissingColumnError(error: { code?: string; message?: string } | null) {
  return error?.code === "42703" || error?.code === "PGRST204";
}

function normalizeRole(value: unknown): UserRole {
  if (value === "admin" || value === "manager" || value === "qc" || value === "operator") return value;
  return "qc";
}

export function sessionUserDisplayName(sessionUser?: User | null) {
  if (!sessionUser) return null;

  const metadataName = sessionUser.user_metadata?.full_name;
  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim();
  }

  const email = sessionUser.email?.trim();
  if (!email) return null;

  const localPart = email.split("@")[0]?.trim();
  return localPart || email;
}

export function profileDisplayName(
  profile: Pick<Profile, "id" | "role" | "full_name">,
  sessionUser?: User | null
) {
  const fullName = profile.full_name?.trim();
  if (fullName) return fullName;

  if (sessionUser?.id === profile.id) {
    const metadataName = sessionUser.user_metadata?.full_name;
    if (typeof metadataName === "string" && metadataName.trim()) {
      return metadataName.trim();
    }

    const email = sessionUser.email?.trim();
    if (email) {
      const localPart = email.split("@")[0]?.trim();
      if (localPart) return localPart;
      return email;
    }
  }

  if (profile.role === "admin") return `Администратор (${profile.id.slice(0, 8)})`;
  if (profile.role === "qc") return `Аудитор (${profile.id.slice(0, 8)})`;
  return `Пользователь (${profile.id.slice(0, 8)})`;
}

export function mapProfileRow(row: Record<string, unknown>): Profile {
  return {
    id: String(row.id),
    role: normalizeRole(row.role),
    full_name: (row.full_name as string | null | undefined)?.trim() || null,
    branch_id: row.branch_id != null ? Number(row.branch_id) : null,
    branch_ids: Array.isArray(row.branch_ids)
      ? row.branch_ids.map((id) => Number(id))
      : [],
    created_at: row.created_at as string | undefined,
    updated_at: row.updated_at as string | undefined,
  };
}

export async function fetchProfileRows(
  client: SupabaseClient,
  options?: { inspectorOnly?: boolean }
) {
  const buildQuery = (columns: string) => {
    let query = client.from("profiles").select(columns);
    if (options?.inspectorOnly) {
      query = query.in("role", ["admin", "qc"]);
    }
    return query.order("role", { ascending: true });
  };

  const extended = await buildQuery(PROFILE_EXTENDED_COLUMNS);
  if (!isMissingColumnError(extended.error)) {
    if (extended.error) throw extended.error;
    return (extended.data ?? []).map((row) =>
      mapProfileRow(row as unknown as Record<string, unknown>)
    );
  }

  const base = await buildQuery(PROFILE_BASE_COLUMNS);
  if (base.error) throw base.error;
  return (base.data ?? []).map((row) =>
    mapProfileRow(row as unknown as Record<string, unknown>)
  );
}

export async function fetchInspectorProfiles(client: SupabaseClient) {
  return fetchProfileRows(client, { inspectorOnly: true });
}
