import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // 1. Check if the user is trying to access a Judge Route
  if (path.startsWith('/judge')) {
    // Extract the Judge ID from the URL (Format: /judge/[judgeId]/...)
    const pathParts = path.split('/'); // ["", "judge", "123", "dashboard"]
    const judgeId = pathParts[2];

    // If we have an ID, check for that specific judge's session cookie
    if (judgeId) {
      const sessionCookie = request.cookies.get(`ccms-judge-${judgeId}`);

      // If no cookie exists for THIS judge, kick them back to login
      if (!sessionCookie) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match dynamic judge routes
    '/judge/:path*',
  ],
};
