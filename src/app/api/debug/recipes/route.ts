import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { recipes } from '../../../../lib/db/schema';
import { requireAuth } from '../../../../lib/auth';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireAuth();
    console.log('Debug: Current user ID:', currentUser.id);

    // Get ALL recipes for this user (regardless of status)
    const allUserRecipes = await db
      .select({
        id: recipes.id,
        title: recipes.title,
        userId: recipes.userId,
        status: recipes.status,
        visibility: recipes.visibility,
        sourceType: recipes.sourceType,
        createdAt: recipes.createdAt,
        updatedAt: recipes.updatedAt,
      })
      .from(recipes)
      .where(eq(recipes.userId, currentUser.id))
      .orderBy(recipes.createdAt);

    console.log('Debug: Found', allUserRecipes.length, 'recipes for user');
    console.log('Debug recipes:', allUserRecipes);

    return NextResponse.json({
      userId: currentUser.id,
      totalRecipes: allUserRecipes.length,
      recipes: allUserRecipes,
    });
  } catch (error) {
    console.error('Debug recipes error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}