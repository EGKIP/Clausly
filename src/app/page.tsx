import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import { Hero } from "@/components/marketing/hero";
import { DocumentStrip } from "@/components/marketing/document-strip";
import { ProblemSolution } from "@/components/marketing/problem-solution";
import { FeatureBento } from "@/components/marketing/feature-bento";
import { ProductPreview } from "@/components/marketing/product-preview";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Pricing } from "@/components/marketing/pricing";
import { FAQ } from "@/components/marketing/faq";
import { FinalCTA } from "@/components/marketing/cta";

export default function HomePage() {
  return (
    <>
      <MarketingNav />
      <main className="relative">
        <Hero />
        <DocumentStrip />
        <ProblemSolution />
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
