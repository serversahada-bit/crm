import { NextRequest, NextResponse } from 'next/server';
import { decodeSession, SESSION_COOKIE } from '@/lib/session';

// Cek cepat (tanpa database): tanda tangan cookie valid & belum kedaluwarsa.
// Pengecekan lengkap ke database dilakukan di src/lib/auth.ts.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  // Halaman login selalu boleh dibuka; halaman itu sendiri yang mengalihkan user yang sudah login
  // (cookie bisa valid tapi akunnya sudah dinonaktifkan, jadi jangan dialihkan dari sini).
  if (pathname === '/login') return NextResponse.next();
  if (decodeSession(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Belum login' }, { status: 401 });
  }
  const url = new URL('/login', request.url);
  if (pathname !== '/') url.searchParams.set('next', pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
