import { NextResponse } from "next/server";
import { ROLE_COOKIE } from "@/lib/ontology/access";

/** Demo-only role switch so the access policy can be exercised. Remove when real auth is wired. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { role?: string };
  const role = body.role === "admin" ? "admin" : "analyst";
  const res = NextResponse.json({ role });
  res.cookies.set(ROLE_COOKIE, role, { httpOnly: true, sameSite: "lax", path: "/" });
  return res;
}
