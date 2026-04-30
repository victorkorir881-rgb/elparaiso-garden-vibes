import { createRootRoute, Outlet } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/site-url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0a0a0a" },
      { name: "robots", content: "index, follow" },
      { name: "author", content: "Elparaiso Garden Kisii" },
      { property: "og:site_name", content: "Elparaiso Garden Kisii" },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "en_KE" },
      { property: "og:url", content: SITE_URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "canonical", href: SITE_URL },
      { rel: "icon", href: "/favicon.ico" },
    ],
  }),
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
