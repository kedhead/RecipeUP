import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../../lib/db';
import { recipes, recipeFavorites } from '../../../../lib/db/schema';
import { verifyBearerToken, getCurrentUser } from '../../../../lib/auth';
import { getSpoonacularService } from '../../../../lib/spoonacular';
import { eq, and, or, like, desc, asc, sql, inArray, ilike } from 'drizzle-orm';

// ============================================================================
// Validation Schema
// ============================================================================

const searchParamsSchema = z.object({
  query: z.string().optional(),
  cuisine: z.string().optional(),
  diet: z.string().optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  maxCookTime: z.coerce.number().positive().optional(),
  maxPrepTime: z.coerce.number().positive().optional(),
  minHealthScore: z.coerce.number().min(0).max(100).optional(),
  tags: z.string().optional(), // comma-separated
  source: z.enum(['all', 'user', 'spoonacular']).default('all'),
  includePrivate: z.coerce.boolean().default(false),
  sortBy: z.enum(['relevance', 'rating', 'cookTime', 'healthScore', 'created']).default('relevance'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().positive().max(50).default(12),
  offset: z.coerce.number().min(0).default(0),
});

// ============================================================================
// GET /api/recipes/search
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    console.log('Search request:', request.url);
    console.log('Search params:', Object.fromEntries(searchParams));
    
    const validationResult = searchParamsSchema.safeParse(Object.fromEntries(searchParams));
    
    if (!validationResult.success) {
      console.error('Search validation failed:', validationResult.error.errors);
      return NextResponse.json(
        {
          error: 'Invalid search parameters',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const params = validationResult.data;
    
    // Get current user (optional for search)
    const currentUser = await getCurrentUser().catch(() => null);

    // Parse tags if provided
    const tagFilters = params.tags ? params.tags.split(',').map(t => t.trim()) : [];

    // If searching Spoonacular, delegate to Spoonacular service
    if (params.source === 'spoonacular') {
      return await searchSpoonacularRecipes(params, tagFilters, currentUser);
    }

    // If searching all sources, combine local and Spoonacular results
    if (params.source === 'all') {
      return await searchAllSources(params, tagFilters, currentUser);
    }

    // Build all where conditions upfront
    const whereConditions = [];

    // Visibility conditions
    const visibilityConditions = [eq(recipes.visibility, 'public')];
    if (currentUser) {
      // Add user's own recipes
      visibilityConditions.push(eq(recipes.userId, currentUser.id));
      
      // Add family recipes if not including private
      if (!params.includePrivate) {
        visibilityConditions.push(eq(recipes.visibility, 'family'));
      }
    }
    whereConditions.push(or(...visibilityConditions));

    // Status filter - only show published recipes
    whereConditions.push(eq(recipes.status, 'published'));

    // TODO: Apply filters - temporarily disabled for deployment
    // All filter logic needs to be rewritten to avoid query chaining issues
    /*
    if (params.cuisine) {
      query = query.where(eq(recipes.cuisine, params.cuisine));
    }

    if (params.difficulty) {
      query = query.where(eq(recipes.difficulty, params.difficulty));
    }

    if (params.maxCookTime) {
      query = query.where(sql`${recipes.cookTimeMinutes} <= ${params.maxCookTime}`);
    }

    if (params.maxPrepTime) {
      query = query.where(sql`${recipes.prepTimeMinutes} <= ${params.maxPrepTime}`);
    }
    */

    // Query filter if provided
    if (params.query) {
      whereConditions.push(
        or(
          ilike(recipes.title, `%${params.query}%`),
          ilike(recipes.description, `%${params.query}%`),
          ilike(recipes.cuisine, `%${params.query}%`)
        )
      );
    }

    // Build and execute the query
    const results = await db
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
        difficulty: recipes.difficulty,
        healthScore: recipes.healthScore,
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
        visibility: recipes.visibility,
        createdAt: recipes.createdAt,
        userId: recipes.userId,
        familyGroupId: recipes.familyGroupId,
        // Add favorite status if user is authenticated
        ...(currentUser ? {
          isFavorited: sql<boolean>`EXISTS(
            SELECT 1 FROM ${recipeFavorites} 
            WHERE ${recipeFavorites.recipeId} = ${recipes.id} 
            AND ${recipeFavorites.userId} = ${currentUser.id}
          )`.as('is_favorited')
        } : {}),
      })
      .from(recipes)
      .where(and(...whereConditions))
      .orderBy(desc(recipes.updatedAt))
      .limit(params.limit)
      .offset(params.offset);

    // Get total count for pagination with same filters
    const [{ count: totalResults }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(recipes)
      .where(and(...whereConditions));

    return NextResponse.json({
      recipes: results,
      pagination: {
        limit: params.limit,
        offset: params.offset,
        total: totalResults,
        hasMore: params.offset + params.limit < totalResults,
      },
      filters: {
        query: params.query,
        cuisine: params.cuisine,
        diet: params.diet,
        difficulty: params.difficulty,
        maxCookTime: params.maxCookTime,
        maxPrepTime: params.maxPrepTime,
        minHealthScore: params.minHealthScore,
        tags: tagFilters,
        source: params.source,
      },
    });
  } catch (error) {
    console.error('Recipe search error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Combined Search Helper (Local + Spoonacular)
// ============================================================================

async function searchAllSources(params: any, tagFilters: string[], currentUser?: any) {
  try {
    // Get a mix: some local recipes and some Spoonacular recipes
    const localLimit = Math.min(6, params.limit); // Take up to 6 local recipes
    const spoonacularLimit = params.limit - localLimit; // Rest from Spoonacular

    // Search local recipes first
    const whereConditions = [];
    
    // Visibility conditions for local recipes
    const visibilityConditions = [eq(recipes.visibility, 'public')];
    if (currentUser) {
      visibilityConditions.push(eq(recipes.userId, currentUser.id));
      visibilityConditions.push(eq(recipes.visibility, 'family'));
    }
    whereConditions.push(or(...visibilityConditions));
    whereConditions.push(eq(recipes.status, 'published'));

    // Query filter if provided
    if (params.query) {
      whereConditions.push(
        or(
          ilike(recipes.title, `%${params.query}%`),
          ilike(recipes.description, `%${params.query}%`),
          ilike(recipes.cuisine, `%${params.query}%`)
        )
      );
    }

    // Get local recipes
    const localResults = await db
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
        difficulty: recipes.difficulty,
        healthScore: recipes.healthScore,
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
        visibility: recipes.visibility,
        createdAt: recipes.createdAt,
        userId: recipes.userId,
        // Add favorite status if user is authenticated
        ...(currentUser ? {
          isFavorited: sql<boolean>`EXISTS(
            SELECT 1 FROM ${recipeFavorites} 
            WHERE ${recipeFavorites.recipeId} = ${recipes.id} 
            AND ${recipeFavorites.userId} = ${currentUser.id}
          )`.as('is_favorited')
        } : {}),
      })
      .from(recipes)
      .where(and(...whereConditions))
      .orderBy(desc(recipes.updatedAt))
      .limit(localLimit);

    // Get Spoonacular recipes
    let spoonacularResults = [];
    if (spoonacularLimit > 0) {
      const spoonacularParams = {
        ...params,
        limit: spoonacularLimit,
        offset: 0, // Always get fresh Spoonacular results
        query: params.query || 'popular', // Default to popular if no query
      };
      
      const spoonacularResponse = await searchSpoonacularRecipes(spoonacularParams, tagFilters, currentUser);
      const spoonacularData = await spoonacularResponse.json();
      spoonacularResults = spoonacularData.recipes || [];
    }

    // Combine and shuffle results
    const allResults = [...localResults, ...spoonacularResults];
    
    // Simple shuffle to mix local and external recipes
    for (let i = allResults.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allResults[i], allResults[j]] = [allResults[j], allResults[i]];
    }

    return NextResponse.json({
      recipes: allResults.slice(0, params.limit),
      pagination: {
        limit: params.limit,
        offset: params.offset,
        total: allResults.length,
        hasMore: false, // Simplified pagination for mixed results
      },
      filters: {
        query: params.query,
        source: 'all',
      },
      source: 'mixed',
      stats: {
        localRecipes: localResults.length,
        spoonacularRecipes: spoonacularResults.length,
      }
    });
  } catch (error) {
    console.error('Combined search error:', error);
    return NextResponse.json(
      { error: 'Failed to search recipes from all sources' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Spoonacular Search Helper
// ============================================================================

async function searchSpoonacularRecipes(params: any, tagFilters: string[], currentUser?: any) {
  try {
    const spoonacularService = getSpoonacularService();
    
    // Transform our params to Spoonacular params
    const spoonacularParams = {
      query: params.query,
      cuisine: params.cuisine,
      diet: params.diet,
      maxReadyTime: params.maxCookTime,
      number: params.limit,
      offset: params.offset,
      sort: transformSortParam(params.sortBy),
      sortDirection: params.sortOrder,
      addRecipeInformation: true,
      addRecipeNutrition: false, // Can be made configurable
    };

    const response = await spoonacularService.searchRecipes(spoonacularParams);

    // Get user's favorites if authenticated
    let userFavorites: Set<string> = new Set();
    if (currentUser) {
      const favorites = await db
        .select({ recipeId: recipeFavorites.recipeId })
        .from(recipeFavorites)
        .where(eq(recipeFavorites.userId, currentUser.id));
      
      userFavorites = new Set(favorites.map(f => f.recipeId));
    }

    // Transform Spoonacular results to our format
    const transformedRecipes = response.results.map(recipe => ({
      id: `spoon_${recipe.id}`,
      title: recipe.title,
      description: stripHtml(recipe.summary),
      summary: truncateText(stripHtml(recipe.summary), 200),
      imageUrl: recipe.image,
      cookTimeMinutes: recipe.cookingMinutes || null,
      prepTimeMinutes: recipe.preparationMinutes || null,
      readyInMinutes: recipe.readyInMinutes,
      servings: recipe.servings,
      difficulty: null, // Spoonacular doesn't provide this
      healthScore: recipe.healthScore,
      cuisine: recipe.cuisines?.[0] || null,
      tags: [...(recipe.dishTypes || []), ...(recipe.cuisines || [])],
      dishTypes: recipe.dishTypes || [],
      diets: recipe.diets || [],
      isVegetarian: recipe.vegetarian,
      isVegan: recipe.vegan,
      isGlutenFree: recipe.glutenFree,
      isDairyFree: recipe.dairyFree,
      sourceType: 'spoonacular',
      spoonacularId: recipe.id,
      visibility: 'public',
      createdAt: new Date().toISOString(),
      userId: null,
      familyGroupId: null,
      isFavorited: userFavorites.has(recipe.id.toString()),
    }));

    return NextResponse.json({
      recipes: transformedRecipes,
      pagination: {
        limit: params.limit,
        offset: params.offset,
        total: response.totalResults,
        hasMore: params.offset + params.limit < response.totalResults,
      },
      filters: {
        query: params.query,
        cuisine: params.cuisine,
        diet: params.diet,
        maxCookTime: params.maxCookTime,
        source: 'spoonacular',
      },
      source: 'spoonacular',
    });
  } catch (error) {
    console.error('Spoonacular search error:', error);
    return NextResponse.json(
      { error: 'Failed to search recipes from external source' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function transformSortParam(sortBy: string): "time" | "meta-score" | "popularity" | "healthiness" | "price" | "random" {
  switch (sortBy) {
    case 'rating':
      return 'popularity';
    case 'cookTime':
      return 'time';
    case 'healthScore':
      return 'healthiness';
    default:
      return 'meta-score';
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).replace(/\s+\S*$/, '') + '...';
}