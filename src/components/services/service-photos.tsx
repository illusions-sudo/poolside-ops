import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, CloudOff, Loader2, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/format";
import {
  buildPhotoPath,
  listQueuedPhotos,
  queuePhoto,
  removeQueuedPhoto,
  subscribePhotoQueue,
  type PhotoServiceRef,
  type QueuedPhoto,
} from "@/lib/offline-photos";
import { isNetworkError } from "@/lib/offline-queue";

type PendingPhoto = QueuedPhoto & { url: string };

export function ServicePhotos({ service, canEdit }: { service: PhotoServiceRef; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState<PendingPhoto[]>([]);

  // Photos saved on this phone while offline, shown with a "Waiting to sync" tag.
  useEffect(() => {
    let urls: string[] = [];
    let cancelled = false;
    const load = async () => {
      try {
        const list = await listQueuedPhotos(service.id);
        if (cancelled) return;
        urls.forEach((u) => URL.revokeObjectURL(u));
        urls = list.map((p) => URL.createObjectURL(p.blob));
        setPending(list.map((p, i) => ({ ...p, url: urls[i]! })));
      } catch {
        // IndexedDB unavailable (e.g. private browsing); offline photos just won't show.
      }
    };
    void load();
    const unsubscribe = subscribePhotoQueue(() => void load());
    return () => {
      cancelled = true;
      unsubscribe();
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [service.id]);

  const photos = useQuery({
    queryKey: ["service-photos", service.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_photos")
        .select("id, storage_path, caption, created_at")
        .eq("service_record_id", service.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const withUrls = await Promise.all(
        (data ?? []).map(async (p) => {
          const signed = await supabase.storage
            .from("service-photos")
            .createSignedUrl(p.storage_path, 3600);
          return { ...p, url: signed.data?.signedUrl ?? null };
        }),
      );
      return withUrls;
    },
  });

  async function uploadNow(file: File) {
    const path = buildPhotoPath(service.organization_id, service.id, file.name);
    const up = await supabase.storage.from("service-photos").upload(path, file, {
      contentType: file.type || "image/jpeg",
    });
    if (up.error) throw up.error;
    const { error } = await supabase.from("service_photos").insert({
      organization_id: service.organization_id,
      service_record_id: service.id,
      customer_id: service.customer_id,
      property_id: service.property_id,
      pool_id: service.pool_id,
      storage_path: path,
    });
    if (error) throw error;
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    let queuedCount = 0;
    try {
      for (const file of Array.from(files)) {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          await queuePhoto(service, file);
          queuedCount++;
          continue;
        }
        try {
          await uploadNow(file);
        } catch (e) {
          if (!isNetworkError(e)) throw e;
          await queuePhoto(service, file);
          queuedCount++;
        }
      }
      if (queuedCount > 0) {
        toast.success(
          queuedCount === 1
            ? "Photo saved on this phone — it will upload when you have signal."
            : `${queuedCount} photos saved on this phone — they'll upload when you have signal.`,
        );
      } else {
        toast.success("Photos added.");
      }
      await queryClient.invalidateQueries({ queryKey: ["service-photos", service.id] });
    } catch (e) {
      toast.error(friendlyError(e, "We couldn't upload that photo."));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const remove = useMutation({
    mutationFn: async (photo: { id: string; storage_path: string }) => {
      await supabase.storage.from("service-photos").remove([photo.storage_path]);
      const { error } = await supabase.from("service_photos").delete().eq("id", photo.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["service-photos", service.id] });
    },
    onError: (e) => toast.error(friendlyError(e, "We couldn't remove that photo.")),
  });

  const hasPhotos = (photos.data?.length ?? 0) > 0 || pending.length > 0;

  return (
    <section className="panel">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-display text-sm font-semibold">Photos</h2>
        {canEdit ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => void onFiles(e.target.files)}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              ) : (
                <Camera className="mr-1.5 size-4" />
              )}
              Add photos
            </Button>
          </>
        ) : null}
      </header>

      {hasPhotos ? (
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
          {pending.map((p) => (
            <figure
              key={p.id}
              className="group relative overflow-hidden rounded-md border border-dashed border-border"
            >
              <img
                src={p.url}
                alt="Photo waiting to sync"
                className="aspect-square w-full object-cover"
              />
              <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-background/90 px-1.5 py-1 text-[11px] font-medium text-muted-foreground">
                <CloudOff className="size-3" />
                Waiting to sync
              </span>
              {canEdit ? (
                <button
                  type="button"
                  aria-label="Remove photo waiting to sync"
                  onClick={() => void removeQueuedPhoto(p.id)}
                  className="absolute right-1.5 top-1.5 rounded-md bg-background/90 p-1.5 text-destructive opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Trash2 className="size-4" />
                </button>
              ) : null}
            </figure>
          ))}
          {photos.data?.map((p) => (
            <figure
              key={p.id}
              className="group relative overflow-hidden rounded-md border border-border"
            >
              {p.url ? (
                <img
                  src={p.url}
                  alt={p.caption ?? "Service photo"}
                  loading="lazy"
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div className="aspect-square w-full bg-muted" />
              )}
              {canEdit ? (
                <button
                  type="button"
                  aria-label="Delete photo"
                  onClick={() => remove.mutate({ id: p.id, storage_path: p.storage_path })}
                  className="absolute right-1.5 top-1.5 rounded-md bg-background/90 p-1.5 text-destructive opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Trash2 className="size-4" />
                </button>
              ) : null}
            </figure>
          ))}
        </div>
      ) : (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          No photos for this visit yet.
        </p>
      )}
    </section>
  );
}
