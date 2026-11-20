import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  const { data: isAdmin, error: adminError } =
    await supabase.rpc("is_platform_admin");

  if (adminError || isAdmin !== true) {
    return NextResponse.json(
      { error: "Platform admin access required." },
      { status: 403 }
    );
  }

  const [dashboard, workspaces] = await Promise.all([
    supabase.rpc("platform_admin_dashboard"),
    supabase.rpc("platform_admin_workspaces"),
  ]);

  if (dashboard.error || workspaces.error) {
    return NextResponse.json(
      { error: "Unable to load platform administration data." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    dashboard: dashboard.data,
    workspaces: workspaces.data,
  });
}
