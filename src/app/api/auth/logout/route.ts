import { NextRequest, NextResponse } from 'next/server';
import { logout } from '@/lib/auth';

// ============================================================================
// POST /api/auth/logout
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Clear the auth cookie
    await logout();

    return NextResponse.json({
      message: 'Logout successful',
    });
  } catch (error) {
    console.error('Logout API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}