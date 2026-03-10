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

### MetaMask Runtime Overlay in Dev

If you see `Failed to connect to MetaMask` with a stack like `chrome-extension://...`, this is from a browser extension script injection, not ProductPulse app code.

Use one of these to isolate it:

- Disable MetaMask extension for the current browser profile.
- Open the app in Incognito with extensions disabled.
- Test in a clean browser profile.

Do not add global error suppression in app code for this.
