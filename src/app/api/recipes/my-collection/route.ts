import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/db';
import { recipes, recipeFavorites } from '../../../../lib/db/schema';
import { requireAuth } from '../../../../lib/auth';
import { eq, desc, and, sql } from 'drizzle-orm';
import { getSpoonacularService } from '../../../../lib/spoonacular';

// ============================================================================
// GET /api/recipes/my-collection - Get user's recipes + favorites
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const currentUser = await requireAuth();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    console.log('My Collection: Fetching recipes for user:', currentUser.id);

    // Get user's own recipes
    const rawUserRecipes = await db
      .select({
        id: recipes.id,
        title: recipes.title,
        description: recipes.description,
        summary: recipes.summary,
        imageUrl: recipes.imageUrl,
        cookTimeMinutes: recipes.cookTimeMinutes,
        prepTimeMinutes: recipes.prepTimeMinutes,
        readyInMinutes: recipes.readyInMinutes,
        servings: recipes.servings,
        healthScore: recipes.healthScore,
        difficulty: recipes.difficulty,
        cuisine: recipes.cuisine,
        tags: recipes.tags,
        dishTypes: recipes.dishTypes,
        diets: recipes.diets,
        isVegetarian: recipes.isVegetarian,
        isVegan: recipes.isVegan,
        isGlutenFree: recipes.isGlutenFree,
        isDairyFree: recipes.isDairyFree,
        sourceType: recipes.sourceType,
        spoonacularId: recipes.spoonacularId,
        userId: recipes.userId,
        status: recipes.status,
        visibility: recipes.visibility,
        createdAt: recipes.createdAt,
        updatedAt: recipes.updatedAt,
      })
      .from(recipes)
      .where(and(
        eq(recipes.userId, currentUser.id),
        eq(recipes.status, 'published')
      ))
      .orderBy(desc(recipes.updatedAt));

    console.log('My Collection: Found', rawUserRecipes.length, 'user recipes');
    console.log('User recipes:', rawUserRecipes.map(r => ({ id: r.id, title: r.title, status: r.status, userId: r.userId })));

    // Transform user recipes to ensure required fields have default values
    const userRecipes = rawUserRecipes.map(recipe => ({
      ...recipe,
      description: recipe.description || '',
      summary: recipe.summary || recipe.description || '',
      imageUrl: recipe.imageUrl || '',
      readyInMinutes: recipe.readyInMinutes || 0,
      healthScore: recipe.healthScore || 0,
      isFavorited: true, // User's own recipes are always "favorited"
    }));

    // Get user's favorited recipes (including Spoonacular ones)
    const favoritedRecipes = await db
      .select({
        recipeId: recipeFavorites.recipeId,
        favoritedAt: recipeFavorites.createdAt,
      })
      .from(recipeFavorites)
      .where(eq(recipeFavorites.userId, currentUser.id))
      .orderBy(desc(recipeFavorites.createdAt));

    // Separate local favorited recipes from external ones
    const localFavoriteIds: string[] = [];
    const spoonacularFavoriteIds: string[] = [];

    favoritedRecipes.forEach(fav => {
      if (/^\d+$/.test(fav.recipeId)) {
        // Numeric ID = Spoonacular recipe
        spoonacularFavoriteIds.push(fav.recipeId);
      } else {
        // Non-numeric ID = local recipe (but not user's own)
        if (!userRecipes.some(recipe => recipe.id === fav.recipeId)) {
          localFavoriteIds.push(fav.recipeId);
        }
      }
    });

    // Get local favorited recipes (other users' recipes)
    let localFavorites: any[] = [];
    if (localFavoriteIds.length > 0) {
      const rawLocalFavorites = await db
        .select({
          id: recipes.id,
          title: recipes.title,
          description: recipes.description,
          summary: recipes.summary,
          imageUrl: recipes.imageUrl,
          cookTimeMinutes: recipes.cookTimeMinutes,
          prepTimeMinutes: recipes.prepTimeMinutes,
          readyInMinutes: recipes.readyInMinutes,
          servings: recipes.servings,
          healthScore: recipes.healthScore,
          difficulty: recipes.difficulty,
          cuisine: recipes.cuisine,
          tags: recipes.tags,
          dishTypes: recipes.dishTypes,
          diets: recipes.diets,
          isVegetarian: recipes.isVegetarian,
          isVegan: recipes.isVegan,
          isGlutenFree: recipes.isGlutenFree,
          isDairyFree: recipes.isDairyFree,
          sourceType: recipes.sourceType,
          spoonacularId: recipes.spoonacularId,
          userId: recipes.userId,
          status: recipes.status,
          visibility: recipes.visibility,
          createdAt: recipes.createdAt,
          updatedAt: recipes.updatedAt,
        })
        .from(recipes)
        .where(sql`${recipes.id} = ANY(${localFavoriteIds})`)
        .orderBy(desc(recipes.updatedAt));

      // Transform local favorites to ensure required fields have default values
      localFavorites = rawLocalFavorites.map(recipe => ({
        ...recipe,
        description: recipe.description || '',
        summary: recipe.summary || recipe.description || '',
        imageUrl: recipe.imageUrl || '',
        readyInMinutes: recipe.readyInMinutes || 0,
        healthScore: recipe.healthScore || 0,
        isFavorited: true,
      }));
    }

    // Get Spoonacular favorited recipes (limit to avoid API overuse)
    let spoonacularFavorites: any[] = [];
    const maxSpoonacularFetch = Math.min(spoonacularFavoriteIds.length, 5); // Limit API calls
    
    if (maxSpoonacularFetch > 0) {
      try {
        const spoonacularService = getSpoonacularService();
        
        for (let i = 0; i < maxSpoonacularFetch; i++) {
          try {
            const spoonId = parseInt(spoonacularFavoriteIds[i]);
            const spoonRecipe = await spoonacularService.getRecipeInformation(spoonId, false);
            
            spoonacularFavorites.push({
              id: spoonId.toString(),
              title: spoonRecipe.title,
              description: stripHtml(spoonRecipe.summary),
              summary: truncateText(stripHtml(spoonRecipe.summary), 200),
              imageUrl: spoonRecipe.image,
              cookTimeMinutes: spoonRecipe.cookingMinutes || null,
              prepTimeMinutes: spoonRecipe.preparationMinutes || null,
              readyInMinutes: spoonRecipe.readyInMinutes,
              servings: spoonRecipe.servings,
              healthScore: spoonRecipe.healthScore,
              difficulty: null,
              cuisine: spoonRecipe.cuisines?.[0] || null,
              tags: extractTags(spoonRecipe),
              dishTypes: spoonRecipe.dishTypes || [],
              diets: spoonRecipe.diets || [],
              isVegetarian: spoonRecipe.vegetarian,
              isVegan: spoonRecipe.vegan,
              isGlutenFree: spoonRecipe.glutenFree,
              isDairyFree: spoonRecipe.dairyFree,
              sourceType: 'spoonacular',
              spoonacularId: spoonId,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              isFavorited: true,
            });
          } catch (error) {
            console.error(`Failed to fetch Spoonacular recipe ${spoonacularFavoriteIds[i]}:`, error);
          }
        }
      } catch (error) {
        console.error('Error fetching Spoonacular favorites:', error);
      }
    }

    // Combine all recipes
    const allRecipes = [
      ...userRecipes,
      ...localFavorites,
      ...spoonacularFavorites,
    ];

    // Sort by most recent first (user recipes by updatedAt, favorites by favoritedAt)
    allRecipes.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());

    // Apply pagination
    const paginatedRecipes = allRecipes.slice(offset, offset + limit);

    return NextResponse.json({
      recipes: paginatedRecipes,
      pagination: {
        limit,
        offset,
        total: allRecipes.length,
        hasMore: offset + limit < allRecipes.length,
      },
      stats: {
        userRecipes: userRecipes.length,
        favoritedRecipes: localFavorites.length + spoonacularFavorites.length,
        totalCount: allRecipes.length,
      }
    });
  } catch (error) {
    console.error('Get user collection error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
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