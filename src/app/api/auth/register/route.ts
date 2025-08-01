import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { register } from '@/lib/auth';

// ============================================================================
// Validation Schema
// ============================================================================

const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be less than 20 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, hyphens, and underscores'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

// ============================================================================
// POST /api/auth/register
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validationResult = registerSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { email, username, password, firstName, lastName } = validationResult.data;

    // Attempt registration
    const result = await register({
      email,
      username,
      password,
      firstName,
      lastName,
    });

    if ('error' in result) {
      const statusCode = result.error.code === 'EMAIL_TAKEN' || result.error.code === 'USERNAME_TAKEN' ? 409 : 400;
      return NextResponse.json(
        { error: result.error.message },
        { status: statusCode }
      );
    }

    // Return success response
    return NextResponse.json(
      {
        message: 'Registration successful',
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
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}