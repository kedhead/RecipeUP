import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Security check - only allow in development or with special header
  const debugKey = request.headers.get('x-debug-key');
  if (process.env.NODE_ENV === 'production' && debugKey !== 'debug-recipeup-2024') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    databaseUrlPrefix: process.env.DATABASE_URL?.substring(0, 20) + '...',
    hasJwtSecret: !!process.env.JWT_SECRET,
    jwtSecretLength: process.env.JWT_SECRET?.length || 0,
    hasSetupKey: !!process.env.SETUP_KEY,
    timestamp: new Date().toISOString(),
  });
}