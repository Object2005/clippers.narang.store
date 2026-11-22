import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  try {
    const user = await prisma.user.findFirst({
      where: { email },
      select: { id: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ url: null });
    }

    // Find the latest active verification token for password reset
    const now = new Date();
    const tokenRecord = await prisma.verification.findFirst({
      where: {
        value: user.id,
        identifier: {
          startsWith: "reset-password:",
        },
        expiresAt: {
          gt: now,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!tokenRecord) {
      return NextResponse.json({ url: null });
    }

    const token = tokenRecord.identifier.replace("reset-password:", "");
    return NextResponse.json({
      url: `/reset-password?token=${token}`,
      token,
      expiresAt: tokenRecord.expiresAt,
    });
  } catch (err: unknown) {
    console.error("Failed to retrieve reset link:", err);
    return NextResponse.json({ url: null });
  }
}
