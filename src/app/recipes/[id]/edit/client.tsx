'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '../../../../components/layouts/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import Link from 'next/link';

interface Ingredient {
  name: string;
  amount: string;
  unit: string;
  notes: string;
}

interface Instruction {
  step: number;
  instruction: string;
  time?: number;
}

interface Recipe {
  id: string;
  title: string;
  description: string;
  summary: string;
  imageUrl: string;
  servings: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  cuisine?: string;
  isVegetarian: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  isDairyFree: boolean;
  ingredients: Ingredient[];
  instructions: Instruction[];
  tags: string[];
  visibility: string;
  status: string;
}

export function EditRecipeClient({ user, recipeId }: { user: any; recipeId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [servings, setServings] = useState(4);
  const [prepTimeMinutes, setPrepTimeMinutes] = useState('');
  const [cookTimeMinutes, setCookTimeMinutes] = useState('');
  const [difficulty, setDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD'>('MEDIUM');
  const [cuisine, setCuisine] = useState('');
  
  // Dietary flags
  const [isVegetarian, setIsVegetarian] = useState(false);
  const [isVegan, setIsVegan] = useState(false);
  const [isGlutenFree, setIsGlutenFree] = useState(false);
  const [isDairyFree, setIsDairyFree] = useState(false);
  
  // Ingredients and instructions
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { name: '', amount: '', unit: '', notes: '' }
  ]);
  const [instructions, setInstructions] = useState<Instruction[]>([
    { step: 1, instruction: '' }
  ]);
  
  // Tags
  const [tags, setTags] = useState('');

  // Load recipe data
  useEffect(() => {
    loadRecipe();
  }, [recipeId]);

  const loadRecipe = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/recipes/${recipeId}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const recipe = data.recipe;
        
        // Check if user owns this recipe
        if (recipe.userId !== user.id) {
          alert('You can only edit your own recipes.');
          router.push('/recipes');
          return;
        }

        // Check if this is a Spoonacular recipe (can't edit external recipes)
        if (/^\d+$/.test(recipeId)) {
          alert('Cannot edit external recipes.');
          router.push('/recipes');
          return;
        }
        
        setRecipe(recipe);
        
        // Populate form fields
        setTitle(recipe.title || '');
        setDescription(recipe.description || '');
        setImageUrl(recipe.imageUrl || '');
        setServings(recipe.servings || 4);
        setPrepTimeMinutes(recipe.prepTimeMinutes?.toString() || '');
        setCookTimeMinutes(recipe.cookTimeMinutes?.toString() || '');
        setDifficulty(recipe.difficulty || 'MEDIUM');
        setCuisine(recipe.cuisine || '');
        setIsVegetarian(recipe.isVegetarian || false);
        setIsVegan(recipe.isVegan || false);
        setIsGlutenFree(recipe.isGlutenFree || false);
        setIsDairyFree(recipe.isDairyFree || false);
        setIngredients(recipe.ingredients?.length > 0 ? recipe.ingredients : [{ name: '', amount: '', unit: '', notes: '' }]);
        setInstructions(recipe.instructions?.length > 0 ? recipe.instructions : [{ step: 1, instruction: '' }]);
        setTags(recipe.tags?.join(', ') || '');
      } else {
        alert('Failed to load recipe.');
        router.push('/recipes');
      }
    } catch (error) {
      console.error('Error loading recipe:', error);
      alert('Failed to load recipe.');
      router.push('/recipes');
    } finally {
      setIsLoading(false);
    }
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { name: '', amount: '', unit: '', notes: '' }]);
  };
  
  const removeIngredient = (index: number) => {
    if (ingredients.length > 1) {
      setIngredients(ingredients.filter((_, i) => i !== index));
    }
  };
  
  const updateIngredient = (index: number, field: keyof Ingredient, value: string) => {
    const updated = [...ingredients];
    updated[index] = { ...updated[index], [field]: value };
    setIngredients(updated);
  };
  
  const addInstruction = () => {
    setInstructions([...instructions, { step: instructions.length + 1, instruction: '' }]);
  };
  
  const removeInstruction = (index: number) => {
    if (instructions.length > 1) {
      const updated = instructions.filter((_, i) => i !== index);
      // Renumber steps
      updated.forEach((inst, i) => { inst.step = i + 1; });
      setInstructions(updated);
    }
  };
  
  const updateInstruction = (index: number, field: keyof Instruction, value: string | number) => {
    const updated = [...instructions];
    updated[index] = { ...updated[index], [field]: value };
    setInstructions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const readyInMinutes = (parseInt(prepTimeMinutes) || 0) + (parseInt(cookTimeMinutes) || 0);
      
      const recipeData = {
        title,
        description,
        summary: description, // Use description as summary for now
        imageUrl: imageUrl || null,
        servings,
        prepTimeMinutes: parseInt(prepTimeMinutes) || null,
        cookTimeMinutes: parseInt(cookTimeMinutes) || null,
        readyInMinutes,
        difficulty,
        cuisine: cuisine || null,
        isVegetarian,
        isVegan,
        isGlutenFree,
        isDairyFree,
        ingredients: ingredients.filter(ing => ing.name.trim()),
        instructions: instructions.filter(inst => inst.instruction.trim()),
        tags: tags ? tags.split(',').map(tag => tag.trim()).filter(Boolean) : [],
        dishTypes: [], // Could be enhanced later
        diets: [], // Could be enhanced later
      };
      
      const response = await fetch(`/api/recipes/${recipeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(recipeData),
      });
      
      if (response.ok) {
        router.push(`/recipes/${recipeId}`);
      } else {
        const error = await response.json();
        console.error('Failed to update recipe:', error);
        alert('Failed to update recipe. Please try again.');
      }
    } catch (error) {
      console.error('Error updating recipe:', error);
      alert('Failed to update recipe. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this recipe? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/recipes/${recipeId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        router.push('/recipes');
      } else {
        const error = await response.json();
        console.error('Failed to delete recipe:', error);
        alert('Failed to delete recipe. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting recipe:', error);
      alert('Failed to delete recipe. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout user={user}>
        <div className="text-center py-12">
          <div className="text-gray-600">Loading recipe...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!recipe) {
    return (
      <DashboardLayout user={user}>
        <div className="text-center py-12">
          <div className="text-gray-600">Recipe not found.</div>
          <Link href="/recipes">
            <Button className="mt-4">Back to Recipes</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={user}>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href={`/recipes/${recipeId}`}>
            <Button variant="outline" size="sm">← Back to Recipe</Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">Edit Recipe</h1>
            <p className="text-gray-600 mt-1">Update your recipe details</p>
          </div>
          <Button
            variant="outline"
            onClick={handleDelete}
            className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
          >
            🗑️ Delete Recipe
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>📝 Basic Information</CardTitle>
              <CardDescription>Update your recipe details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recipe Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Grandma's Chocolate Chip Cookies"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Brief description of your recipe..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Image URL (optional)
                </label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://example.com/recipe-image.jpg"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Servings *
                  </label>
                  <input
                    type="number"
                    value={servings}
                    onChange={(e) => setServings(parseInt(e.target.value) || 1)}
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prep Time (min)
                  </label>
                  <input
                    type="number"
                    value={prepTimeMinutes}
                    onChange={(e) => setPrepTimeMinutes(e.target.value)}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="15"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cook Time (min)
                  </label>
                  <input
                    type="number"
                    value={cookTimeMinutes}
                    onChange={(e) => setCookTimeMinutes(e.target.value)}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="30"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Difficulty
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as 'EASY' | 'MEDIUM' | 'HARD')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cuisine Type
                  </label>
                  <input
                    type="text"
                    value={cuisine}
                    onChange={(e) => setCuisine(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Italian, Mexican, Asian"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="dessert, chocolate, cookies"
                  />
                </div>
              </div>
              
              {/* Dietary Flags */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dietary Options
                </label>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={isVegetarian}
                      onChange={(e) => setIsVegetarian(e.target.checked)}
                      className="mr-2"
                    />
                    🌱 Vegetarian
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={isVegan}
                      onChange={(e) => setIsVegan(e.target.checked)}
                      className="mr-2"
                    />
                    🌿 Vegan
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={isGlutenFree}
                      onChange={(e) => setIsGlutenFree(e.target.checked)}
                      className="mr-2"
                    />
                    🌾 Gluten Free
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={isDairyFree}
                      onChange={(e) => setIsDairyFree(e.target.checked)}
                      className="mr-2"
                    />
                    🥛 Dairy Free
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ingredients */}
          <Card>
            <CardHeader>
              <CardTitle>🥄 Ingredients</CardTitle>
              <CardDescription>Update your ingredient list</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {ingredients.map((ingredient, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                  <div className="md:col-span-4">
                    <input
                      type="text"
                      value={ingredient.name}
                      onChange={(e) => updateIngredient(index, 'name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ingredient name"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <input
                      type="text"
                      value={ingredient.amount}
                      onChange={(e) => updateIngredient(index, 'amount', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Amount"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <input
                      type="text"
                      value={ingredient.unit}
                      onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Unit"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <input
                      type="text"
                      value={ingredient.notes}
                      onChange={(e) => updateIngredient(index, 'notes', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Notes (optional)"
                    />
                  </div>
                  <div className="md:col-span-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeIngredient(index)}
                      disabled={ingredients.length === 1}
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addIngredient}>
                + Add Ingredient
              </Button>
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>👨‍🍳 Instructions</CardTitle>
              <CardDescription>Update your cooking instructions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {instructions.map((instruction, index) => (
                <div key={index} className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center font-bold text-sm">
                    {instruction.step}
                  </div>
                  <div className="flex-grow">
                    <textarea
                      value={instruction.instruction}
                      onChange={(e) => updateInstruction(index, 'instruction', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={`Step ${instruction.step} instructions...`}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeInstruction(index)}
                    disabled={instructions.length === 1}
                  >
                    ✕
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" onClick={addInstruction}>
                + Add Step
              </Button>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <Link href={`/recipes/${recipeId}`}>
              <Button variant="outline" disabled={isSubmitting}>
                Cancel
              </Button>
            </Link>
            <Button type="submit" isLoading={isSubmitting}>
              Update Recipe
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}