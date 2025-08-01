import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { familyGroups, familyGroupMembers, users } from '@/lib/db/schema';
import { requireAuth, verifyBearerToken } from '@/lib/auth';
import { eq, and, sql, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// ============================================================================
// Validation Schemas
// ============================================================================

const createFamilyGroupSchema = z.object({
  name: z.string().min(1, 'Family group name is required').max(100, 'Name is too long'),
  description: z.string().max(500, 'Description is too long').optional(),
  settings: z.object({
    mealPlanVisibility: z.enum(['family_only', 'public']).default('family_only'),
    recipeSharing: z.boolean().default(true),
    groceryListSharing: z.boolean().default(true),
    allowMemberInvites: z.boolean().default(true),
  }).optional(),
});

// ============================================================================
// Helper Functions
// ============================================================================

function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ============================================================================
// GET /api/family-groups - Get user's family groups
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Get current user
    const authHeader = request.headers.get('authorization');
    const currentUser = authHeader ? await verifyBearerToken(authHeader) : null;
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get family groups the user belongs to with member counts
    const familyGroupsQuery = db
      .select({
        id: familyGroups.id,
        name: familyGroups.name,
        description: familyGroups.description,
        inviteCode: familyGroups.inviteCode,
        createdBy: familyGroups.createdBy,
        settings: familyGroups.settings,
        createdAt: familyGroups.createdAt,
        updatedAt: familyGroups.updatedAt,
        // User's role in this group
        userRole: familyGroupMembers.role,
        userNickname: familyGroupMembers.nickname,
        userJoinedAt: familyGroupMembers.joinedAt,
        // Member count
        memberCount: sql<number>`(
          SELECT COUNT(*) FROM ${familyGroupMembers} 
          WHERE ${familyGroupMembers.familyGroupId} = ${familyGroups.id}
        )`.as('member_count'),
        // Creator info
        creatorUsername: users.username,
        creatorFirstName: users.firstName,
        creatorLastName: users.lastName,
      })
      .from(familyGroups)
      .innerJoin(
        familyGroupMembers,
        and(
          eq(familyGroupMembers.familyGroupId, familyGroups.id),
          eq(familyGroupMembers.userId, currentUser.id)
        )
      )
      .leftJoin(users, eq(familyGroups.createdBy, users.id))
      .orderBy(desc(familyGroups.updatedAt));

    const userFamilyGroups = await familyGroupsQuery;

    return NextResponse.json({
      familyGroups: userFamilyGroups.map(group => ({
        id: group.id,
        name: group.name,
        description: group.description,
        inviteCode: group.inviteCode,
        settings: group.settings,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
        memberCount: Number(group.memberCount),
        userRole: group.userRole,
        userNickname: group.userNickname,
        userJoinedAt: group.userJoinedAt,
        creator: {
          id: group.createdBy,
          username: group.creatorUsername,
          firstName: group.creatorFirstName,
          lastName: group.creatorLastName,
        },
        isOwner: group.createdBy === currentUser.id,
      })),
    });
  } catch (error) {
    console.error('Get family groups error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/family-groups - Create new family group
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireAuth();

    const body = await request.json();
    
    // Validate request body
    const validationResult = createFamilyGroupSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { name, description, settings } = validationResult.data;

    // Generate unique invite code
    let inviteCode = generateInviteCode();
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const [existingGroup] = await db
        .select({ id: familyGroups.id })
        .from(familyGroups)
        .where(eq(familyGroups.inviteCode, inviteCode))
        .limit(1);

      if (!existingGroup) {
        break; // Code is unique
      }
      
      inviteCode = generateInviteCode();
      attempts++;
    }

    if (attempts >= maxAttempts) {
      return NextResponse.json(
        { error: 'Failed to generate unique invite code' },
        { status: 500 }
      );
    }

    // Create family group
    const [newFamilyGroup] = await db
      .insert(familyGroups)
      .values({
        name: name.trim(),
        description: description?.trim() || null,
        inviteCode,
        createdBy: currentUser.id,
        settings: settings || {
          mealPlanVisibility: 'family_only',
          recipeSharing: true,
          groceryListSharing: true,
          allowMemberInvites: true,
        },
      })
      .returning();

    // Add creator as admin member
    await db
      .insert(familyGroupMembers)
      .values({
        familyGroupId: newFamilyGroup.id,
        userId: currentUser.id,
        role: 'admin',
        invitedBy: currentUser.id,
      });

    return NextResponse.json(
      {
        message: 'Family group created successfully',
        familyGroup: {
          ...newFamilyGroup,
          memberCount: 1,
          userRole: 'admin',
          userNickname: null,
          isOwner: true,
          creator: {
            id: currentUser.id,
            username: currentUser.username,
            firstName: currentUser.firstName,
            lastName: currentUser.lastName,
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create family group error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}