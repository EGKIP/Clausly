import { Suspense } from "react";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import { Hero } from "@/components/marketing/hero";
import { FeatureBento } from "@/components/marketing/feature-bento";
import { ProductPreview } from "@/components/marketing/product-preview";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Pricing } from "@/components/marketing/pricing";
import { FAQ } from "@/components/marketing/faq";
import { FinalCTA } from "@/components/marketing/cta";
import { AccountDeletedBanner } from "@/components/marketing/account-deleted-banner";

export default function HomePage() {
  return (
    <>
      <MarketingNav />
      <main className="relative">
        <Suspense fallback={null}>
          <AccountDeletedBanner />
        </Suspense>
        <Hero />
        <FeatureBento />
        <ProductPreview />
        <HowItWorks />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <MarketingFooter />
    </>
  );
}
