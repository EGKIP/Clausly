import { Suspense } from "react";
import { redirect } from "next/navigation";
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

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const oauthCode = stringParam(params?.code);

  if (oauthCode) {
    const forwardedParams = new URLSearchParams();

    for (const [key, value] of Object.entries(params ?? {})) {
      if (typeof value === "string") forwardedParams.set(key, value);
      if (Array.isArray(value)) value.forEach((item) => forwardedParams.append(key, item));
    }

    redirect(`/auth/callback?${forwardedParams.toString()}`);
  }

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

function stringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
