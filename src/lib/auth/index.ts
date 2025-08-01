import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// ============================================================================
// Types and Configuration
// ============================================================================

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  role: 'USER' | 'ADMIN';
  subscriptionTier: 'FREE' | 'PREMIUM' | 'FAMILY';
  emailVerified: boolean;
}

export interface AuthError {
  message: string;
  code: 'INVALID_CREDENTIALS' | 'USER_NOT_FOUND' | 'EMAIL_TAKEN' | 'USERNAME_TAKEN' | 'INVALID_TOKEN' | 'TOKEN_EXPIRED';
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key');
const TOKEN_EXPIRY = '7d';
const COOKIE_NAME = 'auth-token';

// ============================================================================
// JWT Token Management
// ============================================================================

export async function createToken(user: AuthUser): Promise<string> {
  return await new SignJWT({
    sub: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    
    // Get fresh user data from database
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.sub as string))
      .limit(1);

    if (userResult.length === 0) {
      return null;
    }

    const user = userResult[0];
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
      avatarUrl: user.avatarUrl || undefined,
      role: user.role || 'USER',
      subscriptionTier: user.subscriptionTier || 'FREE',
      emailVerified: user.emailVerified || false,
    };
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

// ============================================================================
// Cookie Management
// ============================================================================

export async function setAuthCookie(user: AuthUser): Promise<void> {
  const token = await createToken(user);
  const cookieStore = await cookies();
  
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    path: '/',
  });
}

export async function removeAuthCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getAuthCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value || null;
}

// ============================================================================
// User Authentication
// ============================================================================

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = await getAuthCookie();
  if (!token) {
    return null;
  }
  return await verifyToken(token);
}

export async function login(email: string, password: string): Promise<{ user: AuthUser } | { error: AuthError }> {
  try {
    // Find user by email
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (userResult.length === 0) {
      return {
        error: {
          message: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS',
        },
      };
    }

    const user = userResult[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return {
        error: {
          message: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS',
        },
      };
    }

    // Create auth user object
    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName || undefined,
      lastName: user.lastName || undefined,
      avatarUrl: user.avatarUrl || undefined,
      role: user.role || 'USER',
      subscriptionTier: user.subscriptionTier || 'FREE',
      emailVerified: user.emailVerified || false,
    };

    // Set auth cookie
    await setAuthCookie(authUser);

    return { user: authUser };
  } catch (error) {
    console.error('Login error:', error);
    return {
      error: {
        message: 'An error occurred during login',
        code: 'INVALID_CREDENTIALS',
      },
    };
  }
}

export async function register(data: {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
}): Promise<{ user: AuthUser } | { error: AuthError }> {
  try {
    const { email, username, password, firstName, lastName } = data;

    // Check if email already exists
    const existingEmailUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    if (existingEmailUser.length > 0) {
      return {
        error: {
          message: 'Email is already registered',
          code: 'EMAIL_TAKEN',
        },
      };
    }

    // Check if username already exists
    const existingUsernameUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username.toLowerCase()))
      .limit(1);

    if (existingUsernameUser.length > 0) {
      return {
        error: {
          message: 'Username is already taken',
          code: 'USERNAME_TAKEN',
        },
      };
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const newUserResult = await db
      .insert(users)
      .values({
        id: nanoid(),
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        firstName: firstName || null,
        lastName: lastName || null,
        passwordHash,
        emailVerified: false,
        twoFactorEnabled: false,
        subscriptionTier: 'FREE',
        role: 'USER',
      })
      .returning();

    if (newUserResult.length === 0) {
      throw new Error('Failed to create user');
    }

    const newUser = newUserResult[0];

    // Create auth user object
    const authUser: AuthUser = {
      id: newUser.id,
      email: newUser.email,
      username: newUser.username,
      firstName: newUser.firstName || undefined,
      lastName: newUser.lastName || undefined,
      avatarUrl: newUser.avatarUrl || undefined,
      role: newUser.role || 'USER',
      subscriptionTier: newUser.subscriptionTier || 'FREE',
      emailVerified: newUser.emailVerified || false,
    };

    // Set auth cookie
    await setAuthCookie(authUser);

    return { user: authUser };
  } catch (error) {
    console.error('Registration error:', error);
    return {
      error: {
        message: 'An error occurred during registration',
        code: 'INVALID_CREDENTIALS',
      },
    };
  }
}

export async function logout(): Promise<void> {
  await removeAuthCookie();
}

// ============================================================================
// Authorization Helpers
// ============================================================================

export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Authentication required');
  }
  return user;
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.role !== 'ADMIN') {
    throw new Error('Admin access required');
  }
  return user;
}

// ============================================================================
// Header Token Authentication (for API routes)
// ============================================================================

export async function verifyBearerToken(authHeader: string | null): Promise<AuthUser | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  return await verifyToken(token);
}

export async function createBearerToken(user: AuthUser): Promise<string> {
  return await createToken(user);
}