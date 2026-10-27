import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageUp, Loader2, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { friendlyError } from "@/lib/format";

const FIELDS = ["name", "email", "phone", "website", "address", "city", "state", "zip"] as const;
type Field = (typeof FIELDS)[number];

export function CompanyProfileForm() {
  const { organization, isAdmin, refresh } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<Record<Field, string>>(
    () => Object.fromEntries(FIELDS.map((f) => [f, ""])) as Record<Field, string>,
  );

  useEffect(() => {
    if (!organization) return;
    setForm(
      Object.fromEntries(
        FIELDS.map((f) => [f, (organization[f] as string | null) ?? ""]),
      ) as Record<Field, string>,
    );
  }, [organization]);

  const logoPath = organization?.logo_url ?? null;
  const logo = useQuery({
    queryKey: ["company-logo", logoPath],
    enabled: !!logoPath,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("company-logos")
        .createSignedUrl(logoPath!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });

  async function updateOrg(patch: Record<string, string | null>) {
    const { error } = await supabase.from("organizations").update(patch).eq("id", organization!.id);
    if (error) throw error;
    await refresh();
    await queryClient.invalidateQueries({ queryKey: ["company-logo"] });
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Company name is required.");
    setSaving(true);
    try {
      await updateOrg(
        Object.fromEntries(
          FIELDS.map((f) => [f, f === "name" ? form.name.trim() : form[f].trim() || null]),
        ),
      );
      toast.success("Company profile saved.");
    } catch (err) {
      toast.error(friendlyError(err, "We couldn't save your company profile."));
    } finally {
      setSaving(false);
    }
  }

  async function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !organization) return;
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file.");
    if (file.size > 5 * 1024 * 1024) return toast.error("Logo must be under 5 MB.");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${organization.id}/logo-${Date.now()}.${ext}`;
      const up = await supabase.storage
        .from("company-logos")
        .upload(path, file, { contentType: file.type });
      if (up.error) throw up.error;
      const old = logoPath;
      await updateOrg({ logo_url: path });
      if (old) await supabase.storage.from("company-logos").remove([old]);
      toast.success("Logo updated.");
    } catch (err) {
      toast.error(friendlyError(err, "We couldn't upload that logo."));
    } finally {
      setUploading(false);
    }
  }

  async function removeLogo() {
    if (!logoPath) return;
    try {
      await updateOrg({ logo_url: null });
      await supabase.storage.from("company-logos").remove([logoPath]);
      toast.success("Logo removed.");
    } catch (err) {
      toast.error(friendlyError(err, "We couldn't remove the logo."));
    }
  }

  const set = (key: Field) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  const disabled = !isAdmin;

  return (
    <form onSubmit={onSave} className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
          {logo.data ? (
            <img src={logo.data} alt="Company logo" className="size-full object-contain" />
          ) : (
            <span className="text-xs text-muted-foreground">No logo</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onLogo} />
          <Button
            type="button"
            variant="outline"
            disabled={disabled || uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <ImageUp className="mr-2 size-4" />
            )}
            {logoPath ? "Change logo" : "Upload logo"}
          </Button>
          {logoPath ? (
            <Button type="button" variant="ghost" disabled={disabled} onClick={removeLogo}>
              <Trash2 className="mr-2 size-4" /> Remove
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="org-name">Company name</Label>
        <Input id="org-name" value={form.name} onChange={set("name")} disabled={disabled} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="org-phone">Phone</Label>
          <Input id="org-phone" type="tel" value={form.phone} onChange={set("phone")} disabled={disabled} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="org-email">Email</Label>
          <Input id="org-email" type="email" value={form.email} onChange={set("email")} disabled={disabled} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="org-website">Website</Label>
        <Input id="org-website" value={form.website} onChange={set("website")} disabled={disabled} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="org-address">Street address</Label>
        <Input id="org-address" value={form.address} onChange={set("address")} disabled={disabled} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="org-city">City</Label>
          <Input id="org-city" value={form.city} onChange={set("city")} disabled={disabled} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="org-state">State</Label>
          <Input id="org-state" value={form.state} onChange={set("state")} disabled={disabled} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="org-zip">ZIP</Label>
          <Input id="org-zip" value={form.zip} onChange={set("zip")} disabled={disabled} />
        </div>
      </div>
      {isAdmin ? (
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
          Save company profile
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">Only an owner or admin can edit these.</p>
      )}
    </form>
  );
}
