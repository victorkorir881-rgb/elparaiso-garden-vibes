import { useRef, useState } from "react";
import { Upload, Loader2, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { uploadOptimizedImage } from "@/lib/storage-upload";

type Props = {
  value: string;
  onChange: (url: string) => void;
  /** Subfolder inside the `media` bucket. */
  folder: string;
  label?: string;
  /** Show an "or paste URL" input alongside the file picker. Default true. */
  allowUrl?: boolean;
};

/**
 * Drop-in field that lets an admin EITHER pick a local file (which is
 * resized + WebP-encoded in the browser, then uploaded to Supabase Storage)
 * OR paste an existing image URL.
 */
export function ImageUploadField({
  value,
  onChange,
  folder,
  label = "Image",
  allowUrl = true,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [stats, setStats] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    setStats(null);
    try {
      const res = await uploadOptimizedImage(file, folder);
      onChange(res.url);
      const saved = Math.max(0, Math.round((1 - res.bytes / res.originalBytes) * 100));
      setStats(
        `Uploaded ${res.width}×${res.height} · ${(res.bytes / 1024).toFixed(0)} KB (${saved}% smaller)`,
      );
      toast.success("Image uploaded");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      toast.error(msg);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-foreground">{label}</Label>
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="border-border text-foreground hover:bg-accent"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Optimizing…</>
            ) : (
              <><Upload className="w-4 h-4 mr-1" /> Upload file</>
            )}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => { onChange(""); setStats(null); }}
              disabled={uploading}
            >
              Clear
            </Button>
          )}
        </div>
        {allowUrl && (
          <div className="flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="…or paste an image URL"
              className="bg-input border-border text-foreground"
            />
          </div>
        )}
        {stats && <p className="text-xs text-muted-foreground">{stats}</p>}
        {value && (
          <img
            src={value}
            alt="preview"
            className="w-full max-h-48 object-cover rounded-lg border border-border"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        )}
      </div>
    </div>
  );
}
