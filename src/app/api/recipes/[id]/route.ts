import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { recipes, recipeFavorites, recipeReviews, users } from '@/lib/db/schema';
import { verifyBearerToken } from '@/lib/auth';
import { getSpoonacularService } from '@/lib/spoonacular';
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

    // Check if this is a Spoonacular recipe
    if (id.startsWith('spoon_')) {
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
    const spoonacularId = parseInt(id.replace('spoon_', ''));
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
        favoriteCount: 0, // TODO: Count actual favorites for Spoonacular recipes
      },
      recentReviews: [],
      // User interaction flags
      isFavorited: false, // TODO: Check if user has favorited this Spoonacular recipe
      userRating: null,
    };

    return NextResponse.json({ recipe });
  } catch (error) {
    console.error('Spoonacular recipe fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recipe from external source' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

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