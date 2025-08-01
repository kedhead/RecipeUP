import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { familyGroups, familyGroupMembers, users } from '@/lib/db/schema';
import { requireAuth, verifyBearerToken } from '@/lib/auth';
import { eq, and, ne } from 'drizzle-orm';

// ============================================================================
// Validation Schemas
// ============================================================================

const updateMemberSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  role: z.enum(['admin', 'member']).optional(),
  nickname: z.string().max(50, 'Nickname is too long').nullable().optional(),
});

const removeMemberSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

// ============================================================================
// GET /api/family-groups/[id]/members - Get family group members
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

    // Get all members with user details
    const members = await db
      .select({
        id: familyGroupMembers.id,
        userId: familyGroupMembers.userId,
        role: familyGroupMembers.role,
        nickname: familyGroupMembers.nickname,
        joinedAt: familyGroupMembers.joinedAt,
        invitedBy: familyGroupMembers.invitedBy,
        // User details
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        avatarUrl: users.avatarUrl,
        emailVerified: users.emailVerified,
      })
      .from(familyGroupMembers)
      .leftJoin(users, eq(familyGroupMembers.userId, users.id))
      .where(eq(familyGroupMembers.familyGroupId, id))
      .orderBy(familyGroupMembers.joinedAt);

    return NextResponse.json({
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
          emailVerified: member.emailVerified,
        },
        isCurrentUser: member.userId === currentUser.id,
        canManage: membership.role === 'admin' && member.userId !== currentUser.id,
      })),
      currentUserRole: membership.role,
    });
  } catch (error) {
    console.error('Get family group members error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT /api/family-groups/[id]/members - Update member
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
    const validationResult = updateMemberSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { userId, role, nickname } = validationResult.data;

    // Check if current user is an admin of this family group
    const [currentUserMembership] = await db
      .select({ role: familyGroupMembers.role })
      .from(familyGroupMembers)
      .where(
        and(
          eq(familyGroupMembers.familyGroupId, id),
          eq(familyGroupMembers.userId, currentUser.id)
        )
      )
      .limit(1);

    if (!currentUserMembership) {
      return NextResponse.json(
        { error: 'Family group not found' },
        { status: 404 }
      );
    }

    // Check if target member exists
    const [targetMembership] = await db
      .select({ id: familyGroupMembers.id, role: familyGroupMembers.role })
      .from(familyGroupMembers)
      .where(
        and(
          eq(familyGroupMembers.familyGroupId, id),
          eq(familyGroupMembers.userId, userId)
        )
      )
      .limit(1);

    if (!targetMembership) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Permission checks
    if (userId === currentUser.id) {
      // Users can only update their own nickname
      if (role !== undefined) {
        return NextResponse.json(
          { error: 'You cannot change your own role' },
          { status: 403 }
        );
      }
    } else {
      // Only admins can update other members
      if (currentUserMembership.role !== 'admin') {
        return NextResponse.json(
          { error: 'Only admins can update other members' },
          { status: 403 }
        );
      }
    }

    // Build update object
    const updates: any = {};
    
    if (role !== undefined) {
      updates.role = role;
    }
    
    if (nickname !== undefined) {
      updates.nickname = nickname?.trim() || null;
    }

    // Update member
    const [updatedMember] = await db
      .update(familyGroupMembers)
      .set(updates)
      .where(
        and(
          eq(familyGroupMembers.familyGroupId, id),
          eq(familyGroupMembers.userId, userId)
        )
      )
      .returning();

    return NextResponse.json({
      message: 'Member updated successfully',
      member: updatedMember,
    });
  } catch (error) {
    console.error('Update family group member error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/family-groups/[id]/members - Remove member
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const currentUser = await requireAuth();

    const body = await request.json();
    
    // Validate request body
    const validationResult = removeMemberSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { userId } = validationResult.data;

    // Get family group and current user's membership
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

    const [currentUserMembership] = await db
      .select({ role: familyGroupMembers.role })
      .from(familyGroupMembers)
      .where(
        and(
          eq(familyGroupMembers.familyGroupId, id),
          eq(familyGroupMembers.userId, currentUser.id)
        )
      )
      .limit(1);

    if (!currentUserMembership) {
      return NextResponse.json(
        { error: 'Family group not found' },
        { status: 404 }
      );
    }

    // Check if target member exists
    const [targetMembership] = await db
      .select({ id: familyGroupMembers.id, role: familyGroupMembers.role })
      .from(familyGroupMembers)
      .where(
        and(
          eq(familyGroupMembers.familyGroupId, id),
          eq(familyGroupMembers.userId, userId)
        )
      )
      .limit(1);

    if (!targetMembership) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Permission checks
    if (userId === currentUser.id) {
      // Users can leave the group themselves (unless they're the owner)
      if (familyGroup.createdBy === currentUser.id) {
        return NextResponse.json(
          { error: 'Group owners cannot leave their own group. Delete the group instead.' },
          { status: 403 }
        );
      }
    } else {
      // Only admins can remove other members
      if (currentUserMembership.role !== 'admin') {
        return NextResponse.json(
          { error: 'Only admins can remove other members' },
          { status: 403 }
        );
      }

      // Cannot remove the group owner
      if (userId === familyGroup.createdBy) {
        return NextResponse.json(
          { error: 'Cannot remove the group owner' },
          { status: 403 }
        );
      }
    }

    // Remove member
    await db
      .delete(familyGroupMembers)
      .where(
        and(
          eq(familyGroupMembers.familyGroupId, id),
          eq(familyGroupMembers.userId, userId)
        )
      );

    const action = userId === currentUser.id ? 'left' : 'removed from';
    return NextResponse.json({
      message: `Member ${action} family group successfully`,
    });
  } catch (error) {
    console.error('Remove family group member error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}