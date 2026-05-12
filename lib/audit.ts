import type { SupabaseClient } from "@supabase/supabase-js";

export async function writeAuditLog(
  client: SupabaseClient,
  action: string,
  entityType: string,
  entityId?: string | number | null,
  details?: Record<string, unknown>
) {
  const {
    data: { user },
  } = await client.auth.getUser();

  const { error } = await client.from("audit_logs").insert([
    {
      actor_id: user?.id ?? null,
      action,
      entity_type: entityType,
      entity_id: entityId != null ? String(entityId) : null,
      details: details ?? {},
    },
  ]);

  if (error) {
    console.warn("[audit]", error.message);
  }
}
