import PublicLayout from "@/components/public/PublicLayout";

export default function PrivacyPage() {
  return (
    <PublicLayout>
      <section className="py-20 bg-card/50 border-b border-border">
        <div className="container text-center">
          <h1 className="section-title text-foreground mb-4">Privacy Policy</h1>
          <div className="gold-divider mx-auto" />
        </div>
      </section>
      <section className="section-padding bg-background">
        <div className="container max-w-3xl prose prose-invert">
          <p className="text-muted-foreground">Last updated: {new Date().getFullYear()}</p>
          <h2 className="text-foreground font-display font-semibold text-xl mt-8 mb-3">Information We Collect</h2>
          <p className="text-muted-foreground">When you make a reservation or contact us, we collect your name, phone number, email address, and any additional information you provide. This information is used solely to manage your reservation or inquiry.</p>
          <h2 className="text-foreground font-display font-semibold text-xl mt-8 mb-3">How We Use Your Information</h2>
          <p className="text-muted-foreground">We use your information to confirm reservations, respond to inquiries, and improve our services. We do not sell or share your personal information with third parties.</p>
          <h2 className="text-foreground font-display font-semibold text-xl mt-8 mb-3">Contact</h2>
          <p className="text-muted-foreground">For privacy concerns, contact us at <a href="tel:0791224513" className="text-primary hover:underline">0791 224513</a>.</p>
        </div>
      </section>
    </PublicLayout>
  );
}
