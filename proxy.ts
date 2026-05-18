import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const MOBILE_UA = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i;

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname !== '/') return NextResponse.next();
  const ua = request.headers.get('user-agent') ?? '';
  if (!MOBILE_UA.test(ua)) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = '/calendar';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: '/',
};
