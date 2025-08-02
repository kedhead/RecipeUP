'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '../../../components/layouts/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
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

export function CreateRecipeClient({ user }: { user: any }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Basic recipe info
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
  
  // Ingredients
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { name: '', amount: '', unit: '', notes: '' }
  ]);
  
  // Instructions
  const [instructions, setInstructions] = useState<Instruction[]>([
    { step: 1, instruction: '' }
  ]);
  
  // Tags
  const [tags, setTags] = useState('');
  
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
      const prepTime = parseInt(prepTimeMinutes) || 0;
      const cookTime = parseInt(cookTimeMinutes) || 0;
      const readyInMinutes = prepTime + cookTime || null; // If both are 0, send null
      
      const recipeData = {
        title,
        description,
        summary: description, // Use description as summary for now
        imageUrl: imageUrl || null,
        servings,
        prepTimeMinutes: prepTime || null,
        cookTimeMinutes: cookTime || null,
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
        visibility: 'public',
        status: 'published',
      };
      
      const response = await fetch('/api/recipes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(recipeData),
      });
      
      if (response.ok) {
        const result = await response.json();
        router.push(`/recipes/${result.recipe.id}`);
      } else {
        const error = await response.json();
        console.error('Failed to create recipe:', error);
        alert('Failed to create recipe. Please try again.');
      }
    } catch (error) {
      console.error('Error creating recipe:', error);
      alert('Failed to create recipe. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout user={user}>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/recipes">
            <Button variant="outline" size="sm">← Back to Recipes</Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Create New Recipe</h1>
            <p className="text-gray-600 mt-1">Share your favorite recipe with the community</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>📝 Basic Information</CardTitle>
              <CardDescription>Tell us about your recipe</CardDescription>
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
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
              <CardDescription>List all ingredients with measurements</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {ingredients.map((ingredient, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                  <div className="md:col-span-4">
                    <input
                      type="text"
                      value={ingredient.name}
                      onChange={(e) => updateIngredient(index, 'name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      placeholder="Ingredient name"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <input
                      type="text"
                      value={ingredient.amount}
                      onChange={(e) => updateIngredient(index, 'amount', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      placeholder="Amount"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <input
                      type="text"
                      value={ingredient.unit}
                      onChange={(e) => updateIngredient(index, 'unit', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      placeholder="Unit"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <input
                      type="text"
                      value={ingredient.notes}
                      onChange={(e) => updateIngredient(index, 'notes', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
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
              <CardDescription>Step-by-step cooking instructions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {instructions.map((instruction, index) => (
                <div key={index} className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-8 h-8 bg-brand-100 text-brand-800 rounded-full flex items-center justify-center font-bold text-sm">
                    {instruction.step}
                  </div>
                  <div className="flex-grow">
                    <textarea
                      value={instruction.instruction}
                      onChange={(e) => updateInstruction(index, 'instruction', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
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
            <Link href="/recipes">
              <Button variant="outline" disabled={isSubmitting}>
                Cancel
              </Button>
            </Link>
            <Button type="submit" isLoading={isSubmitting}>
              Create Recipe
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}