import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../lib/db';
import { recipes, recipeFavorites, recipeReviews, users } from '../../../../lib/db/schema';
import { verifyBearerToken, requireAuth } from '../../../../lib/auth';
import { getSpoonacularService } from '../../../../lib/spoonacular';
import { eq, and, sql, avg, count } from 'drizzle-orm';

// ============================================================================
// GET /api/recipes/[id]
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    // Get current user (optional)
    const authHeader = request.headers.get('authorization');
    const currentUser = authHeader ? await verifyBearerToken(authHeader) : null;

    // Check if this is a Spoonacular recipe (numeric ID means it's from Spoonacular)
    if (/^\d+$/.test(id)) {
      return await getSpoonacularRecipe(id, currentUser);
    }

    // Query database recipe with additional data
    const recipeQuery = db
      .select({
        // Recipe fields
        id: recipes.id,
        title: recipes.title,
        description: recipes.description,
        summary: recipes.summary,
        userId: recipes.userId,
        familyGroupId: recipes.familyGroupId,
        spoonacularId: recipes.spoonacularId,
        sourceType: recipes.sourceType,
        sourceUrl: recipes.sourceUrl,
        prepTimeMinutes: recipes.prepTimeMinutes,
        cookTimeMinutes: recipes.cookTimeMinutes,
        readyInMinutes: recipes.readyInMinutes,
        servings: recipes.servings,
        imageUrl: recipes.imageUrl,
        mediaUrls: recipes.mediaUrls,
        difficulty: recipes.difficulty,
        healthScore: recipes.healthScore,
        pricePerServing: recipes.pricePerServing,
        isVegetarian: recipes.isVegetarian,
        isVegan: recipes.isVegan,
        isGlutenFree: recipes.isGlutenFree,
        isDairyFree: recipes.isDairyFree,
        isVeryHealthy: recipes.isVeryHealthy,
        isCheap: recipes.isCheap,
        isVeryPopular: recipes.isVeryPopular,
        isSustainable: recipes.isSustainable,
        weightWatcherSmartPoints: recipes.weightWatcherSmartPoints,
        gaps: recipes.gaps,
        fodmapFriendly: recipes.fodmapFriendly,
        ketogenic: recipes.ketogenic,
        whole30: recipes.whole30,
        tags: recipes.tags,
        dishTypes: recipes.dishTypes,
        diets: recipes.diets,
        occasions: recipes.occasions,
        cuisine: recipes.cuisine,
        ingredients: recipes.ingredients,
        instructions: recipes.instructions,
        equipment: recipes.equipment,
        winePairing: recipes.winePairing,
        taste: recipes.taste,
        nutrition: recipes.nutrition,
        visibility: recipes.visibility,
        status: recipes.status,
        createdAt: recipes.createdAt,
        updatedAt: recipes.updatedAt,
        
        // Author info
        authorUsername: users.username,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        authorAvatarUrl: users.avatarUrl,
        
        // User interaction flags
        ...(currentUser ? {
          isFavorited: sql<boolean>`EXISTS(
            SELECT 1 FROM ${recipeFavorites} 
            WHERE ${recipeFavorites.recipeId} = ${recipes.id} 
            AND ${recipeFavorites.userId} = ${currentUser.id}
          )`.as('is_favorited'),
          userRating: sql<number | null>`(
            SELECT rating FROM ${recipeReviews} 
            WHERE ${recipeReviews.recipeId} = ${recipes.id} 
            AND ${recipeReviews.userId} = ${currentUser.id}
          )`.as('user_rating'),
        } : {}),
      })
      .from(recipes)
      .leftJoin(users, eq(recipes.userId, users.id))
      .where(eq(recipes.id, id));

    const recipeResult = await recipeQuery;

    if (recipeResult.length === 0) {
      return NextResponse.json(
        { error: 'Recipe not found' },
        { status: 404 }
      );
    }

    const recipe = recipeResult[0];

    // Check visibility permissions
    if (recipe.visibility === 'private' && (!currentUser || recipe.userId !== currentUser.id)) {
      return NextResponse.json(
        { error: 'Recipe not found' },
        { status: 404 }
      );
    }

    if (recipe.visibility === 'family') {
      // TODO: Check family group membership when we implement family features
      if (!currentUser || recipe.userId !== currentUser.id) {
        return NextResponse.json(
          { error: 'Recipe not found' },
          { status: 404 }
        );
      }
    }

    // Get recipe statistics
    const statsQuery = db
      .select({
        averageRating: avg(recipeReviews.rating),
        reviewCount: count(recipeReviews.id),
        favoriteCount: sql<number>`(
          SELECT COUNT(*) FROM ${recipeFavorites} 
          WHERE ${recipeFavorites.recipeId} = ${recipe.id}
        )`.as('favorite_count'),
      })
      .from(recipeReviews)
      .where(eq(recipeReviews.recipeId, recipe.id));

    const [stats] = await statsQuery;

    // Get recent reviews (limit 5)
    const recentReviews = await db
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
        // Reviewer info
        reviewerUsername: users.username,
        reviewerFirstName: users.firstName,
        reviewerLastName: users.lastName,
        reviewerAvatarUrl: users.avatarUrl,
      })
      .from(recipeReviews)
      .leftJoin(users, eq(recipeReviews.userId, users.id))
      .where(eq(recipeReviews.recipeId, recipe.id))
      .orderBy(sql`${recipeReviews.createdAt} DESC`)
      .limit(5);

    // Build response
    const response = {
      ...recipe,
      author: {
        username: recipe.authorUsername,
        firstName: recipe.authorFirstName,
        lastName: recipe.authorLastName,
        avatarUrl: recipe.authorAvatarUrl,
      },
      stats: {
        averageRating: stats.averageRating ? Number(stats.averageRating) : null,
        reviewCount: Number(stats.reviewCount),
        favoriteCount: Number(stats.favoriteCount),
      },
      recentReviews,
      // Remove individual author fields from root
      authorUsername: undefined,
      authorFirstName: undefined,
      authorLastName: undefined,
      authorAvatarUrl: undefined,
    };

    return NextResponse.json({ recipe: response });
  } catch (error) {
    console.error('Get recipe error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Spoonacular Recipe Helper
// ============================================================================

async function getSpoonacularRecipe(id: string, currentUser: any) {
  try {
    const spoonacularId = parseInt(id);
    const spoonacularService = getSpoonacularService();
    
    const spoonRecipe = await spoonacularService.getRecipeInformation(spoonacularId, true);
    
    // Transform to our format
    const recipe = {
      id,
      title: spoonRecipe.title,
      description: stripHtml(spoonRecipe.summary),
      summary: truncateText(stripHtml(spoonRecipe.summary), 200),
      userId: null,
      familyGroupId: null,
      spoonacularId: spoonRecipe.id,
      sourceType: 'spoonacular',
      sourceUrl: spoonRecipe.sourceUrl,
      prepTimeMinutes: spoonRecipe.preparationMinutes || null,
      cookTimeMinutes: spoonRecipe.cookingMinutes || null,
      readyInMinutes: spoonRecipe.readyInMinutes,
      servings: spoonRecipe.servings,
      imageUrl: spoonRecipe.image,
      mediaUrls: spoonRecipe.image ? [spoonRecipe.image] : [],
      difficulty: null,
      healthScore: spoonRecipe.healthScore,
      pricePerServing: (spoonRecipe.pricePerServing / 100).toString(),
      isVegetarian: spoonRecipe.vegetarian,
      isVegan: spoonRecipe.vegan,
      isGlutenFree: spoonRecipe.glutenFree,
      isDairyFree: spoonRecipe.dairyFree,
      isVeryHealthy: spoonRecipe.veryHealthy,
      isCheap: spoonRecipe.cheap,
      isVeryPopular: spoonRecipe.veryPopular,
      isSustainable: spoonRecipe.sustainable,
      weightWatcherSmartPoints: spoonRecipe.weightWatcherSmartPoints || null,
      gaps: spoonRecipe.gaps || null,
      fodmapFriendly: spoonRecipe.lowFodmap,
      ketogenic: spoonRecipe.diets?.includes('ketogenic') || false,
      whole30: spoonRecipe.diets?.includes('whole 30') || false,
      tags: extractTags(spoonRecipe),
      dishTypes: spoonRecipe.dishTypes || [],
      diets: spoonRecipe.diets || [],
      occasions: spoonRecipe.occasions || [],
      cuisine: spoonRecipe.cuisines?.[0] || null,
      ingredients: transformIngredients(spoonRecipe.extendedIngredients || []),
      instructions: transformInstructions(spoonRecipe.analyzedInstructions || []),
      equipment: transformEquipment(spoonRecipe.analyzedInstructions || []),
      winePairing: spoonRecipe.winePairing || null,
      taste: spoonRecipe.taste || null,
      nutrition: transformNutrition(spoonRecipe.nutrition),
      visibility: 'public',
      status: 'published',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: {
        username: 'spoonacular',
        firstName: 'Spoonacular',
        lastName: 'API',
        avatarUrl: null,
      },
      stats: {
        averageRating: null,
        reviewCount: 0,
        favoriteCount: 0,
      },
      recentReviews: [],
      // User interaction flags
      isFavorited: currentUser ? await checkIsFavorited(spoonacularId.toString(), currentUser.id) : false,
      userRating: null,
    };

    console.log('Spoonacular recipe fetched:', recipe.title);

    return NextResponse.json({ recipe });
  } catch (error) {
    console.error('Spoonacular recipe fetch error:', error);
    
    // Check if it's a rate limit or API key issue
    if (error instanceof Error) {
      if (error.message.includes('Rate limit')) {
        return NextResponse.json(
          { error: 'Recipe service is temporarily unavailable due to rate limits' },
          { status: 429 }
        );
      }
      if (error.message.includes('API request failed')) {
        return NextResponse.json(
          { error: 'Recipe not found or service unavailable' },
          { status: 404 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch recipe from external source', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

async function checkIsFavorited(recipeId: string, userId: string): Promise<boolean> {
  try {
    const [favorite] = await db
      .select({ id: recipeFavorites.id })
      .from(recipeFavorites)
      .where(
        and(
          eq(recipeFavorites.recipeId, recipeId),
          eq(recipeFavorites.userId, userId)
        )
      )
      .limit(1);
    
    return !!favorite;
  } catch (error) {
    console.error('Error checking favorite status:', error);
    return false;
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).replace(/\s+\S*$/, '') + '...';
}

function extractTags(recipe: any): string[] {
  const tags: string[] = [];
  
  if (recipe.dishTypes) tags.push(...recipe.dishTypes);
  if (recipe.cuisines) tags.push(...recipe.cuisines);
  
  if (recipe.readyInMinutes <= 20) tags.push('quick');
  else if (recipe.readyInMinutes >= 60) tags.push('slow');
  
  if (recipe.veryHealthy) tags.push('healthy');
  if (recipe.cheap) tags.push('budget-friendly');
  if (recipe.veryPopular) tags.push('popular');
  if (recipe.sustainable) tags.push('sustainable');
  
  return Array.from(new Set(tags));
}

function transformIngredients(ingredients: any[]) {
  return ingredients.map(ingredient => ({
    name: ingredient.nameClean || ingredient.name,
    amount: ingredient.amount.toString(),
    unit: ingredient.measures.us.unitShort,
    notes: ingredient.original,
    category: ingredient.aisle?.toLowerCase() || 'pantry',
  }));
}

function transformInstructions(instructions: any[]) {
  const steps: Array<{
    step: number;
    instruction: string;
    time?: number;
    temperature?: { value: number; unit: 'F' | 'C' };
  }> = [];

  instructions.forEach(instructionGroup => {
    instructionGroup.steps.forEach((step: any) => {
      steps.push({
        step: step.number,
        instruction: step.step,
        time: step.length?.number,
        temperature: step.temperature ? {
          value: step.temperature.number,
          unit: step.temperature.unit === 'Fahrenheit' ? 'F' : 'C',
        } : undefined,
      });
    });
  });

  return steps;
}

function transformEquipment(instructions: any[]) {
  const equipmentSet = new Set<string>();
  const equipment: Array<{
    name: string;
    imageUrl?: string;
    spoonacularId?: number;
  }> = [];

  instructions.forEach(instructionGroup => {
    instructionGroup.steps.forEach((step: any) => {
      step.equipment?.forEach((eq: any) => {
        if (!equipmentSet.has(eq.name)) {
          equipmentSet.add(eq.name);
          equipment.push({
            name: eq.name,
            imageUrl: `https://spoonacular.com/cdn/equipment_100x100/${eq.image}`,
            spoonacularId: eq.id,
          });
        }
      });
    });
  });

  return equipment;
}

function transformNutrition(nutrition?: any) {
  if (!nutrition?.nutrients) return null;

  const nutritionMap: Record<string, string> = {
    'Calories': 'calories',
    'Fat': 'fat',
    'Saturated Fat': 'saturatedFat',
    'Carbohydrates': 'carbohydrates',
    'Net Carbohydrates': 'netCarbohydrates',
    'Sugar': 'sugar',
    'Cholesterol': 'cholesterol',
    'Sodium': 'sodium',
    'Protein': 'protein',
    'Fiber': 'fiber',
  };

  const result: Record<string, number> = {};
  
  nutrition.nutrients.forEach((nutrient: any) => {
    const key = nutritionMap[nutrient.name];
    if (key) {
      result[key] = nutrient.amount;
    }
  });

  return result;
}

// ============================================================================
// Validation Schemas for Updates
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

const updateRecipeSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title is too long').optional(),
  description: z.string().optional(),
  summary: z.string().optional(),
  
  // Timing
  prepTimeMinutes: z.number().positive().optional(),
  cookTimeMinutes: z.number().positive().optional(),
  servings: z.number().positive().optional(),
  
  // Media
  imageUrl: z.string().url().optional().nullable(),
  
  // Categorization
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  cuisine: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  dishTypes: z.array(z.string()).optional(),
  diets: z.array(z.string()).optional(),
  
  // Recipe content
  ingredients: z.array(ingredientSchema).optional(),
  instructions: z.array(instructionSchema).optional(),
  
  // Dietary flags
  isVegetarian: z.boolean().optional(),
  isVegan: z.boolean().optional(),
  isGlutenFree: z.boolean().optional(),
  isDairyFree: z.boolean().optional(),
  
  // Visibility and status
  visibility: z.enum(['public', 'family', 'private']).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
});

// ============================================================================
// PUT /api/recipes/[id] - Update recipe
// ============================================================================

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const currentUser = await requireAuth();
    const { id } = params;
    
    // Only allow editing user-created recipes (not Spoonacular recipes)
    if (/^\d+$/.test(id)) {
      return NextResponse.json(
        { error: 'Cannot edit external recipes' },
        { status: 403 }
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
    const existingRecipe = await db
      .select()
      .from(recipes)
      .where(and(
        eq(recipes.id, id),
        eq(recipes.userId, currentUser.id)
      ))
      .limit(1);

    if (existingRecipe.length === 0) {
      return NextResponse.json(
        { error: 'Recipe not found or access denied' },
        { status: 404 }
      );
    }

    // Calculate ready time if timing fields are provided
    const readyInMinutes = (data.prepTimeMinutes && data.cookTimeMinutes) 
      ? data.prepTimeMinutes + data.cookTimeMinutes 
      : data.cookTimeMinutes || data.prepTimeMinutes || existingRecipe[0].readyInMinutes;

    // Update recipe
    const [updatedRecipe] = await db
      .update(recipes)
      .set({
        ...data,
        readyInMinutes,
        updatedAt: new Date(),
      })
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
// DELETE /api/recipes/[id] - Delete recipe
// ============================================================================

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const currentUser = await requireAuth();
    const { id } = params;

    // Only allow deleting user-created recipes (not Spoonacular recipes)
    if (/^\d+$/.test(id)) {
      return NextResponse.json(
        { error: 'Cannot delete external recipes' },
        { status: 403 }
      );
    }

    // Check if recipe exists and user owns it
    const existingRecipe = await db
      .select()
      .from(recipes)
      .where(and(
        eq(recipes.id, id),
        eq(recipes.userId, currentUser.id)
      ))
      .limit(1);

    if (existingRecipe.length === 0) {
      return NextResponse.json(
        { error: 'Recipe not found or access denied' },
        { status: 404 }
      );
    }

    // Delete recipe
    await db
      .delete(recipes)
      .where(eq(recipes.id, id));

    return NextResponse.json({
      message: 'Recipe deleted successfully'
    });
  } catch (error) {
    console.error('Delete recipe error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}