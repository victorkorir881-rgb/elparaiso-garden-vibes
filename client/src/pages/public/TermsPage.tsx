import PublicLayout from "@/components/public/PublicLayout";

export default function TermsPage() {
  return (
    <PublicLayout>
      <section className="py-20 bg-card/50 border-b border-border">
        <div className="container text-center">
          <h1 className="section-title text-foreground mb-4">Terms of Service</h1>
          <div className="gold-divider mx-auto" />
        </div>
      </section>
      <section className="section-padding bg-background">
        <div className="container max-w-3xl">
          <p className="text-muted-foreground mb-6">Last updated: {new Date().getFullYear()}</p>
          <h2 className="text-foreground font-semibold text-xl mt-8 mb-3">Reservations</h2>
          <p className="text-muted-foreground mb-4">Reservations are subject to availability and will be confirmed by our team. We reserve the right to cancel reservations in exceptional circumstances.</p>
          <h2 className="text-foreground font-semibold text-xl mt-8 mb-3">Conduct</h2>
          <p className="text-muted-foreground mb-4">We expect all guests to behave respectfully. Management reserves the right to refuse service to anyone who is disruptive or violates our policies.</p>
          <h2 className="text-foreground font-semibold text-xl mt-8 mb-3">Contact</h2>
          <p className="text-muted-foreground">For questions, contact us at <a href="tel:0791224513" className="text-primary hover:underline">0791 224513</a>.</p>
        </div>
      </section>
    </PublicLayout>
  );
}
