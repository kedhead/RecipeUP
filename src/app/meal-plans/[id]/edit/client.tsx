'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '../../../../components/layouts/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import Link from 'next/link';
import { format, addDays } from 'date-fns';

interface Meal {
  recipeId?: string;
  recipeName?: string;
  notes?: string;
  servings?: number;
}

interface MealPlan {
  id: string;
  name: string;
  weekStartDate: string;
  weekEndDate: string;
  meals: {
    [day: string]: {
      [mealType: string]: Meal;
    };
  };
  notes?: string;
  familyGroup: {
    id: string;
    name: string;
  };
  creator: {
    id: string;
    username: string;
    firstName?: string;
    lastName?: string;
  };
  isOwner: boolean;
  isActive: boolean;
  createdAt: string;
}

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

export function MealPlanEditClient({ user, mealPlanId }: { user: any; mealPlanId: string }) {
  const router = useRouter();
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [meals, setMeals] = useState<{ [day: string]: { [mealType: string]: Meal } }>({});
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    loadMealPlan();
  }, [mealPlanId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMealPlan = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/meal-plans/${mealPlanId}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const plan = data.mealPlan;
        
        if (!plan.isOwner) {
          alert('You can only edit your own meal plans.');
          router.push(`/meal-plans/${mealPlanId}`);
          return;
        }
        
        setMealPlan(plan);
        setName(plan.name);
        setNotes(plan.notes || '');
        setMeals(plan.meals || {});
        setIsActive(plan.isActive);
      } else if (response.status === 404) {
        alert('Meal plan not found.');
        router.push('/meal-plans');
      } else {
        throw new Error('Failed to load meal plan');
      }
    } catch (error) {
      console.error('Failed to load meal plan:', error);
      alert('Failed to load meal plan.');
      router.push('/meal-plans');
    } finally {
      setLoading(false);
    }
  };

  const updateMeal = (day: string, mealType: string, field: keyof Meal, value: string | number) => {
    setMeals(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [mealType]: {
          ...prev[day]?.[mealType],
          [field]: value || undefined,
        }
      }
    }));
  };

  const clearMeal = (day: string, mealType: string) => {
    setMeals(prev => {
      const newMeals = { ...prev };
      if (newMeals[day]) {
        delete newMeals[day][mealType];
        if (Object.keys(newMeals[day]).length === 0) {
          delete newMeals[day];
        }
      }
      return newMeals;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Please enter a meal plan name.');
      return;
    }

    try {
      setSaving(true);
      
      const response = await fetch(`/api/meal-plans/${mealPlanId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          notes: notes.trim() || undefined,
          meals,
          isActive,
        }),
      });

      if (response.ok) {
        router.push(`/meal-plans/${mealPlanId}`);
      } else {
        const error = await response.json();
        alert(`Failed to update meal plan: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to update meal plan:', error);
      alert('Failed to update meal plan. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this meal plan? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/meal-plans/${mealPlanId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        router.push('/meal-plans');
      } else {
        const error = await response.json();
        alert(`Failed to delete meal plan: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to delete meal plan:', error);
      alert('Failed to delete meal plan. Please try again.');
    }
  };

  const getDayName = (dayKey: string) => {
    return dayKey.charAt(0).toUpperCase() + dayKey.slice(1);
  };

  const getMealTypeEmoji = (mealType: string) => {
    switch (mealType) {
      case 'breakfast': return '🌅';
      case 'lunch': return '🌞';
      case 'dinner': return '🌙';
      case 'snack': return '🍎';
      default: return '🍽️';
    }
  };

  const formatMealTypeName = (mealType: string) => {
    return mealType.charAt(0).toUpperCase() + mealType.slice(1);
  };

  const getDayDate = (dayKey: string, weekStart: string) => {
    const dayIndex = DAYS_OF_WEEK.indexOf(dayKey);
    const startDate = new Date(weekStart);
    return addDays(startDate, dayIndex);
  };

  if (loading) {
    return (
      <DashboardLayout user={user}>
        <div className="text-center py-12">
          <div className="text-gray-600">Loading meal plan...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!mealPlan) {
    return (
      <DashboardLayout user={user}>
        <div className="text-center py-12">
          <div className="text-gray-600 mb-4">Meal plan not found.</div>
          <Link href="/meal-plans">
            <Button>Back to Meal Plans</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={user}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href={`/meal-plans/${mealPlan.id}`}>
            <Button variant="outline" size="sm">← Back to Meal Plan</Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">Edit Meal Plan</h1>
            <p className="text-gray-600 mt-1">
              {format(new Date(mealPlan.weekStartDate), 'MMM dd')} - {format(new Date(mealPlan.weekEndDate), 'MMM dd, yyyy')}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleDelete}
            className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
          >
            🗑️ Delete Plan
          </Button>
        </div>

        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>📝 Plan Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Plan Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="e.g., Week of Jan 15, 2024"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                placeholder="Any notes about this meal plan..."
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                Active meal plan
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Weekly Meal Grid */}
        <Card>
          <CardHeader>
            <CardTitle>📅 Plan Your Meals</CardTitle>
            <CardDescription>
              Click on any meal slot to add or edit meals for the week
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
              {DAYS_OF_WEEK.map(day => (
                <div key={day} className="border rounded-lg p-4">
                  <div className="font-semibold text-center mb-3 text-brand-600 border-b pb-2">
                    <div>{getDayName(day)}</div>
                    <div className="text-xs text-gray-500 font-normal">
                      {format(getDayDate(day, mealPlan.weekStartDate), 'MMM dd')}
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {MEAL_TYPES.map(mealType => {
                      const meal = meals[day]?.[mealType] || {};
                      
                      return (
                        <div key={mealType} className="border rounded p-3 bg-gray-50">
                          <div className="font-medium text-sm text-gray-700 mb-2">
                            {getMealTypeEmoji(mealType)} {formatMealTypeName(mealType)}
                          </div>
                          
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={meal.recipeName || ''}
                              onChange={(e) => updateMeal(day, mealType, 'recipeName', e.target.value)}
                              placeholder="Recipe or meal name"
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-brand-500 focus:border-transparent"
                            />
                            
                            <input
                              type="number"
                              value={meal.servings || ''}
                              onChange={(e) => updateMeal(day, mealType, 'servings', parseInt(e.target.value) || '')}
                              placeholder="Servings"
                              min="1"
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-brand-500 focus:border-transparent"
                            />
                            
                            <textarea
                              value={meal.notes || ''}
                              onChange={(e) => updateMeal(day, mealType, 'notes', e.target.value)}
                              placeholder="Notes (optional)"
                              rows={2}
                              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-brand-500 focus:border-transparent resize-none"
                            />
                            
                            {(meal.recipeName || meal.servings || meal.notes) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => clearMeal(day, mealType)}
                                className="w-full text-xs h-6"
                              >
                                Clear
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4 justify-end">
          <Link href={`/meal-plans/${mealPlan.id}`}>
            <Button variant="outline" disabled={saving}>
              Cancel
            </Button>
          </Link>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}