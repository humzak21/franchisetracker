# Sign in with Vercel: setup

The whole app sits behind Sign in with Vercel. Convex Auth runs the OAuth flow on the Convex
deployment (PKCE, state and nonce), checks the account against `OWNER_EMAILS`, and issues its
own session tokens. Every public Convex function calls `requireOwner` (`convex/lib/auth.ts`).

Local development and Playwright never touch Vercel: `npm run use:local` turns on a test-only
sign-in that exists only on the local deployment.

## 1. Create the Vercel app (once)

1. In the Vercel dashboard, open your team's **Settings → Apps** and click **Create**. Name it
   `FranchiseTracker` and save.
2. **Manage → Authentication:** keep `client_secret_basic` enabled and click **Generate** to
   create a client secret. Copy the client ID and the secret.
3. **Manage → Permissions:** enable `openid`, `email` and `profile`. (`offline_access` is not
   needed: Convex Auth keeps its own sessions.)
4. **Manage → Authorization Callback URLs:** add one URL per Convex deployment that should
   allow sign-in. The format is `<deployment site URL>/api/auth/callback/vercel`:
   - Production: `https://<prod-deployment>.convex.site/api/auth/callback/vercel`
   - Cloud dev (optional): `https://prestigious-iguana-83.convex.site/api/auth/callback/vercel`
5. **General → Sign-In Access:** choose **Members of the team**. Vercel then refuses anyone
   outside your team before the app's own allowlist runs.

## 2. Configure each Convex deployment

Run these against the deployment you are setting up: production with `--prod`, or the cloud dev
deployment after `npm run use:cloud`.

```bash
npm run auth:keys -- --prod
npx convex env set --prod AUTH_VERCEL_ID=<client id>
npx convex env set --prod AUTH_VERCEL_SECRET=<client secret>
npx convex env set --prod OWNER_EMAILS=<your Vercel account email>
npx convex env set --prod SITE_URL=https://<your app>.vercel.app
```

- `auth:keys` creates `JWT_PRIVATE_KEY` and `JWKS` if they are missing. It never enables test sign-in.
- `OWNER_EMAILS` is a comma-separated allowlist. With it unset, nobody can sign in.
- `SITE_URL` is where Convex Auth sends you back after Vercel. Use `http://localhost:5173` for cloud dev.
- Never set `AUTH_TEST_MODE` on a cloud deployment.

## 3. Check it

Open the app signed out: you should see only the sign-in screen. Sign in with Vercel, accept the
consent page, and you land on Home. Signing in with any other Vercel account, or with an email that
is not in `OWNER_EMAILS`, returns you to the sign-in screen with a "did not complete" message.

## On the iPhone

The PWA leaves for vercel.com and comes back to `SITE_URL`. If iOS opens the return trip in Safari
instead of the installed app, sign in once in Safari and then reopen the home-screen app. Check this
on the device after the first production deploy.
