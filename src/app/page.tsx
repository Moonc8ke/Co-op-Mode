import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CouplesApp from "@/components/CouplesApp";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <CouplesApp userEmail={user.email ?? "you"} />;
}
