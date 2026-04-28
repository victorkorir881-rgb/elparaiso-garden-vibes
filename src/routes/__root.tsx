import { createRootRoute, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  return <Outlet />;
}

function NotFoundComponent() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground gap-4">
      <h1 className="text-4xl font-bold">404 — Page Not Found</h1>
      <a href="/" className="text-primary underline">Go home</a>
    </div>
  );
}
