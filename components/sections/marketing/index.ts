/**
 * The marketing sections, after the shape of a SaaS site's home, enterprise
 * and pricing pages, in the generic label's dress. Pages build from these;
 * Notion pages with Layout "Landing" are mapped onto them
 * (components/notion/landing.tsx). docs/sections.md shows each one.
 */
export { ComparisonTable, type ComparisonPlan } from "./comparison-table"
export { Faq, type FaqItem } from "./faq"
export { Bento, FeatureColumns, SplitFeature, TrustFacts, type BentoItem, type Feature } from "./features"
export { FeatureTabs, type Tab } from "./feature-tabs"
export { FinalCta } from "./final-cta"
export { HeroCentered, HeroSplit, KineticWords } from "./hero"
export { Container, MarketingSection, MoreLink, SectionHead } from "./layout"
export { NutritionFacts, type NutritionFact } from "./nutrition-facts"
export { PricingPlans, type PlanView, type PricingLabels } from "./pricing-plans"
export { LogoStrip, logoItems, Quote, QuoteCard, StatCards, type LogoItem, type QuoteView, type Stat } from "./proof"
export { averageRating, initials, ReviewCards, Stars, type ReviewView } from "./reviews"
