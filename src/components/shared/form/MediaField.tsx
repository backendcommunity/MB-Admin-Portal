'use client';

import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { uploadImage, type UploadScope } from '@/lib/api/courses';
import { toast } from 'sonner';

/**
 * Asks the API for a signed R2 URL, PUTs the file straight there, and stores the
 * public URL. Pasting a URL by hand still works — some banners live elsewhere.
 */
export function MediaField({
  value,
  onChange,
  label,
  scope,
  ownerId,
  required,
  hint,
}: {
  value: string;
  onChange: (next: string) => void;
  label: string;
  scope: UploadScope;
  /** Uploads need an owner to key the object by; before the draft exists, there is none. */
  ownerId?: string;
  required?: boolean;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File) => {
    if (!ownerId) {
      toast.error('Save the draft first', {
        description: 'Uploads are stored against the course, so it needs an id.',
      });
      return;
    }
    setBusy(true);
    try {
      const url = await uploadImage(file, scope, ownerId);
      onChange(url);
      toast.success('Uploaded.');
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
        (error as Error).message;
      toast.error('Upload failed', { description: message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <label htmlFor={`media-${scope}`} className="text-sm font-medium">
        {label} {required ? <span className="text-destructive">*</span> : null}
      </label>
      <div className="flex gap-2">
        <Input
          id={`media-${scope}`}
          value={value ?? ''}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://cdn.masteringbackend.com/courses/…"
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onFile(file);
            event.target.value = '';
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="mr-1.5 h-4 w-4" />
          {busy ? 'Uploading…' : 'Upload'}
        </Button>
      </div>
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary external CDN hosts, not in next.config images
        <img
          src={value}
          alt=""
          className="mt-1 h-24 w-auto rounded-md border border-border object-cover"
          onError={(event) => {
            (event.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : null}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
