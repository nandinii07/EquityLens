This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Environment Variables

Financial data comes from [SEC EDGAR](https://www.sec.gov/edgar) (`data.sec.gov`), which is free and requires **no API key** — the app works with zero configuration for that part. Create `.env.local` in the project root (already gitignored — never commit it) with:

```
ANTHROPIC_API_KEY=your-anthropic-key                   # required for AI explanations — https://console.anthropic.com/settings/keys
SEC_USER_AGENT_CONTACT=Your Name your-email@example.com # optional but recommended before deploying — see below
```

`ANTHROPIC_API_KEY` is read server-side only (`lib/ai-analysis.ts`) and is never sent to the browser. Without it set, the AI Analysis section on each company page shows "AI analysis is temporarily unavailable" — the rest of the dashboard (score, metrics, charts) works fully without it.

`SEC_USER_AGENT_CONTACT` identifies this app's requests to SEC EDGAR per [SEC's fair-access policy](https://www.sec.gov/os/webmaster-faq#developers), which asks every automated caller to send a descriptive `User-Agent` with contact information. The app works without it (a generic placeholder is sent), but set it to your own name/email before a production deployment.

A previous version of this app used Alpha Vantage (a paid-tier-gated, quota-limited third-party API) as its financial data source; it has been fully removed — see `lib/sec-financial-api.ts` for the current SEC EDGAR integration.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
