import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../../lib/db';
import { recipeReviews, recipes, users } from '../../../../../lib/db/schema';
import { requireAuth, verifyBearerToken } from '../../../../../lib/auth';
import { eq, and, desc } from 'drizzle-orm';

// ============================================================================
// Validation Schema
// ============================================================================

const reviewSchema = z.object({
  rating: z.number().min(1, 'Rating must be at least 1').max(5, 'Rating must be at most 5'),
  review: z.string().max(2000, 'Review is too long').optional(),
  madeModifications: z.boolean().default(false),
  modifications: z.string().max(1000, 'Modifications description is too long').optional(),
  wouldMakeAgain: z.boolean().optional(),
  difficultyRating: z.number().min(1).max(5).optional(),
  actualCookTime: z.number().positive().optional(),
});

// ============================================================================
// GET /api/recipes/[id]/reviews - Get recipe reviews
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: recipeId } = params;
    const { searchParams } = new URL(request.url);
    
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    const sortBy = searchParams.get('sortBy') || 'newest'; // newest, oldest, highest, lowest

    // Get current user (optional)
    const authHeader = request.headers.get('authorization');
    const currentUser = authHeader ? await verifyBearerToken(authHeader) : null;

    // For user recipes, check if recipe exists and is accessible
    if (!recipeId.startsWith('spoon_')) {
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

      // Check visibility
      if (existingRecipe.visibility === 'private' && (!currentUser || existingRecipe.userId !== currentUser.id)) {
        return NextResponse.json(
          { error: 'Recipe not found' },
          { status: 404 }
        );
      }
    }

    // Determine sorting order
    let orderByClause;
    switch (sortBy) {
      case 'oldest':
        orderByClause = [recipeReviews.createdAt];
        break;
      case 'highest':
        orderByClause = [desc(recipeReviews.rating), desc(recipeReviews.createdAt)];
        break;
      case 'lowest':
        orderByClause = [recipeReviews.rating, desc(recipeReviews.createdAt)];
        break;
      default: // newest
        orderByClause = [desc(recipeReviews.createdAt)];
    }

    // Build complete query
    const query = db
      .select({
        id: recipeReviews.id,
        rating: recipeReviews.rating,
        review: recipeReviews.review,
        madeModifications: recipeReviews.madeModifications,
        modifications: recipeReviews.modifications,
        wouldMakeAgain: recipeReviews.wouldMakeAgain,
        difficultyRating: recipeReviews.difficultyRating,
        actualCookTime: recipeReviews.actualCookTime,
        createdAt: recipeReviews.createdAt,
        updatedAt: recipeReviews.updatedAt,
        // Reviewer info
        reviewerUsername: users.username,
        reviewerFirstName: users.firstName,
        reviewerLastName: users.lastName,
        reviewerAvatarUrl: users.avatarUrl,
        // We'll add isOwnReview flag in post-processing
        reviewerId: recipeReviews.userId,
      })
      .from(recipeReviews)
      .leftJoin(users, eq(recipeReviews.userId, users.id))
      .where(eq(recipeReviews.recipeId, recipeId))
      .orderBy(...orderByClause)
      .limit(limit)
      .offset(offset);

    const reviews = await query;

    // Transform results
    const transformedReviews = reviews.map(review => ({
      id: review.id,
      rating: review.rating,
      review: review.review,
      madeModifications: review.madeModifications,
      modifications: review.modifications,
      wouldMakeAgain: review.wouldMakeAgain,
      difficultyRating: review.difficultyRating,
      actualCookTime: review.actualCookTime,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      isOwnReview: currentUser ? review.reviewerId === currentUser.id : false,
      reviewer: {
        username: review.reviewerUsername,
        firstName: review.reviewerFirstName,
        lastName: review.reviewerLastName,
        avatarUrl: review.reviewerAvatarUrl,
      },
    }));

    return NextResponse.json({
      reviews: transformedReviews,
      pagination: {
        limit,
        offset,
        hasMore: reviews.length === limit,
      },
    });
  } catch (error) {
    console.error('Get reviews error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/recipes/[id]/reviews - Create review
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: recipeId } = params;
    const currentUser = await requireAuth();

    const body = await request.json();
    
    // Validate request body
    const validationResult = reviewSchema.safeParse(body);
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

    // For user recipes, check if recipe exists and is accessible
    if (!recipeId.startsWith('spoon_')) {
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

      // Check visibility
      if (existingRecipe.visibility === 'private' && existingRecipe.userId !== currentUser.id) {
        return NextResponse.json(
          { error: 'Recipe not found' },
          { status: 404 }
        );
      }

      // Users cannot review their own recipes
      if (existingRecipe.userId === currentUser.id) {
        return NextResponse.json(
          { error: 'You cannot review your own recipe' },
          { status: 400 }
        );
      }
    }

    // Check if user already reviewed this recipe
    const [existingReview] = await db
      .select({ id: recipeReviews.id })
      .from(recipeReviews)
      .where(
        and(
          eq(recipeReviews.recipeId, recipeId),
          eq(recipeReviews.userId, currentUser.id)
        )
      )
      .limit(1);

    if (existingReview) {
      return NextResponse.json(
        { error: 'You have already reviewed this recipe' },
        { status: 409 }
      );
    }

    // Create review
    const [newReview] = await db
      .insert(recipeReviews)
      .values({
        recipeId,
        userId: currentUser.id,
        rating: data.rating,
        review: data.review || null,
        madeModifications: data.madeModifications,
        modifications: data.modifications || null,
        wouldMakeAgain: data.wouldMakeAgain || null,
        difficultyRating: data.difficultyRating || null,
        actualCookTime: data.actualCookTime || null,
      })
      .returning();

    return NextResponse.json(
      {
        message: 'Review created successfully',
        review: newReview,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create review error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT /api/recipes/[id]/reviews - Update user's review
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
    const validationResult = reviewSchema.safeParse(body);
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

    // Check if user has reviewed this recipe
    const [existingReview] = await db
      .select({ id: recipeReviews.id })
      .from(recipeReviews)
      .where(
        and(
          eq(recipeReviews.recipeId, recipeId),
          eq(recipeReviews.userId, currentUser.id)
        )
      )
      .limit(1);

    if (!existingReview) {
      return NextResponse.json(
        { error: 'You have not reviewed this recipe yet' },
        { status: 404 }
      );
    }

    // Update review
    const [updatedReview] = await db
      .update(recipeReviews)
      .set({
        rating: data.rating,
        review: data.review || null,
        madeModifications: data.madeModifications,
        modifications: data.modifications || null,
        wouldMakeAgain: data.wouldMakeAgain || null,
        difficultyRating: data.difficultyRating || null,
        actualCookTime: data.actualCookTime || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(recipeReviews.recipeId, recipeId),
          eq(recipeReviews.userId, currentUser.id)
        )
      )
      .returning();

    return NextResponse.json({
      message: 'Review updated successfully',
      review: updatedReview,
    });
  } catch (error) {
    console.error('Update review error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/recipes/[id]/reviews - Delete user's review
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: recipeId } = params;
    const currentUser = await requireAuth();

    // Check if user has reviewed this recipe
    const [existingReview] = await db
      .select({ id: recipeReviews.id })
      .from(recipeReviews)
      .where(
        and(
          eq(recipeReviews.recipeId, recipeId),
          eq(recipeReviews.userId, currentUser.id)
        )
      )
      .limit(1);

    if (!existingReview) {
      return NextResponse.json(
        { error: 'You have not reviewed this recipe' },
        { status: 404 }
      );
    }

    // Delete review
    await db
      .delete(recipeReviews)
      .where(
        and(
          eq(recipeReviews.recipeId, recipeId),
          eq(recipeReviews.userId, currentUser.id)
        )
      );

    return NextResponse.json({
      message: 'Review deleted successfully',
    });
  } catch (error) {
    console.error('Delete review error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}