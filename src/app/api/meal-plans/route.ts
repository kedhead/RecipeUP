import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../lib/db';
import { mealPlans, familyGroups, familyGroupMembers, users } from '../../../lib/db/schema';
import { requireAuth, verifyBearerToken } from '../../../lib/auth';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import { startOfWeek, endOfWeek, format } from 'date-fns';

// ============================================================================
// Validation Schemas
// ============================================================================

const mealSchema = z.object({
  recipeId: z.string().optional(),
  recipeName: z.string().optional(),
  notes: z.string().optional(),
  servings: z.number().positive().optional(),
});

const createMealPlanSchema = z.object({
  familyGroupId: z.string().min(1, 'Family group ID is required'),
  name: z.string().min(1, 'Meal plan name is required').max(100, 'Name is too long'),
  weekStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  meals: z.record(
    z.string(), // day (monday, tuesday, etc.)
    z.record(
      z.string(), // meal type (breakfast, lunch, dinner, snack)
      mealSchema
    )
  ).default({}),
  notes: z.string().max(1000, 'Notes are too long').optional(),
});

// ============================================================================
// GET /api/meal-plans - Get meal plans
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

    const { searchParams } = new URL(request.url);
    const familyGroupId = searchParams.get('family_group_id');
    const isActive = searchParams.get('active') === 'true';
    const weekStart = searchParams.get('week_start'); // YYYY-MM-DD format
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build all filter conditions upfront
    const whereConditions = [];
    
    if (familyGroupId) {
      whereConditions.push(eq(mealPlans.familyGroupId, familyGroupId));
    }

    if (isActive) {
      whereConditions.push(eq(mealPlans.isActive, true));
    }

    if (weekStart) {
      // Get meal plans for the specified week
      const startDate = new Date(weekStart);
      const endDate = endOfWeek(startDate);
      whereConditions.push(
        and(
          gte(mealPlans.weekStartDate, format(startDate, 'yyyy-MM-dd')),
          lte(mealPlans.weekStartDate, format(endDate, 'yyyy-MM-dd'))
        )
      );
    }

    // Build complete query - only meal plans from family groups the user belongs to
    const query = db
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
      .innerJoin(
        familyGroupMembers,
        and(
          eq(familyGroupMembers.familyGroupId, familyGroups.id),
          eq(familyGroupMembers.userId, currentUser.id)
        )
      )
      .leftJoin(users, eq(mealPlans.createdBy, users.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(mealPlans.weekStartDate), desc(mealPlans.createdAt))
      .limit(limit)
      .offset(offset);

    const userMealPlans = await query;

    return NextResponse.json({
      mealPlans: userMealPlans.map(plan => ({
        id: plan.id,
        familyGroupId: plan.familyGroupId,
        name: plan.name,
        weekStartDate: plan.weekStartDate,
        weekEndDate: plan.weekEndDate,
        meals: plan.meals,
        notes: plan.notes,
        isActive: plan.isActive,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
        familyGroup: {
          id: plan.familyGroupId,
          name: plan.familyGroupName,
        },
        creator: {
          id: plan.createdBy,
          username: plan.creatorUsername,
          firstName: plan.creatorFirstName,
          lastName: plan.creatorLastName,
        },
        isOwner: plan.createdBy === currentUser.id,
      })),
      pagination: {
        limit,
        offset,
        hasMore: userMealPlans.length === limit,
      },
    });
  } catch (error) {
    console.error('Get meal plans error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/meal-plans - Create meal plan
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireAuth();

    const body = await request.json();
    
    // Validate request body
    const validationResult = createMealPlanSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { familyGroupId, name, weekStartDate, meals, notes } = validationResult.data;

    // Check if user is a member of the family group
    const [membership] = await db
      .select({ role: familyGroupMembers.role })
      .from(familyGroupMembers)
      .where(
        and(
          eq(familyGroupMembers.familyGroupId, familyGroupId),
          eq(familyGroupMembers.userId, currentUser.id)
        )
      )
      .limit(1);

    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied to family group' },
        { status: 403 }
      );
    }

    // Calculate week end date
    const startDate = new Date(weekStartDate);
    const weekEnd = endOfWeek(startDate);
    const weekEndDate = format(weekEnd, 'yyyy-MM-dd');

    // Check if there's already an active meal plan for this week in this family group
    const [existingPlan] = await db
      .select({ id: mealPlans.id, name: mealPlans.name })
      .from(mealPlans)
      .where(
        and(
          eq(mealPlans.familyGroupId, familyGroupId),
          eq(mealPlans.weekStartDate, weekStartDate),
          eq(mealPlans.isActive, true)
        )
      )
      .limit(1);

    if (existingPlan) {
      return NextResponse.json(
        { 
          error: `An active meal plan already exists for this week: "${existingPlan.name}". Deactivate it first or create an inactive plan.`,
        },
        { status: 409 }
      );
    }

    // Create meal plan
    const [newMealPlan] = await db
      .insert(mealPlans)
      .values({
        familyGroupId,
        name: name.trim(),
        createdBy: currentUser.id,
        weekStartDate,
        weekEndDate,
        meals,
        notes: notes?.trim() || null,
        isActive: true,
      })
      .returning();

    return NextResponse.json(
      {
        message: 'Meal plan created successfully',
        mealPlan: newMealPlan,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create meal plan error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}