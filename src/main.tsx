import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { createRoot } from "react-dom/client";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CartProvider } from "./contexts/CartContext";
import { AuthProvider } from "./lib/auth";
import { createRouter } from "./router";
import "./index.css";

const queryClient = new QueryClient();
const router = createRouter();

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ErrorBoundary>
        <ThemeProvider defaultTheme="dark">
          <CartProvider>
            <TooltipProvider>
              <Toaster richColors position="top-right" />
              <RouterProvider router={router} />
            </TooltipProvider>
          </CartProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </AuthProvider>
  </QueryClientProvider>
);
