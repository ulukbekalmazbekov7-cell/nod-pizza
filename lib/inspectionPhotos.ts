import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "inspection-photos";

export async function uploadInspectionPhoto(
  client: SupabaseClient,
  inspectionId: number,
  file: File,
  userId: string,
  criterionId?: string | null
) {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const storagePath = `${userId}/${inspectionId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await client.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

  if (uploadError) throw uploadError;

  const { data, error } = await client
    .from("inspection_photos")
    .insert([
      {
        inspection_id: inspectionId,
        storage_path: storagePath,
        uploaded_by: userId,
        criterion_id: criterionId ?? null,
      },
    ])
    .select("id, inspection_id, storage_path, uploaded_by, criterion_id, created_at")
    .single();

  if (error) throw error;
  return data;
}

export async function getInspectionPhotoUrl(client: SupabaseClient, storagePath: string) {
  const { data, error } = await client.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60 * 60);

  if (error) throw error;
  return data.signedUrl;
}

export async function deleteInspectionPhoto(
  client: SupabaseClient,
  photoId: string,
  storagePath: string
) {
  const { error: storageError } = await client.storage.from(BUCKET).remove([storagePath]);
  if (storageError) throw storageError;

  const { error } = await client.from("inspection_photos").delete().eq("id", photoId);
  if (error) throw error;
}
