// Convex validates the JWTs that Convex Auth itself issues (signed with JWT_PRIVATE_KEY).
// Without this file every request is silently anonymous.
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
