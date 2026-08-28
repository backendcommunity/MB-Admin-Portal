'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

/**
 * Shows the exact request a form would send. It is not decoration: it is how an
 * author (or whoever is debugging with them) checks that what the screen says
 * matches what the API receives, without opening devtools.
 */
export function PayloadDialog({
  open,
  onClose,
  method,
  path,
  body,
}: {
  open: boolean;
  onClose: () => void;
  method: string;
  path: string;
  body: unknown;
}) {
  const text = JSON.stringify(body, null, 2);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] max-w-xl overflow-y-auto sm:w-full">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 font-mono text-sm">
            <span className="rounded border border-border px-1.5 py-0.5 text-xs font-bold">
              {method}
            </span>
            <span className="break-all">{path}</span>
          </DialogTitle>
        </DialogHeader>

        <pre className="overflow-x-auto rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs leading-relaxed">
          {text}
        </pre>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text);
                toast.success('Copied.');
              } catch {
                toast.error('Select the text and copy manually.');
              }
            }}
          >
            Copy
          </Button>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
