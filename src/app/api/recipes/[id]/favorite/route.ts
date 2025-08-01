import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../lib/db';
import { recipeFavorites, recipes } from '../../../lib/db/schema';
import { requireAuth } from '../../../lib/auth';
import { eq, and } from 'drizzle-orm';

// ============================================================================
// Validation Schema
// ============================================================================

const favoriteSchema = z.object({
  notes: z.string().optional(),
  rating: z.number().min(1).max(5).optional(),
});

// ============================================================================
// POST /api/recipes/[id]/favorite - Add to favorites
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: recipeId } = params;
    const currentUser = await requireAuth();

    const body = await request.json().catch(() => ({}));
    
    // Validate request body
    const validationResult = favoriteSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { notes, rating } = validationResult.data;

    // For Spoonacular recipes, we still allow favoriting (they're stored as favorites without being in our recipes table)
    const isSpoonacularRecipe = recipeId.startsWith('spoon_');
    
    if (!isSpoonacularRecipe) {
      // Check if recipe exists for user recipes
      const [existingRecipe] = await db
        .select({ id: recipes.id, visibility: recipes.visibility, userId: recipes.userId })
        .from(recipes)
        .where(eq(recipes.id, recipeId))
        .limit(1);

      if (!existingRecipe) {
        return NextResponse.json(
          { error: 'Recipe not found' },
          { status: 404 }
        );
      }

      // Check if recipe is accessible to user
      if (existingRecipe.visibility === 'private' && existingRecipe.userId !== currentUser.id) {
        return NextResponse.json(
          { error: 'Recipe not found' },
          { status: 404 }
        );
      }
    }

    // Check if already favorited
    const [existingFavorite] = await db
      .select({ id: recipeFavorites.id })
      .from(recipeFavorites)
      .where(
        and(
          eq(recipeFavorites.recipeId, recipeId),
          eq(recipeFavorites.userId, currentUser.id)
        )
      )
      .limit(1);

    if (existingFavorite) {
      return NextResponse.json(
        { error: 'Recipe is already in your favorites' },
        { status: 409 }
      );
    }

    // Add to favorites
    const [newFavorite] = await db
      .insert(recipeFavorites)
      .values({
        recipeId,
        userId: currentUser.id,
        notes: notes || null,
        rating: rating || null,
      })
      .returning();

    return NextResponse.json({
      message: 'Recipe added to favorites',
      favorite: newFavorite,
    });
  } catch (error) {
    console.error('Add favorite error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/recipes/[id]/favorite - Remove from favorites
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: recipeId } = params;
    const currentUser = await requireAuth();

    // Check if favorited
    const [existingFavorite] = await db
      .select({ id: recipeFavorites.id })
      .from(recipeFavorites)
      .where(
        and(
          eq(recipeFavorites.recipeId, recipeId),
          eq(recipeFavorites.userId, currentUser.id)
        )
      )
      .limit(1);

    if (!existingFavorite) {
      return NextResponse.json(
        { error: 'Recipe is not in your favorites' },
        { status: 404 }
      );
    }

    // Remove from favorites
    await db
      .delete(recipeFavorites)
      .where(
        and(
          eq(recipeFavorites.recipeId, recipeId),
          eq(recipeFavorites.userId, currentUser.id)
        )
      );

    return NextResponse.json({
      message: 'Recipe removed from favorites',
    });
  } catch (error) {
    console.error('Remove favorite error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT /api/recipes/[id]/favorite - Update favorite
// ============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: recipeId } = params;
    const currentUser = await requireAuth();

    const body = await request.json();
    
    // Validate request body
    const validationResult = favoriteSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { notes, rating } = validationResult.data;

    // Check if favorited
    const [existingFavorite] = await db
      .select({ id: recipeFavorites.id })
      .from(recipeFavorites)
      .where(
        and(
          eq(recipeFavorites.recipeId, recipeId),
          eq(recipeFavorites.userId, currentUser.id)
        )
      )
      .limit(1);

    if (!existingFavorite) {
      return NextResponse.json(
        { error: 'Recipe is not in your favorites' },
        { status: 404 }
      );
    }

    // Update favorite
    const [updatedFavorite] = await db
      .update(recipeFavorites)
      .set({
        notes: notes !== undefined ? notes : undefined,
        rating: rating !== undefined ? rating : undefined,
      })
      .where(
        and(
          eq(recipeFavorites.recipeId, recipeId),
          eq(recipeFavorites.userId, currentUser.id)
        )
      )
      .returning();

    return NextResponse.json({
      message: 'Favorite updated successfully',
      favorite: updatedFavorite,
    });
  } catch (error) {
    console.error('Update favorite error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}