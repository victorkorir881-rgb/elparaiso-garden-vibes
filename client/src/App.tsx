import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { CartProvider } from "./contexts/CartContext";

// Public pages
import HomePage from "./pages/public/HomePage";
import MenuPage from "./pages/public/MenuPage";
import AboutPage from "./pages/public/AboutPage";
import GalleryPage from "./pages/public/GalleryPage";
import ContactPage from "./pages/public/ContactPage";
import ReservationsPage from "./pages/public/ReservationsPage";
import EventsPage from "./pages/public/EventsPage";
import PrivacyPage from "./pages/public/PrivacyPage";
import TermsPage from "./pages/public/TermsPage";
import OrderTrackingPage from "./pages/public/OrderTrackingPage";
import OrderPage from "./pages/public/OrderPage";

// Admin pages
import AdminLayout from "./components/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminMenu from "./pages/admin/AdminMenu";
import AdminReservations from "./pages/admin/AdminReservations";
import AdminEvents from "./pages/admin/AdminEvents";
import AdminGallery from "./pages/admin/AdminGallery";
import AdminTestimonials from "./pages/admin/AdminTestimonials";
import AdminMessages from "./pages/admin/AdminMessages";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminSEO from "./pages/admin/AdminSEO";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminBusinessRules from "./pages/admin/AdminBusinessRules";
import AdminLogin from "./pages/admin/AdminLogin";

function Router() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={HomePage} />
      <Route path="/menu" component={MenuPage} />
      <Route path="/about" component={AboutPage} />
      <Route path="/gallery" component={GalleryPage} />
      <Route path="/contact" component={ContactPage} />
      <Route path="/reservations" component={ReservationsPage} />
      <Route path="/events" component={EventsPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/track" component={OrderTrackingPage} />
      <Route path="/order" component={OrderPage} />

      {/* Admin login */}
      <Route path="/admin/login" component={AdminLogin} />

      {/* Admin routes wrapped in layout */}
      <Route path="/admin/*">
        {() => (
          <AdminLayout>
            <Switch>
              <Route path="/admin" component={AdminDashboard} />
              <Route path="/admin/menu" component={AdminMenu} />
              <Route path="/admin/orders" component={AdminOrders} />
              <Route path="/admin/reservations" component={AdminReservations} />
              <Route path="/admin/events" component={AdminEvents} />
              <Route path="/admin/gallery" component={AdminGallery} />
              <Route path="/admin/testimonials" component={AdminTestimonials} />
              <Route path="/admin/messages" component={AdminMessages} />
              <Route path="/admin/settings" component={AdminSettings} />
              <Route path="/admin/business-rules" component={AdminBusinessRules} />
              <Route path="/admin/seo" component={AdminSEO} />
              <Route path="/admin/users" component={AdminUsers} />
              <Route component={NotFound} />
            </Switch>
          </AdminLayout>
        )}
      </Route>

      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <CartProvider>
          <TooltipProvider>
            <Toaster richColors position="top-right" />
            <Router />
          </TooltipProvider>
        </CartProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
