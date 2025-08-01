/**
 * Spoonacular API Integration Service
 * Clean, modern implementation with proper error handling and caching
 */

import { Recipe, NewRecipe } from '@/lib/db/schema';

// ============================================================================
// Types
// ============================================================================

export interface SpoonacularRecipe {
  id: number;
  title: string;
  summary: string;
  readyInMinutes: number;
  servings: number;
  sourceUrl: string;
  image: string;
  imageType: string;
  preparationMinutes?: number;
  cookingMinutes?: number;
  aggregateLikes: number;
  healthScore: number;
  creditsText?: string;
  sourceName?: string;
  pricePerServing: number;
  
  // Dietary flags
  vegetarian: boolean;
  vegan: boolean;
  glutenFree: boolean;
  dairyFree: boolean;
  veryHealthy: boolean;
  cheap: boolean;
  veryPopular: boolean;
  sustainable: boolean;
  lowFodmap: boolean;
  
  // Other properties
  weightWatcherSmartPoints?: number;
  gaps?: string;
  
  // Arrays
  dishTypes: string[];
  diets: string[];
  occasions?: string[];
  cuisines?: string[];
  
  // Ingredients
  extendedIngredients: Array<{
    id: number;
    aisle: string;
    image: string;
    consistency: string;
    name: string;
    nameClean: string;
    original: string;
    originalName: string;
    amount: number;
    unit: string;
    meta: string[];
    measures: {
      us: { amount: number; unitShort: string; unitLong: string };
      metric: { amount: number; unitShort: string; unitLong: string };
    };
  }>;
  
  // Instructions
  analyzedInstructions: Array<{
    name?: string;
    steps: Array<{
      number: number;
      step: string;
      ingredients: Array<{
        id: number;
        name: string;
        localizedName: string;
        image: string;
      }>;
      equipment: Array<{
        id: number;
        name: string;
        localizedName: string;
        image: string;
      }>;
      length?: { number: number; unit: string };
      temperature?: { number: number; unit: string };
    }>;
  }>;
  
  // Nutrition (if requested)
  nutrition?: {
    nutrients: Array<{
      name: string;
      amount: number;
      unit: string;
      percentOfDailyNeeds?: number;
    }>;
    properties: Array<{
      name: string;
      amount: number;
      unit: string;
    }>;
    flavonoids: Array<{
      name: string;
      amount: number;
      unit: string;
    }>;
    ingredients: Array<{
      id: number;
      name: string;
      amount: number;
      unit: string;
      nutrients: Array<{
        name: string;
        amount: number;
        unit: string;
        percentOfDailyNeeds?: number;
      }>;
    }>;
    caloricBreakdown: {
      percentProtein: number;
      percentFat: number;
      percentCarbs: number;
    };
    weightPerServing: {
      amount: number;
      unit: string;
    };
  };
  
  // Wine pairing
  winePairing?: {
    pairedWines: string[];
    pairingText: string;
    productMatches: Array<{
      id: number;
      title: string;
      description: string;
      price: string;
      imageUrl: string;
      averageRating: number;
      ratingCount: number;
      score: number;
      link: string;
    }>;
  };
  
  // Taste
  taste?: {
    sweetness: number;
    saltiness: number;
    sourness: number;
    bitterness: number;
    savoriness: number;
    fattiness: number;
    spiciness: number;
  };
}

export interface SpoonacularSearchResponse {
  results: SpoonacularRecipe[];
  offset: number;
  number: number;
  totalResults: number;
}

export interface SpoonacularSearchParams {
  query?: string;
  cuisine?: string;
  diet?: string;
  intolerances?: string;
  equipment?: string;
  includeIngredients?: string;
  excludeIngredients?: string;
  type?: string;
  instructionsRequired?: boolean;
  fillIngredients?: boolean;
  addRecipeInformation?: boolean;
  addRecipeNutrition?: boolean;
  maxReadyTime?: number;
  number?: number;
  offset?: number;
  sort?: 'meta-score' | 'popularity' | 'healthiness' | 'price' | 'time' | 'random';
  sortDirection?: 'asc' | 'desc';
}

// ============================================================================
// Spoonacular Service Class
// ============================================================================

