/**
 * A realistic miniature website used by crawl tests and by the demo brand seed.
 * It deliberately includes JSON-LD, an accordion FAQ, testimonials, prices and
 * a sitemap index, because those are the shapes real marketing sites take.
 */
const layout = (title: string, body: string, head = '') => `<!doctype html>
<html lang="en">
<head>
<title>${title}</title>
<style>:root{--brand:#1b6ef3;--accent:#0d3b66;--ink:#111827}</style>
${head}
</head>
<body>
<header><a href="/"><img src="/img/logo.svg" class="site-logo" alt="Orca Credit logo"></a>
<nav><a href="/products/credit-builder">Credit Builder</a><a href="/services/credit-coaching">Coaching</a>
<a href="/pricing">Pricing</a><a href="/faq">FAQ</a><a href="/about">About</a><a href="/blog">Blog</a>
<a href="/testimonials">Reviews</a><a href="/contact">Contact</a><a href="/privacy">Privacy</a></nav></header>
<main>${body}</main>
<footer><a href="https://instagram.com/orcacredit">Instagram</a><a href="https://www.linkedin.com/company/orcacredit">LinkedIn</a>
<a href="https://x.com/orcacredit">X</a><a href="/terms">Terms</a></footer>
</body></html>`;

export const ORCA_ORIGIN = 'https://orcacredit.example';

