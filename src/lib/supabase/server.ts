import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createBearerClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const BEARER_PATTERN = /^Bearer\s+(\S+)$/i;

/**
 * Server-side Supabase client for route handlers and server components.
 *
 * Browser requests authenticate from session cookies. Native clients (the iOS
 * app) hold a Supabase access token instead and send it as
 * `Authorization: Bearer <access_token>`. In that case the client acts as that
 * user: queries carry the user's JWT, so Row Level Security applies exactly as
 * it does for the web, and `auth.getUser()` validates the token with Supabase.
 * No service-role key is involved on either path.
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  }

  const requestHeaders = await headers();
  const bearerToken = BEARER_PATTERN.exec(requestHeaders.get("authorization") ?? "")?.[1];

  if (bearerToken) {
    return createBearerTokenClient(url, anonKey, bearerToken);
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server components cannot set cookies. Middleware/route handlers refresh them.
        }
      },
    },
  });
}

function createBearerTokenClient(url: string, anonKey: string, accessToken: string) {
  const client = createBearerClient<Database>(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  // There is no stored session behind a bearer client, so a bare `getUser()`
  // (what every route calls) would report "session missing". Point it at the
  // caller's token; Supabase still verifies the JWT server-side.
  const getUser = client.auth.getUser.bind(client.auth);
  client.auth.getUser = (jwt?: string) => getUser(jwt ?? accessToken);

  return client;
}
