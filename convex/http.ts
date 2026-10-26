import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { targets, upload } from "./ingestion/shortcut";

const http = httpRouter();

// /api/auth/* : OAuth redirects and callbacks for Sign in with Vercel, plus the JWKS.
auth.addHttpRoutes(http);

// The Apple Shortcut (docs/SHORTCUT.md), authenticated by a bearer token from Settings.
http.route({ path: "/shortcut/targets", method: "GET", handler: targets });
http.route({ path: "/shortcut/upload", method: "POST", handler: upload });

export default http;
