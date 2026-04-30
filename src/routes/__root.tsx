import { createRootRoute, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  return <Outlet />;
}

function NotFoundComponent() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground gap-4 px-6 text-center">
      <h1 className="text-5xl font-display font-bold text-primary">404</h1>
      <p className="text-xl text-foreground">Page not found</p>
      <p className="text-sm text-muted-foreground max-w-md">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <a
        href="/"
        className="mt-2 inline-flex items-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Go home
      </a>
    </div>
  );
}

function ErrorComponent({ error }: { error: Error }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground gap-4 px-6 text-center">
      <h1 className="text-4xl font-display font-bold text-destructive">Something went wrong</h1>
      <p className="text-sm text-muted-foreground max-w-lg">
        {error?.message ?? "An unexpected error occurred. Please try again."}
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Reload
        </button>
        <a
          href="/"
          className="inline-flex items-center rounded-md border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
        >
          Go home
        </a>
      </div>
    </div>
  );
}
