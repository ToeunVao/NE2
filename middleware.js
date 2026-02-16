import { NextResponse } from 'next/server';

export async function middleware(request) {
  const session = request.cookies.get('session'); // Or however you store your auth token
  const { pathname } = request.nextUrl;

  // If a non-admin tries to access /admin
  if (pathname.startsWith('/admin')) {
    // You would typically verify the Firebase custom claim or role here
    // For a quick fix at the page level, see Step 2
  }

  return NextResponse.next();
}