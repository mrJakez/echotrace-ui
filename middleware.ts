import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function shouldSkip(pathname: string) {
  return (
    pathname.startsWith("/_next/static") ||
    pathname.startsWith("/_next/image") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.svg" ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".jpeg") ||
    pathname.endsWith(".gif") ||
    pathname.endsWith(".webp") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".js") ||
    pathname.endsWith(".map")
  );
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (shouldSkip(pathname)) {
    return NextResponse.next();
  }

  const startedAt = Date.now();
  const requestId = crypto.randomUUID().slice(0, 8);
  const url = `${pathname}${search}`;
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip = forwardedFor?.split(",")[0]?.trim() || realIp || "-";

  console.info(
    `[request] -> id=${requestId} method=${request.method} url="${url}" ip=${ip} ua="${request.headers.get("user-agent") ?? "-"}"`
  );

  const response = NextResponse.next();

  response.headers.set("x-echotrace-request-id", requestId);
  response.headers.set("x-echotrace-started-at", String(startedAt));

  console.info(`[request] <- id=${requestId} method=${request.method} url="${url}" status=${response.status}`);

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
