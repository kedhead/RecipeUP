'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/layouts/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import Link from 'next/link';

interface Recipe {
  id: string;
  title: string;
  description: string;
  summary: string;
  imageUrl: string;
  cookTimeMinutes?: number;
  prepTimeMinutes?: number;
  readyInMinutes: number;
  servings: number;
  healthScore: number;
  cuisine?: string;
  tags: string[];
  dishTypes: string[];
  diets: string[];
  isVegetarian: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  isDairyFree: boolean;
  sourceType: string;
  spoonacularId?: number;
  isFavorited?: boolean;
}

interface SearchResponse {
  recipes: Recipe[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
  source?: string;
}

function RecipeCard({ recipe, onFavorite }: { recipe: Recipe; onFavorite: (id: string) => void }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleFavorite = async () => {
    setIsLoading(true);
    try {
      await onFavorite(recipe.id);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="aspect-video relative bg-gray-100">
        {recipe.imageUrl ? (
          <img
            src={recipe.imageUrl}
            alt={recipe.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            🍳 No Image
          </div>
        )}
        <div className="absolute top-2 right-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleFavorite}
            isLoading={isLoading}
            className="bg-white/90 backdrop-blur-sm"
          >
            {recipe.isFavorited ? '❤️' : '🤍'}
          </Button>
        </div>
      </div>
      
      <CardHeader className="pb-2">
        <CardTitle className="text-lg line-clamp-2">{recipe.title}</CardTitle>
        <CardDescription className="line-clamp-2">
          {recipe.summary}
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-3">
          {recipe.isVegetarian && (
            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">🌱 Vegetarian</span>
          )}
          {recipe.isVegan && (
            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">🌿 Vegan</span>
          )}
          {recipe.isGlutenFree && (
            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">🌾 Gluten Free</span>
          )}
        </div>
        
        <div className="flex justify-between text-sm text-gray-600 mb-3">
          <span>⏱️ {recipe.readyInMinutes} min</span>
          <span>👥 {recipe.servings} servings</span>
          <span>💚 {recipe.healthScore}/100</span>
        </div>
        
        {recipe.cuisine && (
          <p className="text-xs text-gray-500 mb-2">🍽️ {recipe.cuisine}</p>
        )}
        
        <Link href={`/recipes/${recipe.spoonacularId || recipe.id.replace('spoon_', '')}`}>
          <Button className="w-full" size="sm">
            View Recipe
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

export function RecipesPageClient({ user }: { user: any }) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchActive, setSearchActive] = useState(false);

  useEffect(() => {
    loadInitialRecipes();
  }, []);

  const loadInitialRecipes = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/recipes/search?source=spoonacular&limit=12&query=healthy');
      if (response.ok) {
        const data: SearchResponse = await response.json();
        setRecipes(data.recipes);
      }
    } catch (error) {
      console.error('Failed to load recipes:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchRecipes = async (query: string) => {
    if (!query.trim()) {
      loadInitialRecipes();
      setSearchActive(false);
      return;
    }

    try {
      setLoading(true);
      setSearchActive(true);
      const response = await fetch(`/api/recipes/search?source=spoonacular&limit=12&query=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data: SearchResponse = await response.json();
        setRecipes(data.recipes);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFavorite = async (recipeId: string) => {
    try {
      // For Spoonacular recipes, extract the numeric ID
      const numericId = recipeId.startsWith('spoon_') ? recipeId.replace('spoon_', '') : recipeId;
      
      const response = await fetch(`/api/recipes/${numericId}/favorite/toggle`, {
        method: 'POST',
      });
      
      if (response.ok) {
        const data = await response.json();
        // Update the recipe in state with the actual favorite status from server
        setRecipes(prev => prev.map(recipe => 
          recipe.id === recipeId 
            ? { ...recipe, isFavorited: data.isFavorited }
            : recipe
        ));
      } else {
        console.error('Failed to toggle favorite:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchRecipes(searchQuery);
  };

  return (
    <DashboardLayout user={user}>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Recipes</h1>
          <p className="text-gray-600 mt-2">Discover and manage your favorite recipes</p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex gap-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search recipes (e.g., pasta, chicken, vegan)..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <Button type="submit" isLoading={loading}>
            Search
          </Button>
          {searchActive && (
            <Button 
              variant="outline" 
              onClick={() => {
                setSearchQuery('');
                loadInitialRecipes();
              }}
            >
              Clear
            </Button>
          )}
        </form>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="text-gray-600">Loading delicious recipes...</div>
          </div>
        )}

        {/* Results */}
        {!loading && recipes.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {recipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                onFavorite={handleFavorite}
              />
            ))}
          </div>
        )}

        {/* No Results */}
        {!loading && recipes.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-600 mb-4">
              {searchActive ? 'No recipes found for your search.' : 'No recipes available.'}
            </div>
            <Button onClick={loadInitialRecipes}>
              Load Popular Recipes
            </Button>
          </div>
        )}

        {/* Success Banner */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-900 mb-2">
            🎉 Recipe Search Live!
          </h3>
          <p className="text-green-800 text-sm">
            Recipe search is now powered by Spoonacular API with {recipes.length} recipes loaded. Search for ingredients, cuisines, or diet types!
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}