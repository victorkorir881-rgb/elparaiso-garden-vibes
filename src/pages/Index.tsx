import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import VibeSection from "@/components/VibeSection";
import MenuSection from "@/components/MenuSection";
import ReviewsSection from "@/components/ReviewsSection";
import AmenitiesSection from "@/components/AmenitiesSection";
import ContactSection from "@/components/ContactSection";
import Footer from "@/components/Footer";
import FloatingCTA from "@/components/FloatingCTA";
import ChatWidget from "@/components/chat/ChatWidget";
import { Toaster } from "@/components/ui/toaster";

export default function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <HeroSection />
      <VibeSection />
      <MenuSection />
      <ReviewsSection />
      <AmenitiesSection />
      <ContactSection />
      <Footer />
      {/* Floating overlays — rendered after page content to ensure correct stacking */}
      <FloatingCTA />
      <ChatWidget />
      <Toaster />
    </div>
  );
}