export class SpoonacularService {
  private apiKey: string;
  private baseUrl = 'https://api.spoonacular.com';
  private requestCount = 0;
  private dailyLimit = 150; // Free tier
  private lastResetTime = Date.now();

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.SPOONACULAR_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('SPOONACULAR_API_KEY environment variable is required');
    }
  }

  // ============================================================================
  // HTTP Client
  // ============================================================================

  private async makeRequest<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    // Rate limiting check
    this.checkRateLimit();

    // Build URL
    const url = new URL(`${this.baseUrl}${endpoint}`);
    params.apiKey = this.apiKey;

    // Add params to URL
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          url.searchParams.append(key, value.join(','));
        } else {
          url.searchParams.append(key, String(value));
        }
      }
    });

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'User-Agent': 'RecipeUp/2.0.0',
          'Accept': 'application/json',
        },
      });

      if (response.status === 429) {
        throw new Error('Rate limit exceeded');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorData?.message || 'Unknown error'}`);
      }

      this.requestCount++;
      return await response.json();
    } catch (error) {
      console.error('Spoonacular API error:', error);
      throw error;
    }
  }

  private checkRateLimit(): void {
    const now = Date.now();
    const timeSinceReset = now - this.lastResetTime;
    
    // Reset counter daily
    if (timeSinceReset > 24 * 60 * 60 * 1000) {
      this.requestCount = 0;
      this.lastResetTime = now;
    }
    
    if (this.requestCount >= this.dailyLimit) {
      throw new Error('Daily rate limit exceeded');
    }
  }

  // ============================================================================
  // API Methods
  // ============================================================================

  async searchRecipes(params: SpoonacularSearchParams): Promise<SpoonacularSearchResponse> {
    const searchParams = {
      ...params,
      addRecipeInformation: true,
      fillIngredients: true,
      number: params.number || 12,
      offset: params.offset || 0,
    };

    return this.makeRequest<SpoonacularSearchResponse>('/recipes/complexSearch', searchParams);
  }

  async getRecipeInformation(id: number, includeNutrition = true): Promise<SpoonacularRecipe> {
    return this.makeRequest<SpoonacularRecipe>(`/recipes/${id}/information`, {
      includeNutrition,
    });
  }

  async getRandomRecipes(count = 1, tags?: string): Promise<{ recipes: SpoonacularRecipe[] }> {
    return this.makeRequest<{ recipes: SpoonacularRecipe[] }>('/recipes/random', {
      number: count,
      tags,
    });
  }

  // ============================================================================
  // Data Transformation
  // ============================================================================

  transformToRecipe(spoonRecipe: SpoonacularRecipe, userId: string, familyGroupId?: string): NewRecipe {
    return {
      title: spoonRecipe.title,
      description: this.stripHtml(spoonRecipe.summary),
      summary: this.truncateText(this.stripHtml(spoonRecipe.summary), 200),
      userId,
      familyGroupId: familyGroupId || null,
      
      // Source tracking
      spoonacularId: spoonRecipe.id,
      sourceType: 'spoonacular',
      sourceUrl: spoonRecipe.sourceUrl,
      
      // Timing
      prepTimeMinutes: spoonRecipe.preparationMinutes || null,
      cookTimeMinutes: spoonRecipe.cookingMinutes || null,
      readyInMinutes: spoonRecipe.readyInMinutes,
      servings: spoonRecipe.servings,
      
      // Media
      imageUrl: spoonRecipe.image,
      mediaUrls: spoonRecipe.image ? [spoonRecipe.image] : [],
      
      // Health metrics
      healthScore: spoonRecipe.healthScore,
      pricePerServing: (spoonRecipe.pricePerServing / 100).toString(), // Convert cents to dollars
      
      // Dietary flags
      isVegetarian: spoonRecipe.vegetarian,
      isVegan: spoonRecipe.vegan,
      isGlutenFree: spoonRecipe.glutenFree,
      isDairyFree: spoonRecipe.dairyFree,
      isVeryHealthy: spoonRecipe.veryHealthy,
      isCheap: spoonRecipe.cheap,
      isVeryPopular: spoonRecipe.veryPopular,
      isSustainable: spoonRecipe.sustainable,
      
      // Special diets
      weightWatcherSmartPoints: spoonRecipe.weightWatcherSmartPoints || null,
      gaps: (spoonRecipe.gaps as any) || null,
      fodmapFriendly: spoonRecipe.lowFodmap,
      ketogenic: spoonRecipe.diets?.includes('ketogenic') || false,
      whole30: spoonRecipe.diets?.includes('whole 30') || false,
      
      // Categorization
      tags: this.extractTags(spoonRecipe),
      dishTypes: spoonRecipe.dishTypes || [],
      diets: spoonRecipe.diets || [],
      occasions: spoonRecipe.occasions || [],
      cuisine: spoonRecipe.cuisines?.[0] || null,
      
      // Recipe content
      ingredients: this.transformIngredients(spoonRecipe.extendedIngredients || []),
      instructions: this.transformInstructions(spoonRecipe.analyzedInstructions || []),
      equipment: this.transformEquipment(spoonRecipe.analyzedInstructions || []),
      
      // Additional data
      winePairing: spoonRecipe.winePairing || null,
      taste: spoonRecipe.taste || null,
      nutrition: this.transformNutrition(spoonRecipe.nutrition),
      
      // Defaults
      visibility: 'public',
      status: 'published',
    };
  }

  private transformIngredients(ingredients: SpoonacularRecipe['extendedIngredients']) {
    return ingredients.map(ingredient => ({
      name: ingredient.nameClean || ingredient.name,
      amount: ingredient.amount.toString(),
      unit: ingredient.measures.us.unitShort,
      notes: ingredient.original,
      category: ingredient.aisle?.toLowerCase() || 'pantry',
    }));
  }

  private transformInstructions(instructions: SpoonacularRecipe['analyzedInstructions']) {
    const steps: Array<{
      step: number;
      instruction: string;
      time?: number;
      temperature?: { value: number; unit: 'F' | 'C' };
    }> = [];

    instructions.forEach(instructionGroup => {
      instructionGroup.steps.forEach(step => {
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

  private transformEquipment(instructions: SpoonacularRecipe['analyzedInstructions']) {
    const equipmentSet = new Set<string>();
    const equipment: Array<{
      name: string;
      imageUrl?: string;
      spoonacularId?: number;
    }> = [];

    instructions.forEach(instructionGroup => {
      instructionGroup.steps.forEach(step => {
        step.equipment?.forEach(eq => {
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

  private transformNutrition(nutrition?: SpoonacularRecipe['nutrition']) {
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
    
    nutrition.nutrients.forEach(nutrient => {
      const key = nutritionMap[nutrient.name];
      if (key) {
        result[key] = nutrient.amount;
      }
    });

    return result;
  }

  private extractTags(recipe: SpoonacularRecipe): string[] {
    const tags: string[] = [];
    
    if (recipe.dishTypes) tags.push(...recipe.dishTypes);
    if (recipe.cuisines) tags.push(...recipe.cuisines);
    
    // Add time-based tags
    if (recipe.readyInMinutes <= 20) tags.push('quick');
    else if (recipe.readyInMinutes >= 60) tags.push('slow');
    
    // Add health tags
    if (recipe.veryHealthy) tags.push('healthy');
    if (recipe.cheap) tags.push('budget-friendly');
    if (recipe.veryPopular) tags.push('popular');
    if (recipe.sustainable) tags.push('sustainable');
    
    return Array.from(new Set(tags));
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).replace(/\s+\S*$/, '') + '...';
  }

  // ============================================================================
  // Status Methods
  // ============================================================================

  getStatus() {
    const remaining = Math.max(0, this.dailyLimit - this.requestCount);
    const resetTime = new Date(this.lastResetTime + 24 * 60 * 60 * 1000);
    
    return {
      requestCount: this.requestCount,
      remainingRequests: remaining,
      resetTime: resetTime.toISOString(),
      isHealthy: remaining > 0,
    };
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let spoonacularService: SpoonacularService | null = null;

export function getSpoonacularService(): SpoonacularService {
  if (!spoonacularService) {
    spoonacularService = new SpoonacularService();
  }
  return spoonacularService;
}