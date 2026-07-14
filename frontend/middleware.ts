import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/onboarding(.*)",
  "/api/tts(.*)",
  "/api/billing(.*)",
]);

// The Stripe webhook (/api/webhooks/stripe) is intentionally NOT protected:
// Stripe authenticates itself via the signed payload, not a Clerk session.
export default clerkMiddleware(async (auth, req) => {
  // CORS preflight: let it pass through so Next.js can return the headers
  // configured in next.config.ts without Clerk intercepting it.
  if (req.method === "OPTIONS" && req.nextUrl.pathname.startsWith("/api/extension-")) {
    return;
  }
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Run on everything except Next internals and static assets.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|mp3)).*)",
    "/(api|trpc)(.*)",
  ],
};
