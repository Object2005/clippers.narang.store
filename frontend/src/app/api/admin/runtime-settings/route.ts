import { NextResponse } from "next/server";

import { createTextProxyResponse, fetchBackend } from "@/server/backend-api";
import { getServerSession } from "@/server/session";

async function requireAdmin() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const userEmail = session.user.email || "";
  const isHead = userEmail === "narangaashray98@gmail.com" || userEmail === "narangaashray98@gamil.com";
  const isAdmin = Boolean((session.user as { is_admin?: boolean }).is_admin) && isHead;
  if (!isAdmin) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { session };
}

export async function GET() {
  const adminCheck = await requireAdmin();
  if (adminCheck.error) {
    return adminCheck.error;
  }

  const upstream = await fetchBackend("/admin/runtime-settings", {
    method: "GET",
    userId: adminCheck.session.user.id,
    cache: "no-store",
  });

  return createTextProxyResponse(upstream);
}

export async function PATCH(request: Request) {
  const adminCheck = await requireAdmin();
  if (adminCheck.error) {
    return adminCheck.error;
  }

  const body = await request.text();
  const upstream = await fetchBackend("/admin/runtime-settings", {
    method: "PATCH",
    userId: adminCheck.session.user.id,
    extraHeaders: { "Content-Type": "application/json" },
    body,
    cache: "no-store",
  });

  return createTextProxyResponse(upstream);
}
