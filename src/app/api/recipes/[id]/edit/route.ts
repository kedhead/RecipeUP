import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../lib/db';
import { recipes } from '../../../lib/db/schema';
import { requireAuth } from '../../../lib/auth';
import { eq, and } from 'drizzle-orm';

// ============================================================================
// Validation Schemas
// ============================================================================

const ingredientSchema = z.object({
  name: z.string().min(1, 'Ingredient name is required'),
  amount: z.string().min(1, 'Amount is required'),
  unit: z.string(),
  notes: z.string().optional(),
  category: z.string().optional(),
});

const instructionSchema = z.object({
  step: z.number().positive(),
  instruction: z.string().min(1, 'Instruction is required'),
  time: z.number().positive().optional(),
  temperature: z.object({
    value: z.number(),
    unit: z.enum(['F', 'C']),
  }).optional(),
});

const equipmentSchema = z.object({
  name: z.string().min(1, 'Equipment name is required'),
  imageUrl: z.string().url().optional(),
  spoonacularId: z.number().optional(),
});

const updateRecipeSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title is too long').optional(),
  description: z.string().optional(),
  summary: z.string().optional(),
  familyGroupId: z.string().nullable().optional(),
  
  // Timing
  prepTimeMinutes: z.number().positive().nullable().optional(),
  cookTimeMinutes: z.number().positive().nullable().optional(),
  servings: z.number().positive().optional(),
  
  // Media
  imageUrl: z.string().url().nullable().optional(),
  mediaUrls: z.array(z.string().url()).optional(),
  
  // Categorization
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).nullable().optional(),
  cuisine: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  dishTypes: z.array(z.string()).optional(),
  diets: z.array(z.string()).optional(),
  occasions: z.array(z.string()).optional(),
  
  // Recipe content
  ingredients: z.array(ingredientSchema).min(1, 'At least one ingredient is required').optional(),
  instructions: z.array(instructionSchema).optional(),
  equipment: z.array(equipmentSchema).optional(),
  
  // Dietary flags
  isVegetarian: z.boolean().optional(),
  isVegan: z.boolean().optional(),
  isGlutenFree: z.boolean().optional(),
  isDairyFree: z.boolean().optional(),
  ketogenic: z.boolean().optional(),
  whole30: z.boolean().optional(),
  fodmapFriendly: z.boolean().optional(),
  
  // Visibility and status
  visibility: z.enum(['public', 'family', 'private']).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

// ============================================================================
// PUT /api/recipes/[id]/edit - Update recipe
// ============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const currentUser = await requireAuth();

    // Spoonacular recipes cannot be edited
    if (id.startsWith('spoon_')) {
      return NextResponse.json(
        { error: 'External recipes cannot be edited' },
        { status: 400 }
      );
    }

    const body = await request.json();
    
    // Validate request body
    const validationResult = updateRecipeSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Check if recipe exists and user owns it
    const [existingRecipe] = await db
      .select({
        id: recipes.id,
        userId: recipes.userId,
        title: recipes.title,
        prepTimeMinutes: recipes.prepTimeMinutes,
        cookTimeMinutes: recipes.cookTimeMinutes,
      })
      .from(recipes)
      .where(eq(recipes.id, id))
      .limit(1);

    if (!existingRecipe) {
      return NextResponse.json(
        { error: 'Recipe not found' },
        { status: 404 }
      );
    }

    if (existingRecipe.userId !== currentUser.id) {
      return NextResponse.json(
        { error: 'You can only edit your own recipes' },
        { status: 403 }
      );
    }

    // Calculate ready time if timing fields are being updated
    let readyInMinutes: number | null = null;
    const newPrepTime = data.prepTimeMinutes !== undefined ? data.prepTimeMinutes : existingRecipe.prepTimeMinutes;
    const newCookTime = data.cookTimeMinutes !== undefined ? data.cookTimeMinutes : existingRecipe.cookTimeMinutes;
    
    if (newPrepTime && newCookTime) {
      readyInMinutes = newPrepTime + newCookTime;
    } else if (newCookTime) {
      readyInMinutes = newCookTime;
    } else if (newPrepTime) {
      readyInMinutes = newPrepTime;
    }

    // Build update object (only include fields that were provided)
    const updateData: any = {
      updatedAt: new Date(),
    };

    // Add fields that were provided in the request
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        updateData[key] = value;
      }
    });

    // Add calculated ready time if timing was updated
    if (readyInMinutes !== null) {
      updateData.readyInMinutes = readyInMinutes;
    }

    // Update recipe
    const [updatedRecipe] = await db
      .update(recipes)
      .set(updateData)
      .where(eq(recipes.id, id))
      .returning();

    return NextResponse.json({
      message: 'Recipe updated successfully',
      recipe: updatedRecipe,
    });
  } catch (error) {
    console.error('Update recipe error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/recipes/[id]/edit - Delete recipe
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const currentUser = await requireAuth();

    // Spoonacular recipes cannot be deleted (they're not in our DB anyway)
    if (id.startsWith('spoon_')) {
      return NextResponse.json(
        { error: 'External recipes cannot be deleted' },
        { status: 400 }
      );
    }

    // Check if recipe exists and user owns it
    const [existingRecipe] = await db
      .select({
        id: recipes.id,
        userId: recipes.userId,
        title: recipes.title,
      })
      .from(recipes)
      .where(eq(recipes.id, id))
      .limit(1);

    if (!existingRecipe) {
      return NextResponse.json(
        { error: 'Recipe not found' },
        { status: 404 }
      );
    }

    if (existingRecipe.userId !== currentUser.id) {
      return NextResponse.json(
        { error: 'You can only delete your own recipes' },
        { status: 403 }
      );
    }

    // Delete recipe (this will cascade to related tables due to foreign key constraints)
    await db
      .delete(recipes)
      .where(eq(recipes.id, id));

    return NextResponse.json({
      message: 'Recipe deleted successfully',
    });
  } catch (error) {
    console.error('Delete recipe error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}