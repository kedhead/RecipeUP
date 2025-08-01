import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { groceryLists, familyGroups, familyGroupMembers, mealPlans, recipes, users } from '@/lib/db/schema';
import { requireAuth, verifyBearerToken } from '@/lib/auth';
import { eq, and, desc, inArray } from 'drizzle-orm';

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

const createGroceryListSchema = z.object({
  familyGroupId: z.string().min(1, 'Family group ID is required'),
  mealPlanId: z.string().optional(),
  name: z.string().min(1, 'Grocery list name is required').max(100, 'Name is too long'),
  ingredients: z.array(groceryItemSchema).default([]),
  additionalItems: z.array(additionalItemSchema).default([]),
});

// ============================================================================
// Helper Functions
// ============================================================================

function categorizeIngredient(name: string): string {
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes('milk') || lowerName.includes('cheese') || lowerName.includes('yogurt') || lowerName.includes('butter')) {
    return 'dairy';
  }
  if (lowerName.includes('chicken') || lowerName.includes('beef') || lowerName.includes('pork') || lowerName.includes('fish') || lowerName.includes('meat')) {
    return 'meat';
  }
  if (lowerName.includes('apple') || lowerName.includes('banana') || lowerName.includes('tomato') || lowerName.includes('onion') || lowerName.includes('lettuce')) {
    return 'produce';
  }
  if (lowerName.includes('bread') || lowerName.includes('rolls') || lowerName.includes('bagel')) {
    return 'bakery';
  }
  if (lowerName.includes('frozen')) {
    return 'frozen';
  }
  if (lowerName.includes('juice') || lowerName.includes('soda') || lowerName.includes('water') || lowerName.includes('beer') || lowerName.includes('wine')) {
    return 'beverages';
  }
  
  return 'pantry'; // Default category
}

