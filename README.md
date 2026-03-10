# ProductPulse

Starter scaffold for ProductPulse built with:

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- shadcn-style UI components
- Firebase v11+ (Auth + Firestore)
- React Context (session state)
- TanStack Query (data fetching)

## Setup

1. Install dependencies:
   - `npm install`
2. Copy env vars:
   - `Copy-Item .env.example .env.local`
3. Fill Firebase values in `.env.local`.
4. Start dev server:
   - `npm run dev`

## Data Privacy Rules

`firestore.rules` enforces:

- PMs can read/write only projects where `ownerId == request.auth.uid`.
- Helpers can read only studies where `request.auth.uid` is in `helperIds`.

## Error Handling Convention

All Firebase calls in this scaffold are wrapped in `try-catch` blocks and use `sonner` toasts for user feedback.

## Troubleshooting

### Vercel Build Error: `auth/invalid-api-key` during `/_not-found` prerender

If Vercel shows `Error occurred prerendering page "/_not-found"` with
`Firebase: Error (auth/invalid-api-key)`:

1. Confirm deployment revision:
   - Check deployment logs for `[deploy] revision=...`.
   - Make sure Vercel is building the latest `main` commit.
2. Verify Firebase Web env vars in Vercel for both Preview and Production:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
   - `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` (optional)
3. Remove placeholder values (`your-*`, `replace-*`) and extra quotes/spaces.
4. Redeploy with cleared build cache.

Optional diagnostics:

- Set `NEXT_PUBLIC_ENABLE_DEPLOY_DIAGNOSTICS=1` to log client-side Firebase config diagnostics.
- Set `NEXT_PUBLIC_APP_COMMIT_SHA` or `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` to surface revision info in browser logs.

### MetaMask Runtime Overlay in Dev

If you see `Failed to connect to MetaMask` with a stack like `chrome-extension://...`, this is from a browser extension script injection, not ProductPulse app code.

Use one of these to isolate it:

- Disable MetaMask extension for the current browser profile.
- Open the app in Incognito with extensions disabled.
- Test in a clean browser profile.

Do not add global error suppression in app code for this.

Redeploy trigger note: 2026-03-10 15:54:48 UTC.
