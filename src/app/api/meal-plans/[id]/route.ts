import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../lib/db';
import { mealPlans, familyGroups, familyGroupMembers, users } from '../../../../lib/db/schema';
import { requireAuth } from '../../../../lib/auth';
import { eq, and } from 'drizzle-orm';

// ============================================================================
// Validation Schemas
// ============================================================================

const mealSchema = z.object({
  recipeId: z.string().optional(),
  recipeName: z.string().optional(),
  notes: z.string().optional(),
  servings: z.number().positive().optional(),
});

const updateMealPlanSchema = z.object({
  name: z.string().min(1, 'Meal plan name is required').max(100, 'Name is too long').optional(),
  meals: z.record(
    z.string(), // day (monday, tuesday, etc.)
    z.record(
      z.string(), // meal type (breakfast, lunch, dinner, snack)
      mealSchema
    )
  ).optional(),
  notes: z.string().max(1000, 'Notes are too long').optional(),
  isActive: z.boolean().optional(),
});

// ============================================================================
// GET /api/meal-plans/[id] - Get specific meal plan
// ============================================================================

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const currentUser = await requireAuth();
    const { id } = params;

    // Get meal plan with family group and creator info
    const [mealPlanData] = await db
      .select({
        id: mealPlans.id,
        familyGroupId: mealPlans.familyGroupId,
        name: mealPlans.name,
        createdBy: mealPlans.createdBy,
        weekStartDate: mealPlans.weekStartDate,
        weekEndDate: mealPlans.weekEndDate,
        meals: mealPlans.meals,
        notes: mealPlans.notes,
        isActive: mealPlans.isActive,
        createdAt: mealPlans.createdAt,
        updatedAt: mealPlans.updatedAt,
        // Family group info
        familyGroupName: familyGroups.name,
        // Creator info
        creatorUsername: users.username,
        creatorFirstName: users.firstName,
        creatorLastName: users.lastName,
      })
      .from(mealPlans)
      .innerJoin(familyGroups, eq(mealPlans.familyGroupId, familyGroups.id))
      .leftJoin(users, eq(mealPlans.createdBy, users.id))
      .where(eq(mealPlans.id, id))
      .limit(1);

    if (!mealPlanData) {
      return NextResponse.json(
        { error: 'Meal plan not found' },
        { status: 404 }
      );
    }

    // Check if user is a member of the family group
    const [membership] = await db
      .select({ role: familyGroupMembers.role })
      .from(familyGroupMembers)
      .where(
        and(
          eq(familyGroupMembers.familyGroupId, mealPlanData.familyGroupId),
          eq(familyGroupMembers.userId, currentUser.id)
        )
      )
      .limit(1);

    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied to this meal plan' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      mealPlan: {
        id: mealPlanData.id,
        familyGroupId: mealPlanData.familyGroupId,
        name: mealPlanData.name,
        weekStartDate: mealPlanData.weekStartDate,
        weekEndDate: mealPlanData.weekEndDate,
        meals: mealPlanData.meals,
        notes: mealPlanData.notes,
        isActive: mealPlanData.isActive,
        createdAt: mealPlanData.createdAt,
        updatedAt: mealPlanData.updatedAt,
        familyGroup: {
          id: mealPlanData.familyGroupId,
          name: mealPlanData.familyGroupName,
        },
        creator: {
          id: mealPlanData.createdBy,
          username: mealPlanData.creatorUsername,
          firstName: mealPlanData.creatorFirstName,
          lastName: mealPlanData.creatorLastName,
        },
        isOwner: mealPlanData.createdBy === currentUser.id,
      },
    });
  } catch (error) {
    console.error('Get meal plan error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT /api/meal-plans/[id] - Update meal plan
// ============================================================================

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const currentUser = await requireAuth();
    const { id } = params;

    const body = await request.json();
    
    // Validate request body
    const validationResult = updateMealPlanSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    // Get meal plan to check ownership and family group membership
    const [existingPlan] = await db
      .select({
        id: mealPlans.id,
        familyGroupId: mealPlans.familyGroupId,
        createdBy: mealPlans.createdBy,
      })
      .from(mealPlans)
      .where(eq(mealPlans.id, id))
      .limit(1);

    if (!existingPlan) {
      return NextResponse.json(
        { error: 'Meal plan not found' },
        { status: 404 }
      );
    }

    // Check if user is a member of the family group
    const [membership] = await db
      .select({ role: familyGroupMembers.role })
      .from(familyGroupMembers)
      .where(
        and(
          eq(familyGroupMembers.familyGroupId, existingPlan.familyGroupId),
          eq(familyGroupMembers.userId, currentUser.id)
        )
      )
      .limit(1);

    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied to this meal plan' },
        { status: 403 }
      );
    }

    // Only the creator can update the meal plan (for now)
    if (existingPlan.createdBy !== currentUser.id) {
      return NextResponse.json(
        { error: 'Only the meal plan creator can edit it' },
        { status: 403 }
      );
    }

    const updateData = validationResult.data;

    // Update meal plan
    const [updatedMealPlan] = await db
      .update(mealPlans)
      .set({
        ...(updateData.name && { name: updateData.name.trim() }),
        ...(updateData.meals && { meals: updateData.meals }),
        ...(updateData.notes !== undefined && { notes: updateData.notes?.trim() || null }),
        ...(updateData.isActive !== undefined && { isActive: updateData.isActive }),
        updatedAt: new Date(),
      })
      .where(eq(mealPlans.id, id))
      .returning();

    return NextResponse.json({
      message: 'Meal plan updated successfully',
      mealPlan: updatedMealPlan,
    });
  } catch (error) {
    console.error('Update meal plan error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/meal-plans/[id] - Delete meal plan
// ============================================================================

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const currentUser = await requireAuth();
    const { id } = params;

    // Get meal plan to check ownership
    const [existingPlan] = await db
      .select({
        id: mealPlans.id,
        familyGroupId: mealPlans.familyGroupId,
        createdBy: mealPlans.createdBy,
        name: mealPlans.name,
      })
      .from(mealPlans)
      .where(eq(mealPlans.id, id))
      .limit(1);

    if (!existingPlan) {
      return NextResponse.json(
        { error: 'Meal plan not found' },
        { status: 404 }
      );
    }

    // Check if user is a member of the family group
    const [membership] = await db
      .select({ role: familyGroupMembers.role })
      .from(familyGroupMembers)
      .where(
        and(
          eq(familyGroupMembers.familyGroupId, existingPlan.familyGroupId),
          eq(familyGroupMembers.userId, currentUser.id)
        )
      )
      .limit(1);

    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied to this meal plan' },
        { status: 403 }
      );
    }

    // Only the creator or family group admin can delete the meal plan
    const isOwner = existingPlan.createdBy === currentUser.id;
    const isAdmin = membership.role === 'admin';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Only the meal plan creator or family group admin can delete it' },
        { status: 403 }
      );
    }

    // Delete meal plan
    await db
      .delete(mealPlans)
      .where(eq(mealPlans.id, id));

    return NextResponse.json({
      message: 'Meal plan deleted successfully',
    });
  } catch (error) {
    console.error('Delete meal plan error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}