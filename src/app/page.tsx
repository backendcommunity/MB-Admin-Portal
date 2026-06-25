export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-foreground">MB Admin Portal</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to access the admin workspace.
        </p>
        <a
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          href="/login"
        >
          Go to login
        </a>
      </div>
    </main>
  );
}
