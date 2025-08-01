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
    console.log('Toggle favorite request for recipe:', recipeId);
    
    let currentUser;
    try {
      currentUser = await requireAuth();
      console.log('User authenticated:', currentUser.id, currentUser.email);
    } catch (authError) {
      console.error('Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if already favorited
    console.log('Checking if recipe is already favorited...');
    let existingFavorite;
    try {
      [existingFavorite] = await db
        .select({ id: recipeFavorites.id })
        .from(recipeFavorites)
        .where(
          and(
            eq(recipeFavorites.recipeId, recipeId),
            eq(recipeFavorites.userId, currentUser.id)
          )
        )
        .limit(1);
      console.log('Existing favorite check result:', existingFavorite ? 'Found' : 'Not found');
    } catch (dbError) {
      console.error('Database error checking favorite:', dbError);
      throw dbError;
    }

    if (existingFavorite) {
      // Remove from favorites
      console.log('Removing recipe from favorites...');
      try {
        await db
          .delete(recipeFavorites)
          .where(
            and(
              eq(recipeFavorites.recipeId, recipeId),
              eq(recipeFavorites.userId, currentUser.id)
            )
          );
        console.log('Successfully removed from favorites');

        return NextResponse.json({
          message: 'Recipe removed from favorites',
          isFavorited: false,
        });
      } catch (dbError) {
        console.error('Database error removing favorite:', dbError);
        throw dbError;
      }
    } else {
      // Add to favorites
      console.log('Adding recipe to favorites...');
      try {
        const [newFavorite] = await db
          .insert(recipeFavorites)
          .values({
            recipeId,
            userId: currentUser.id,
            notes: null,
            rating: null,
          })
          .returning();
        console.log('Successfully added to favorites:', newFavorite.id);

        return NextResponse.json({
          message: 'Recipe added to favorites',
          isFavorited: true,
          favorite: newFavorite,
        });
      } catch (dbError) {
        console.error('Database error adding favorite:', dbError);
        throw dbError;
      }
    }
  } catch (error) {
    console.error('Toggle favorite error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}