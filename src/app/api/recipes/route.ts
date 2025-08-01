import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '../../../lib/db';
import { recipes } from '../../../lib/db/schema';
import { verifyBearerToken, requireAuth } from '../../../lib/auth';
import { eq, desc, and } from 'drizzle-orm';

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
  time: z.number().min(0).optional(),
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

const createRecipeSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title is too long'),
  description: z.string().optional(),
  summary: z.string().optional(),
  familyGroupId: z.string().optional(),
  
  // Timing
  prepTimeMinutes: z.number().positive().optional().nullable(),
  cookTimeMinutes: z.number().positive().optional().nullable(),
  readyInMinutes: z.number().positive().optional().nullable(),
  servings: z.number().positive().default(4),
  
  // Media
  imageUrl: z.string().url().optional().nullable(),
  mediaUrls: z.array(z.string().url()).default([]),
  
  // Categorization
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  cuisine: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
  dishTypes: z.array(z.string()).default([]),
  diets: z.array(z.string()).default([]),
  occasions: z.array(z.string()).default([]),
  
  // Recipe content
  ingredients: z.array(ingredientSchema).min(1, 'At least one ingredient is required'),
  instructions: z.array(instructionSchema).default([]),
  equipment: z.array(equipmentSchema).default([]),
  
  // Dietary flags
  isVegetarian: z.boolean().default(false),
  isVegan: z.boolean().default(false),
  isGlutenFree: z.boolean().default(false),
  isDairyFree: z.boolean().default(false),
  ketogenic: z.boolean().default(false),
  whole30: z.boolean().default(false),
  fodmapFriendly: z.boolean().default(false),
  
  // Visibility and status
  visibility: z.enum(['public', 'family', 'private']).default('private'),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
});

// ============================================================================
// GET /api/recipes - Get user's recipes
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const currentUser = await requireAuth();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // draft, published, archived
    const visibility = searchParams.get('visibility'); // public, family, private
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build all conditions upfront
    const whereConditions = [eq(recipes.userId, currentUser.id)];
    
    if (status) {
      whereConditions.push(eq(recipes.status, status as any));
    }
    
    if (visibility) {
      whereConditions.push(eq(recipes.visibility, visibility as any));
    }

    // Build complete query
    const query = db
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
        visibility: recipes.visibility,
        status: recipes.status,
        createdAt: recipes.createdAt,
        updatedAt: recipes.updatedAt,
      })
      .from(recipes)
      .where(and(...whereConditions))
      .orderBy(desc(recipes.updatedAt))
      .limit(limit)
      .offset(offset);

    const userRecipes = await query;

    return NextResponse.json({
      recipes: userRecipes,
      pagination: {
        limit,
        offset,
        hasMore: userRecipes.length === limit,
      },
    });
  } catch (error) {
    console.error('Get user recipes error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/recipes - Create new recipe
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const currentUser = await requireAuth();

    const body = await request.json();
    
    // Validate request body
    const validationResult = createRecipeSchema.safeParse(body);
    if (!validationResult.success) {
      console.error('Recipe validation failed:', validationResult.error.errors);
      console.error('Request body:', JSON.stringify(body, null, 2));
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.errors,
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // TODO: Validate family group access if familyGroupId is provided

    // Calculate ready time if not provided
    const readyInMinutes = data.prepTimeMinutes && data.cookTimeMinutes 
      ? data.prepTimeMinutes + data.cookTimeMinutes 
      : data.cookTimeMinutes || data.prepTimeMinutes || null;

    console.log('Creating recipe with data:', {
      title: data.title,
      userId: currentUser.id,
      status: data.status,
      visibility: data.visibility,
      sourceType: 'user'
    });

    // Create recipe
    const [newRecipe] = await db
      .insert(recipes)
      .values({
        title: data.title,
        description: data.description || null,
        summary: data.summary || null,
        userId: currentUser.id,
        familyGroupId: data.familyGroupId || null,
        
        // Source tracking
        sourceType: 'user',
        
        // Timing
        prepTimeMinutes: data.prepTimeMinutes || null,
        cookTimeMinutes: data.cookTimeMinutes || null,
        readyInMinutes,
        servings: data.servings,
        
        // Media
        imageUrl: data.imageUrl || null,
        mediaUrls: data.mediaUrls,
        
        // Health metrics
        difficulty: data.difficulty || null,
        healthScore: null, // Could be calculated based on ingredients
        
        // Dietary flags
        isVegetarian: data.isVegetarian,
        isVegan: data.isVegan,
        isGlutenFree: data.isGlutenFree,
        isDairyFree: data.isDairyFree,
        ketogenic: data.ketogenic,
        whole30: data.whole30,
        fodmapFriendly: data.fodmapFriendly,
        
        // Categorization
        tags: data.tags,
        dishTypes: data.dishTypes,
        diets: data.diets,
        occasions: data.occasions,
        cuisine: data.cuisine || null,
        
        // Recipe content
        ingredients: data.ingredients,
        instructions: data.instructions,
        equipment: data.equipment,
        
        // Visibility and status
        visibility: data.visibility,
        status: data.status,
      })
      .returning();

    console.log('Recipe created successfully:', {
      id: newRecipe.id,
      title: newRecipe.title,
      userId: newRecipe.userId,
      status: newRecipe.status,
      visibility: newRecipe.visibility
    });

    return NextResponse.json(
      {
        message: 'Recipe created successfully',
        recipe: newRecipe,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create recipe error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}