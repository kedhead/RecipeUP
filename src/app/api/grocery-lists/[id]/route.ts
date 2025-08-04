import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../lib/db';
import { groceryLists, familyGroups, familyGroupMembers } from '../../../../lib/db/schema';
import { requireAuth } from '../../../../lib/auth';
import { eq, and } from 'drizzle-orm';

// ============================================================================
// Validation Schemas
// ============================================================================

const groceryItemSchema = z.object({
  name: z.string().min(1, 'Item name is required'),
  amount: z.string().default(''),
  unit: z.string().default(''),
  category: z.string().default('pantry'),
  checked: z.boolean().default(false),
  recipeSources: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

const additionalItemSchema = z.object({
  name: z.string().min(1, 'Item name is required'),
  category: z.string().default('other'),
  checked: z.boolean().default(false),
  notes: z.string().optional(),
});

const updateGroceryListSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  ingredients: z.array(groceryItemSchema).optional(),
  additionalItems: z.array(additionalItemSchema).optional(),
  status: z.enum(['active', 'completed']).optional(),
});

// ============================================================================
// GET /api/grocery-lists/[id] - Get specific grocery list
// ============================================================================

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const currentUser = await requireAuth();
    const { id } = params;

    // Get grocery list with family group info
    const [groceryListData] = await db
      .select({
        id: groceryLists.id,
        familyGroupId: groceryLists.familyGroupId,
        mealPlanId: groceryLists.mealPlanId,
        name: groceryLists.name,
        createdBy: groceryLists.createdBy,
        ingredients: groceryLists.ingredients,
        additionalItems: groceryLists.additionalItems,
        status: groceryLists.status,
        completedAt: groceryLists.completedAt,
        createdAt: groceryLists.createdAt,
        updatedAt: groceryLists.updatedAt,
        // Family group info
        familyGroupName: familyGroups.name,
      })
      .from(groceryLists)
      .innerJoin(familyGroups, eq(groceryLists.familyGroupId, familyGroups.id))
      .where(eq(groceryLists.id, id))
      .limit(1);

    if (!groceryListData) {
      return NextResponse.json(
        { error: 'Grocery list not found' },
        { status: 404 }
      );
    }

    // Check if user is a member of the family group
    const [membership] = await db
      .select({ role: familyGroupMembers.role })
      .from(familyGroupMembers)
      .where(
        and(
          eq(familyGroupMembers.familyGroupId, groceryListData.familyGroupId),
          eq(familyGroupMembers.userId, currentUser.id)
        )
      )
      .limit(1);

    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied to this grocery list' },
        { status: 403 }
      );
    }

    // Calculate completion stats
    const allItems = [
      ...(groceryListData.ingredients as any[] || []),
      ...(groceryListData.additionalItems as any[] || [])
    ];
    const checkedItems = allItems.filter(item => item.checked);

    return NextResponse.json({
      groceryList: {
        id: groceryListData.id,
        familyGroupId: groceryListData.familyGroupId,
        mealPlanId: groceryListData.mealPlanId,
        name: groceryListData.name,
        ingredients: groceryListData.ingredients,
        additionalItems: groceryListData.additionalItems,
        status: groceryListData.status,
        completedAt: groceryListData.completedAt,
        createdAt: groceryListData.createdAt,
        updatedAt: groceryListData.updatedAt,
        familyGroup: {
          id: groceryListData.familyGroupId,
          name: groceryListData.familyGroupName,
        },
        completionStats: {
          totalItems: allItems.length,
          checkedItems: checkedItems.length,
          percentageComplete: allItems.length > 0 ? Math.round((checkedItems.length / allItems.length) * 100) : 0,
        },
        isOwner: groceryListData.createdBy === currentUser.id,
      },
    });
  } catch (error) {
    console.error('Get grocery list error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT /api/grocery-lists/[id] - Update grocery list
// ============================================================================

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const currentUser = await requireAuth();
    const { id } = params;

    const body = await request.json();
    
    // Validate request body
    const validationResult = updateGroceryListSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    // Get grocery list to check family group membership
    const [existingList] = await db
      .select({
        id: groceryLists.id,
        familyGroupId: groceryLists.familyGroupId,
        createdBy: groceryLists.createdBy,
      })
      .from(groceryLists)
      .where(eq(groceryLists.id, id))
      .limit(1);

    if (!existingList) {
      return NextResponse.json(
        { error: 'Grocery list not found' },
        { status: 404 }
      );
    }

    // Check if user is a member of the family group
    const [membership] = await db
      .select({ role: familyGroupMembers.role })
      .from(familyGroupMembers)
      .where(
        and(
          eq(familyGroupMembers.familyGroupId, existingList.familyGroupId),
          eq(familyGroupMembers.userId, currentUser.id)
        )
      )
      .limit(1);

    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied to this grocery list' },
        { status: 403 }
      );
    }

    const updateData = validationResult.data;

    // Update grocery list
    const [updatedGroceryList] = await db
      .update(groceryLists)
      .set({
        ...(updateData.name && { name: updateData.name.trim() }),
        ...(updateData.ingredients && { ingredients: updateData.ingredients }),
        ...(updateData.additionalItems && { additionalItems: updateData.additionalItems }),
        ...(updateData.status && { 
          status: updateData.status,
          ...(updateData.status === 'completed' && { completedAt: new Date() })
        }),
        updatedAt: new Date(),
      })
      .where(eq(groceryLists.id, id))
      .returning();

    return NextResponse.json({
      message: 'Grocery list updated successfully',
      groceryList: updatedGroceryList,
    });
  } catch (error) {
    console.error('Update grocery list error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/grocery-lists/[id] - Delete grocery list
// ============================================================================

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const currentUser = await requireAuth();
    const { id } = params;

    // Get grocery list to check ownership
    const [existingList] = await db
      .select({
        id: groceryLists.id,
        familyGroupId: groceryLists.familyGroupId,
        createdBy: groceryLists.createdBy,
        name: groceryLists.name,
      })
      .from(groceryLists)
      .where(eq(groceryLists.id, id))
      .limit(1);

    if (!existingList) {
      return NextResponse.json(
        { error: 'Grocery list not found' },
        { status: 404 }
      );
    }

    // Check if user is a member of the family group
    const [membership] = await db
      .select({ role: familyGroupMembers.role })
      .from(familyGroupMembers)
      .where(
        and(
          eq(familyGroupMembers.familyGroupId, existingList.familyGroupId),
          eq(familyGroupMembers.userId, currentUser.id)
        )
      )
      .limit(1);

    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied to this grocery list' },
        { status: 403 }
      );
    }

    // Only the creator or family group admin can delete the grocery list
    const isOwner = existingList.createdBy === currentUser.id;
    const isAdmin = membership.role === 'admin';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Only the grocery list creator or family group admin can delete it' },
        { status: 403 }
      );
    }

    // Delete grocery list
    await db
      .delete(groceryLists)
      .where(eq(groceryLists.id, id));

    return NextResponse.json({
      message: 'Grocery list deleted successfully',
    });
  } catch (error) {
    console.error('Delete grocery list error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}