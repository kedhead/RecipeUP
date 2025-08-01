import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../../../lib/db';
import { recipeFavorites } from '../../../../../../lib/db/schema';
import { requireAuth } from '../../../../../../lib/auth';
import { eq, and } from 'drizzle-orm';

// ============================================================================
// POST /api/recipes/[id]/favorite/toggle - Toggle favorite status
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: recipeId } = params;
    const currentUser = await requireAuth();

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
        isFavorited: false,
      });
    } else {
      // Add to favorites
      const [newFavorite] = await db
        .insert(recipeFavorites)
        .values({
          recipeId,
          userId: currentUser.id,
          notes: null,
          rating: null,
        })
        .returning();

      return NextResponse.json({
        message: 'Recipe added to favorites',
        isFavorited: true,
        favorite: newFavorite,
      });
    }
  } catch (error) {
    console.error('Toggle favorite error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}