import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Handles the email-confirmation / magic-link return trip from Supabase
 * Auth. With auto-confirmed accounts created in the dashboard this route
 * is rarely used, but it is here so confirmation links work. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