// ============================================================================
// GET /api/grocery-lists - Get grocery lists
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
    const status = searchParams.get('status'); // active, completed, archived
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build all conditions upfront
    const whereConditions = [];
    
    if (familyGroupId) {
      whereConditions.push(eq(groceryLists.familyGroupId, familyGroupId));
    }
    
    if (status) {
      whereConditions.push(eq(groceryLists.status, status as any));
    }

    // Build and execute query - only grocery lists from family groups the user belongs to
    const query = db
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
        // Meal plan info (if linked)
        mealPlanName: mealPlans.name,
        mealPlanWeekStart: mealPlans.weekStartDate,
        // Creator info
        creatorUsername: users.username,
        creatorFirstName: users.firstName,
        creatorLastName: users.lastName,
      })
      .from(groceryLists)
      .innerJoin(familyGroups, eq(groceryLists.familyGroupId, familyGroups.id))
      .innerJoin(
        familyGroupMembers,
        and(
          eq(familyGroupMembers.familyGroupId, familyGroups.id),
          eq(familyGroupMembers.userId, currentUser.id)
        )
      )
      .leftJoin(mealPlans, eq(groceryLists.mealPlanId, mealPlans.id))
      .leftJoin(users, eq(groceryLists.createdBy, users.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(groceryLists.createdAt))
      .limit(limit)
      .offset(offset);

    const userGroceryLists = await query;

    // Add completion stats to each list
    const listsWithStats = userGroceryLists.map(list => {
      const allItems = [
        ...(list.ingredients as any[] || []),
        ...(list.additionalItems as any[] || [])
      ];
      const checkedItems = allItems.filter(item => item.checked);
      
      return {
        id: list.id,
        familyGroupId: list.familyGroupId,
        mealPlanId: list.mealPlanId,
        name: list.name,
        ingredients: list.ingredients,
        additionalItems: list.additionalItems,
        status: list.status,
        completedAt: list.completedAt,
        createdAt: list.createdAt,
        updatedAt: list.updatedAt,
        familyGroup: {
          id: list.familyGroupId,
          name: list.familyGroupName,
        },
        mealPlan: list.mealPlanId ? {
          id: list.mealPlanId,
          name: list.mealPlanName,
          weekStartDate: list.mealPlanWeekStart,
        } : null,
        creator: {
          id: list.createdBy,
          username: list.creatorUsername,
          firstName: list.creatorFirstName,
          lastName: list.creatorLastName,
        },
        completionStats: {
          totalItems: allItems.length,
          checkedItems: checkedItems.length,
          percentageComplete: allItems.length > 0 ? Math.round((checkedItems.length / allItems.length) * 100) : 0,
        },
        isOwner: list.createdBy === currentUser.id,
      };
    });

    return NextResponse.json({
      groceryLists: listsWithStats,
      pagination: {
        limit,
        offset,
        hasMore: userGroceryLists.length === limit,
      },
    });
  } catch (error) {
    console.error('Get grocery lists error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/grocery-lists - Create grocery list
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const currentUser = await requireAuth();

    const body = await request.json();
    
    // Validate request body
    const validationResult = createGroceryListSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { familyGroupId, mealPlanId, name, ingredients, additionalItems } = validationResult.data;

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

    // If meal plan is specified, verify it exists and belongs to the same family group
    if (mealPlanId) {
      const [mealPlan] = await db
        .select({ familyGroupId: mealPlans.familyGroupId })
        .from(mealPlans)
        .where(eq(mealPlans.id, mealPlanId))
        .limit(1);

      if (!mealPlan || mealPlan.familyGroupId !== familyGroupId) {
        return NextResponse.json(
          { error: 'Invalid meal plan for this family group' },
          { status: 400 }
        );
      }
    }

    let finalIngredients = ingredients;

    // If creating from meal plan, extract ingredients from recipes
    if (mealPlanId && ingredients.length === 0) {
      const [mealPlan] = await db
        .select({ meals: mealPlans.meals })
        .from(mealPlans)
        .where(eq(mealPlans.id, mealPlanId))
        .limit(1);

      if (mealPlan && mealPlan.meals) {
        // Extract recipe IDs from meal plan
        const recipeIds = new Set<string>();
        const meals = mealPlan.meals as any;
        
        Object.values(meals).forEach((dayMeals: any) => {
          if (dayMeals) {
            Object.values(dayMeals).forEach((mealSlot: any) => {
              if (mealSlot && mealSlot.recipeId) {
                recipeIds.add(mealSlot.recipeId);
              }
            });
          }
        });

        // Get ingredients from recipes
        if (recipeIds.size > 0) {
          const recipeResults = await db
            .select({ id: recipes.id, ingredients: recipes.ingredients })
            .from(recipes)
            .where(inArray(recipes.id, Array.from(recipeIds)));

          if (recipeResults.length > 0) {
            const ingredientMap = new Map<string, any>();

            recipeResults.forEach(recipe => {
              const recipeIngredients = recipe.ingredients as any[] || [];
              recipeIngredients.forEach(ingredient => {
                const key = ingredient.name?.toLowerCase();
                if (key) {
                  if (ingredientMap.has(key)) {
                    // Combine amounts if same ingredient
                    const existing = ingredientMap.get(key);
                    existing.recipeSources = existing.recipeSources || [];
                    existing.recipeSources.push(recipe.id);
                  } else {
                    ingredientMap.set(key, {
                      name: ingredient.name,
                      amount: ingredient.amount || '',
                      unit: ingredient.unit || '',
                      category: ingredient.category || categorizeIngredient(ingredient.name),
                      checked: false,
                      recipeSources: [recipe.id],
                      notes: ingredient.notes || '',
                    });
                  }
                }
              });
            });

            finalIngredients = Array.from(ingredientMap.values());
          }
        }
      }
    }

    // Create grocery list
    const [newGroceryList] = await db
      .insert(groceryLists)
      .values({
        familyGroupId,
        mealPlanId: mealPlanId || null,
        name: name.trim(),
        createdBy: currentUser.id,
        ingredients: finalIngredients,
        additionalItems,
        status: 'active',
      })
      .returning();

    return NextResponse.json(
      {
        message: 'Grocery list created successfully',
        groceryList: newGroceryList,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create grocery list error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}