// Convex authentication configuration
// See: https://docs.convex.dev/auth/clerk

export default {
  providers: [
    {
      // Set CLERK_JWT_ISSUER_DOMAIN in Convex dashboard environment variables
      // Format: https://verb-noun-00.clerk.accounts.dev (dev) or https://clerk.yourdomain.com (prod)
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
}
