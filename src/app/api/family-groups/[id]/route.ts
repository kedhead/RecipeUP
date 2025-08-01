import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { familyGroups, familyGroupMembers, users } from '@/lib/db/schema';
import { requireAuth, verifyBearerToken } from '@/lib/auth';
import { eq, and, sql } from 'drizzle-orm';

// ============================================================================
// Validation Schemas
// ============================================================================

const updateFamilyGroupSchema = z.object({
  name: z.string().min(1, 'Family group name is required').max(100, 'Name is too long').optional(),
  description: z.string().max(500, 'Description is too long').nullable().optional(),
  settings: z.object({
    mealPlanVisibility: z.enum(['family_only', 'public']).optional(),
    recipeSharing: z.boolean().optional(),
    groceryListSharing: z.boolean().optional(),
    allowMemberInvites: z.boolean().optional(),
  }).optional(),
});

// ============================================================================
// GET /api/family-groups/[id] - Get family group details
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    // Get current user
    const authHeader = request.headers.get('authorization');
    const currentUser = authHeader ? await verifyBearerToken(authHeader) : null;
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user is a member of this family group
    const [membership] = await db
      .select({
        role: familyGroupMembers.role,
        nickname: familyGroupMembers.nickname,
        joinedAt: familyGroupMembers.joinedAt,
      })
      .from(familyGroupMembers)
      .where(
        and(
          eq(familyGroupMembers.familyGroupId, id),
          eq(familyGroupMembers.userId, currentUser.id)
        )
      )
      .limit(1);

    if (!membership) {
      return NextResponse.json(
        { error: 'Family group not found' },
        { status: 404 }
      );
    }

    // Get family group details
    const [familyGroup] = await db
      .select({
        id: familyGroups.id,
        name: familyGroups.name,
        description: familyGroups.description,
        inviteCode: familyGroups.inviteCode,
        createdBy: familyGroups.createdBy,
        settings: familyGroups.settings,
        createdAt: familyGroups.createdAt,
        updatedAt: familyGroups.updatedAt,
        // Creator info
        creatorUsername: users.username,
        creatorFirstName: users.firstName,
        creatorLastName: users.lastName,
        creatorAvatarUrl: users.avatarUrl,
      })
      .from(familyGroups)
      .leftJoin(users, eq(familyGroups.createdBy, users.id))
      .where(eq(familyGroups.id, id))
      .limit(1);

    if (!familyGroup) {
      return NextResponse.json(
        { error: 'Family group not found' },
        { status: 404 }
      );
    }

    // Get all members
    const members = await db
      .select({
        id: familyGroupMembers.id,
        userId: familyGroupMembers.userId,
        role: familyGroupMembers.role,
        nickname: familyGroupMembers.nickname,
        joinedAt: familyGroupMembers.joinedAt,
        invitedBy: familyGroupMembers.invitedBy,
        // Member user info
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        avatarUrl: users.avatarUrl,
      })
      .from(familyGroupMembers)
      .leftJoin(users, eq(familyGroupMembers.userId, users.id))
      .where(eq(familyGroupMembers.familyGroupId, id))
      .orderBy(familyGroupMembers.joinedAt);

    return NextResponse.json({
      familyGroup: {
        ...familyGroup,
        memberCount: members.length,
        userRole: membership.role,
        userNickname: membership.nickname,
        userJoinedAt: membership.joinedAt,
        isOwner: familyGroup.createdBy === currentUser.id,
        creator: {
          id: familyGroup.createdBy,
          username: familyGroup.creatorUsername,
          firstName: familyGroup.creatorFirstName,
          lastName: familyGroup.creatorLastName,
          avatarUrl: familyGroup.creatorAvatarUrl,
        },
        members: members.map(member => ({
          id: member.id,
          userId: member.userId,
          role: member.role,
          nickname: member.nickname,
          joinedAt: member.joinedAt,
          invitedBy: member.invitedBy,
          user: {
            username: member.username,
            firstName: member.firstName,
            lastName: member.lastName,
            avatarUrl: member.avatarUrl,
          },
          isCurrentUser: member.userId === currentUser.id,
        })),
      },
    });
  } catch (error) {
    console.error('Get family group error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT /api/family-groups/[id] - Update family group
// ============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const currentUser = await requireAuth();

    const body = await request.json();
    
    // Validate request body
    const validationResult = updateFamilyGroupSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    // Check if user is an admin of this family group
    const [membership] = await db
      .select({ role: familyGroupMembers.role })
      .from(familyGroupMembers)
      .where(
        and(
          eq(familyGroupMembers.familyGroupId, id),
          eq(familyGroupMembers.userId, currentUser.id)
        )
      )
      .limit(1);

    if (!membership) {
      return NextResponse.json(
        { error: 'Family group not found' },
        { status: 404 }
      );
    }

    if (membership.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only admins can update family group settings' },
        { status: 403 }
      );
    }

    const updateData = validationResult.data;

    // Build update object
    const updates: any = {
      updatedAt: new Date(),
    };

    if (updateData.name !== undefined) {
      updates.name = updateData.name.trim();
    }

    if (updateData.description !== undefined) {
      updates.description = updateData.description?.trim() || null;
    }

    if (updateData.settings !== undefined) {
      // Get current settings and merge with updates
      const [currentGroup] = await db
        .select({ settings: familyGroups.settings })
        .from(familyGroups)
        .where(eq(familyGroups.id, id))
        .limit(1);

      const currentSettings = currentGroup?.settings as any || {};
      updates.settings = {
        ...currentSettings,
        ...updateData.settings,
      };
    }

    // Update family group
    const [updatedGroup] = await db
      .update(familyGroups)
      .set(updates)
      .where(eq(familyGroups.id, id))
      .returning();

    return NextResponse.json({
      message: 'Family group updated successfully',
      familyGroup: updatedGroup,
    });
  } catch (error) {
    console.error('Update family group error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/family-groups/[id] - Delete family group
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const currentUser = await requireAuth();

    // Check if user is the owner of this family group
    const [familyGroup] = await db
      .select({ 
        id: familyGroups.id,
        createdBy: familyGroups.createdBy,
        name: familyGroups.name,
      })
      .from(familyGroups)
      .where(eq(familyGroups.id, id))
      .limit(1);

    if (!familyGroup) {
      return NextResponse.json(
        { error: 'Family group not found' },
        { status: 404 }
      );
    }

    if (familyGroup.createdBy !== currentUser.id) {
      return NextResponse.json(
        { error: 'Only the family group owner can delete it' },
        { status: 403 }
      );
    }

    // Delete family group (this will cascade to members, meal plans, etc.)
    await db
      .delete(familyGroups)
      .where(eq(familyGroups.id, id));

    return NextResponse.json({
      message: 'Family group deleted successfully',
    });
  } catch (error) {
    console.error('Delete family group error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}