import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../lib/db';
import { familyGroups, familyGroupMembers, users } from '../../../../lib/db/schema';
import { requireAuth } from '../../../../lib/auth';
import { eq, and } from 'drizzle-orm';

// ============================================================================
// Validation Schema
// ============================================================================

const joinFamilyGroupSchema = z.object({
  inviteCode: z.string().min(1, 'Invite code is required').max(20, 'Invalid invite code'),
  nickname: z.string().max(50, 'Nickname is too long').optional(),
});

// ============================================================================
// POST /api/family-groups/join - Join family group with invite code
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireAuth();

    const body = await request.json();
    
    // Validate request body
    const validationResult = joinFamilyGroupSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { inviteCode, nickname } = validationResult.data;

    // Find family group by invite code
    const [familyGroup] = await db
      .select({
        id: familyGroups.id,
        name: familyGroups.name,
        description: familyGroups.description,
        settings: familyGroups.settings,
        createdBy: familyGroups.createdBy,
        // Creator info
        creatorUsername: users.username,
        creatorFirstName: users.firstName,
        creatorLastName: users.lastName,
      })
      .from(familyGroups)
      .leftJoin(users, eq(familyGroups.createdBy, users.id))
      .where(eq(familyGroups.inviteCode, inviteCode.toUpperCase()))
      .limit(1);

    if (!familyGroup) {
      return NextResponse.json(
        { error: 'Invalid invite code' },
        { status: 404 }
      );
    }

    // Check if user is already a member
    const [existingMembership] = await db
      .select({ id: familyGroupMembers.id })
      .from(familyGroupMembers)
      .where(
        and(
          eq(familyGroupMembers.familyGroupId, familyGroup.id),
          eq(familyGroupMembers.userId, currentUser.id)
        )
      )
      .limit(1);

    if (existingMembership) {
      return NextResponse.json(
        { error: 'You are already a member of this family group' },
        { status: 409 }
      );
    }

    // Check if member invites are allowed (unless joining your own group)
    const settings = familyGroup.settings as any;
    if (familyGroup.createdBy !== currentUser.id && !settings?.allowMemberInvites) {
      return NextResponse.json(
        { error: 'This family group is not accepting new members' },
        { status: 403 }
      );
    }

    // Add user as member
    const [newMembership] = await db
      .insert(familyGroupMembers)
      .values({
        familyGroupId: familyGroup.id,
        userId: currentUser.id,
        role: 'member',
        nickname: nickname?.trim() || null,
        invitedBy: familyGroup.createdBy, // For now, attribute to the creator
      })
      .returning();

    // Get member count
    const memberCount = await db
      .select({ count: eq(familyGroupMembers.familyGroupId, familyGroup.id) })
      .from(familyGroupMembers)
      .where(eq(familyGroupMembers.familyGroupId, familyGroup.id));

    return NextResponse.json({
      message: `Successfully joined "${familyGroup.name}"!`,
      familyGroup: {
        id: familyGroup.id,
        name: familyGroup.name,
        description: familyGroup.description,
        settings: familyGroup.settings,
        memberCount: memberCount.length,
        userRole: 'member',
        userNickname: newMembership.nickname,
        userJoinedAt: newMembership.joinedAt,
        isOwner: false,
        creator: {
          id: familyGroup.createdBy,
          username: familyGroup.creatorUsername,
          firstName: familyGroup.creatorFirstName,
          lastName: familyGroup.creatorLastName,
        },
      },
      membership: newMembership,
    });
  } catch (error) {
    console.error('Join family group error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}