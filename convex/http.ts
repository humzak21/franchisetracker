import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();

// /api/auth/* : OAuth redirects and callbacks for Sign in with Vercel, plus the JWKS.
auth.addHttpRoutes(http);

export default http;