export const ORCA_SITE: Record<string, string> = {
  [`${ORCA_ORIGIN}/robots.txt`]: `User-agent: *
Disallow: /account/
Disallow: /cart
Allow: /account/public
Crawl-delay: 1

Sitemap: ${ORCA_ORIGIN}/sitemap_index.xml
`,

  [`${ORCA_ORIGIN}/sitemap_index.xml`]: `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${ORCA_ORIGIN}/sitemap-pages.xml</loc></sitemap>
  <sitemap><loc>${ORCA_ORIGIN}/sitemap-blog.xml</loc></sitemap>
</sitemapindex>`,

  [`${ORCA_ORIGIN}/sitemap-pages.xml`]: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${ORCA_ORIGIN}/</loc><priority>1.0</priority></url>
  <url><loc>${ORCA_ORIGIN}/products/credit-builder</loc><priority>0.9</priority></url>
  <url><loc>${ORCA_ORIGIN}/services/credit-coaching</loc><priority>0.8</priority></url>
  <url><loc>${ORCA_ORIGIN}/pricing</loc><priority>0.8</priority></url>
  <url><loc>${ORCA_ORIGIN}/faq</loc><priority>0.6</priority></url>
  <url><loc>${ORCA_ORIGIN}/about</loc><priority>0.6</priority></url>
  <url><loc>${ORCA_ORIGIN}/testimonials</loc><priority>0.6</priority></url>
  <url><loc>${ORCA_ORIGIN}/contact</loc><priority>0.4</priority></url>
  <url><loc>${ORCA_ORIGIN}/privacy</loc><priority>0.1</priority></url>
  <url><loc>${ORCA_ORIGIN}/account/settings</loc><priority>0.1</priority></url>
</urlset>`,

  [`${ORCA_ORIGIN}/sitemap-blog.xml`]: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${ORCA_ORIGIN}/blog/how-credit-scores-work</loc><lastmod>2026-07-02</lastmod></url>
  <url><loc>${ORCA_ORIGIN}/blog/first-time-homebuyer-credit</loc><lastmod>2026-06-18</lastmod></url>
</urlset>`,

  [`${ORCA_ORIGIN}/`]: layout(
    'Orca Credit — Build credit without the guesswork',
    `<h1>Build credit without the guesswork</h1>
     <p>Orca Credit helps everyday people raise their credit score with a reporting-backed builder
        account, plain-English guidance and coaching from real humans. No hard credit check to start.</p>
     <h2>Why people choose Orca</h2>
     <p>We report to all three bureaus, we never charge interest, and we explain every change to your score.</p>
     <a href="/products/credit-builder" class="btn">Get started</a>
     <a href="/pricing">See plans</a>
     <img src="/img/hero-family.jpg" class="hero-image" alt="A family reviewing their finances">`,
    `<meta name="description" content="Orca Credit helps consumers build credit with a reporting-backed builder account and human coaching.">
     <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Orca Credit","description":"Consumer credit building and financial management","sameAs":["https://instagram.com/orcacredit"]}</script>`,
  ),

  [`${ORCA_ORIGIN}/products/credit-builder`]: layout(
    'Credit Builder Account — Orca Credit',
    `<h1>Credit Builder Account</h1>
     <p>A small locked savings account that reports on-time payments to all three credit bureaus every month.
        You set aside as little as $10 a month, and every payment builds your history.</p>
     <h2>Benefits</h2>
     <ul><li>Reports to Equifax, Experian and TransUnion</li><li>No hard credit check to open</li>
     <li>No interest and no hidden fees</li><li>Your savings come back to you at the end of the term</li></ul>
     <p>$10 per month. Cancel any time.</p>
     <a href="/pricing" class="cta">Get started</a>
     <img src="/img/credit-builder-card.png" alt="Orca Credit Builder card">`,
    `<meta name="description" content="A locked savings account that reports on-time payments to all three bureaus.">
     <script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Credit Builder Account","description":"Reporting-backed credit builder account","offers":{"@type":"Offer","price":"10.00","priceCurrency":"USD"}}</script>`,
  ),

  [`${ORCA_ORIGIN}/services/credit-coaching`]: layout(
    'Credit Coaching — Orca Credit',
    `<h1>Credit Coaching</h1>
     <p>One-to-one sessions with a certified credit counselor who reviews your report line by line and
        builds a plan you can actually follow. Sessions run 45 minutes and are available evenings and weekends.</p>
     <h2>What you get</h2>
     <ul><li>A full report review</li><li>A written 90-day plan</li><li>Dispute support for errors</li></ul>
     <p>$49 per session.</p>
     <a href="/contact">Book a call</a>`,
    `<script type="application/ld+json">{"@context":"https://schema.org","@type":"Service","name":"Credit Coaching"}</script>`,
  ),

  [`${ORCA_ORIGIN}/pricing`]: layout(
    'Pricing — Orca Credit',
    `<h1>Simple pricing</h1>
     <h2>Builder</h2><p>$10 / month. Credit builder account, score tracking, monthly reporting.</p>
     <h2>Builder Plus</h2><p>$19 / month. Everything in Builder plus one coaching session each quarter.</p>
     <h2>Coaching</h2><p>$49 per session, billed as you go.</p>
     <p>Choose your plan and cancel any time. Free plan available for score tracking only.</p>
     <a href="/contact">Get started</a>`,
  ),

  [`${ORCA_ORIGIN}/faq`]: layout(
    'FAQ — Orca Credit',
    `<h1>Frequently asked questions</h1>
     <details><summary>Does opening an account hurt my credit?</summary>
       <p>No. Opening an Orca Credit Builder account does not require a hard credit check, so your score is not affected when you join.</p></details>
     <details><summary>How quickly will I see my score change?</summary>
       <p>Most members see their first reported payment within 30 to 45 days. Score movement depends on the rest of your credit file.</p></details>
     <details><summary>Can I cancel at any time?</summary>
       <p>Yes. You can close your account at any time and your locked savings are returned to you.</p></details>`,
    `<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Is Orca Credit a loan?","acceptedAnswer":{"@type":"Answer","text":"No. The Credit Builder account is a savings product, not a loan, and it never charges interest."}}]}</script>`,
  ),

  [`${ORCA_ORIGIN}/testimonials`]: layout(
    'Reviews — Orca Credit',
    `<h1>What our customers say</h1>
     <blockquote>My score went up 74 points in six months and for the first time I understood exactly why it moved.<cite>Dana R., Columbus</cite></blockquote>
     <blockquote>I had been turned down for a car loan twice. After a year with Orca I was approved at a rate I could actually afford.<cite>Marcus T., Phoenix</cite></blockquote>
     <div class="testimonial"><p>The coaching session was worth it on its own. She found two errors on my report that I never would have caught.</p><span class="author">Priya S.</span></div>`,
  ),

  [`${ORCA_ORIGIN}/about`]: layout(
    'About — Orca Credit',
    `<h1>About Orca Credit</h1>
     <p>Our mission is to make credit building understandable. We believe people fail at credit because
        nobody ever explains the rules, not because they are careless with money.</p>
     <p>Founded in 2021, we are a team of former bank underwriters and certified counselors.</p>`,
  ),

  [`${ORCA_ORIGIN}/contact`]: layout(
    'Contact — Orca Credit',
    `<h1>Contact us</h1><p>Email us at hello@orcacredit.example or schedule a call with our team. Office hours are 9am to 7pm ET.</p>
     <a href="/contact">Book a demo</a>`,
  ),

  [`${ORCA_ORIGIN}/blog/how-credit-scores-work`]: layout(
    'How credit scores actually work — Orca Credit',
    `<h1>How credit scores actually work</h1>
     <p>Payment history is thirty-five percent of your score. Utilization is thirty percent. Everything else —
        length of history, credit mix and new inquiries — makes up the rest. Understanding the weighting tells you
        exactly where to spend your effort, and it is usually not where people expect.</p>
     <h2>Payment history</h2><p>One missed payment can cost more points than a year of perfect behaviour earns.</p>
     <h2>Utilization</h2><p>Utilization is measured per card and overall. Paying down a single maxed card often moves the number fastest.</p>
     <a href="/products/credit-builder">Learn more</a>`,
    `<meta property="article:published_time" content="2026-07-02T09:00:00Z">
     <script type="application/ld+json">{"@context":"https://schema.org","@type":"BlogPosting","headline":"How credit scores actually work","datePublished":"2026-07-02T09:00:00Z"}</script>`,
  ),

  [`${ORCA_ORIGIN}/blog/first-time-homebuyer-credit`]: layout(
    'Credit for first-time homebuyers — Orca Credit',
    `<h1>What lenders look for from first-time homebuyers</h1>
     <p>Mortgage underwriting looks at more than the number. Lenders want twelve months of clean payment history,
        a utilization figure under thirty percent and a stable income record. Here is how to get there in a year.</p>
     <h2>Twelve months out</h2><p>Stop opening new accounts and start reporting on-time payments every month.</p>
     <a href="/services/credit-coaching">Learn more</a>`,
    `<meta property="article:published_time" content="2026-06-18T09:00:00Z">`,
  ),

  [`${ORCA_ORIGIN}/privacy`]: layout('Privacy Policy — Orca Credit', '<h1>Privacy Policy</h1><p>We describe here how we handle personal data.</p>'),
  [`${ORCA_ORIGIN}/terms`]: layout('Terms — Orca Credit', '<h1>Terms of Service</h1><p>These terms govern your use of Orca Credit.</p>'),
  [`${ORCA_ORIGIN}/account/settings`]: layout('Account settings', '<h1>Settings</h1>'),
};
