import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { login } from '@/lib/auth';

// ============================================================================
// Validation Schema
// ============================================================================

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

// ============================================================================
// POST /api/auth/login
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validationResult = loginSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { email, password } = validationResult.data;

    // Attempt login
    const result = await login(email, password);

    if ('error' in result) {
      return NextResponse.json(
        { error: result.error.message },
        { status: 401 }
      );
    }

    // Return success response
    return NextResponse.json({
      message: 'Login successful',
      user: {
        id: result.user.id,
        email: result.user.email,
        username: result.user.username,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        avatarUrl: result.user.avatarUrl,
        role: result.user.role,
        subscriptionTier: result.user.subscriptionTier,
        emailVerified: result.user.emailVerified,
      },
    });
  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}