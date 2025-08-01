'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../components/layouts/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import Link from 'next/link';

interface RecipeDetail {
  id: string;
  title: string;
  summary: string;
  readyInMinutes: number;
  servings: number;
  sourceUrl?: string;
  imageUrl: string;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  healthScore: number;
  pricePerServing: string;
  
  // Dietary flags
  isVegetarian: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  isDairyFree: boolean;
  isVeryHealthy: boolean;
  isCheap: boolean;
  isVeryPopular: boolean;
  isSustainable: boolean;
  
  // Arrays
  dishTypes: string[];
  diets: string[];
  cuisine?: string;
  
  // Ingredients and Instructions (transformed format)
  ingredients: Array<{
    name: string;
    amount: string;
    unit: string;
    notes: string;
    category: string;
  }>;
  
  instructions: Array<{
    step: number;
    instruction: string;
    time?: number;
    temperature?: { value: number; unit: 'F' | 'C' };
  }>;
  
  // Additional fields
  isFavorited?: boolean;
  stats?: {
    averageRating: number | null;
    reviewCount: number;
    favoriteCount: number;
  };
  
  // Nutrition (if available)
  nutrition?: Record<string, number>;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

export function RecipeDetailClient({ user, recipeId }: { user: any; recipeId: string }) {
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);

  useEffect(() => {
    loadRecipe();
  }, [recipeId]);

  const loadRecipe = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // For Spoonacular recipes, we need to fetch from Spoonacular API
      const response = await fetch(`/api/recipes/${recipeId}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to load recipe');
      }
      
      const data = await response.json();
      setRecipe(data.recipe);
      setIsFavorited(data.recipe.isFavorited || false);
    } catch (error) {
      console.error('Failed to load recipe:', error);
      setError('Failed to load recipe. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFavorite = async () => {
    try {
      const response = await fetch(`/api/recipes/${recipeId}/favorite/toggle`, {
        method: 'POST',
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setIsFavorited(data.isFavorited);
      } else {
        const errorData = await response.json().catch(() => null);
        console.error('Failed to toggle favorite:', {
          status: response.status,
          statusText: response.statusText,
          errorData
        });
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  if (loading) {
    return (
      <DashboardLayout user={user}>
        <div className="text-center py-12">
          <div className="text-gray-600">Loading recipe...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !recipe) {
    return (
      <DashboardLayout user={user}>
        <div className="text-center py-12">
          <div className="text-red-600 mb-4">{error || 'Recipe not found'}</div>
          <Link href="/recipes">
            <Button>Back to Recipes</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const nutritionEntries = recipe.nutrition ? Object.entries(recipe.nutrition).filter(([key, value]) =>
    ['calories', 'fat', 'carbohydrates', 'protein', 'fiber', 'sugar'].includes(key) && value > 0
  ) : [];

  return (
    <DashboardLayout user={user}>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/recipes">
            <Button variant="outline" size="sm">← Back to Recipes</Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={handleFavorite}
            className="ml-auto"
          >
            {isFavorited ? '❤️ Favorited' : '🤍 Add to Favorites'}
          </Button>
        </div>

        {/* Recipe Header */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">{recipe.title}</h1>
            
            {recipe.summary && (
              <p className="text-gray-600 mb-6">
                {stripHtml(recipe.summary)}
              </p>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-900">⏱️ {recipe.readyInMinutes}</div>
                <div className="text-sm text-blue-600">minutes</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-900">👥 {recipe.servings}</div>
                <div className="text-sm text-green-600">servings</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-purple-900">💚 {recipe.healthScore}</div>
                <div className="text-sm text-purple-600">health score</div>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-orange-900">❤️ {recipe.stats?.favoriteCount || 0}</div>
                <div className="text-sm text-orange-600">favorites</div>
              </div>
            </div>

            {/* Dietary Tags */}
            <div className="flex flex-wrap gap-2 mb-6">
              {recipe.isVegetarian && (
                <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">🌱 Vegetarian</span>
              )}
              {recipe.isVegan && (
                <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">🌿 Vegan</span>
              )}
              {recipe.isGlutenFree && (
                <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">🌾 Gluten Free</span>
              )}
              {recipe.isDairyFree && (
                <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">🥛 Dairy Free</span>
              )}
              {recipe.isVeryHealthy && (
                <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full">💪 Very Healthy</span>
              )}
              {recipe.isCheap && (
                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm rounded-full">💰 Budget Friendly</span>
              )}
            </div>
          </div>

          {/* Recipe Image */}
          <div>
            <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
              {recipe.imageUrl ? (
                <img
                  src={recipe.imageUrl}
                  alt={recipe.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl">
                  🍳
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Ingredients */}
        <Card>
          <CardHeader>
            <CardTitle>📝 Ingredients</CardTitle>
            <CardDescription>Everything you&apos;ll need</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recipe.ingredients?.map((ingredient, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-12 h-12 bg-green-100 rounded flex items-center justify-center text-green-600 font-bold">
                    🥄
                  </div>
                  <div>
                    <div className="font-medium">{ingredient.name}</div>
                    <div className="text-sm text-gray-600">{ingredient.notes}</div>
                    <div className="text-xs text-gray-500">{ingredient.amount} {ingredient.unit}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>👨‍🍳 Instructions</CardTitle>
            <CardDescription>Step by step cooking guide</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recipe.instructions?.map((step, index) => (
                <div key={index} className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center font-bold">
                    {step.step}
                  </div>
                  <div className="flex-grow">
                    <p className="text-gray-700">{step.instruction}</p>
                    {step.time && (
                      <div className="mt-2 text-sm text-gray-500">
                        ⏱️ {step.time} minutes
                      </div>
                    )}
                    {step.temperature && (
                      <div className="mt-1 text-sm text-gray-500">
                        🌡️ {step.temperature.value}°{step.temperature.unit}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Nutrition */}
        {nutritionEntries.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>📊 Nutrition (per serving)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {nutritionEntries.map(([name, value], index) => (
                  <div key={index} className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="font-bold text-lg">{Math.round(value as number)}</div>
                    <div className="text-sm text-gray-600 capitalize">{name}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Source Link */}
        {recipe.sourceUrl && (
          <div className="text-center">
            <a
              href={recipe.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800"
            >
              🔗 View Original Recipe
            </a>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}