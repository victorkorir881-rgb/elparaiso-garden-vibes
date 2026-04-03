import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import NotFound from "./pages/NotFound";
import ConversationsPage from "./pages/admin/ConversationsPage";
import FAQsPage from "./pages/admin/FAQsPage";
import MenuPage from "./pages/admin/MenuPage";
import ReservationsPage from "./pages/admin/ReservationsPage";
import EventsPage from "./pages/admin/EventsPage";
import ReviewsPage from "./pages/admin/ReviewsPage";
import SettingsPage from "./pages/admin/SettingsPage";

const queryClient = new QueryClient();

const AdminRoute = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin/conversations" element={<AdminRoute><ConversationsPage /></AdminRoute>} />
            <Route path="/admin/faqs" element={<AdminRoute><FAQsPage /></AdminRoute>} />
            <Route path="/admin/menu" element={<AdminRoute><MenuPage /></AdminRoute>} />
            <Route path="/admin/reservations" element={<AdminRoute><ReservationsPage /></AdminRoute>} />
            <Route path="/admin/events" element={<AdminRoute><EventsPage /></AdminRoute>} />
            <Route path="/admin/reviews" element={<AdminRoute><ReviewsPage /></AdminRoute>} />
            <Route path="/admin/settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
