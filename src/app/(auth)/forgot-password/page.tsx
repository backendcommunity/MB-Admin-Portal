import Link from "next/link";
import { KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-lg">
        <EmptyState
          title="Reset your password"
          description="Password reset is handled by the support team for now."
          icon={KeyRound}
          action={
            <Button asChild>
              <Link href="/login">Back to sign in</Link>
            </Button>
          }
        />
      </div>
    </div>
  );
}
