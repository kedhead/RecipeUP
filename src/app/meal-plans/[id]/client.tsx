'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '../../../components/layouts/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import Link from 'next/link';
import { format, addDays, startOfWeek } from 'date-fns';

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

export function MealPlanDetailClient({ user, mealPlanId }: { user: any; mealPlanId: string }) {
  const router = useRouter();
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(true);

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
        setMealPlan(data.mealPlan);
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
          <Link href="/meal-plans">
            <Button variant="outline" size="sm">← Back to Meal Plans</Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">{mealPlan.name}</h1>
            <p className="text-gray-600 mt-1">
              {format(new Date(mealPlan.weekStartDate), 'MMM dd')} - {format(new Date(mealPlan.weekEndDate), 'MMM dd, yyyy')}
            </p>
          </div>
          {mealPlan.isOwner && (
            <Link href={`/meal-plans/${mealPlan.id}/edit`}>
              <Button>✏️ Edit Plan</Button>
            </Link>
          )}
        </div>

        {/* Plan Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">👨‍👩‍👧‍👦 Family Group</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-semibold">{mealPlan.familyGroup.name}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">👤 Created By</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-semibold">
                {mealPlan.creator.firstName || mealPlan.creator.username}
              </div>
              <div className="text-sm text-gray-600">
                {format(new Date(mealPlan.createdAt), 'MMM dd, yyyy')}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">📊 Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`inline-flex px-2 py-1 rounded-full text-sm font-medium ${
                mealPlan.isActive 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {mealPlan.isActive ? '✅ Active' : '📋 Inactive'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Notes */}
        {mealPlan.notes && (
          <Card>
            <CardHeader>
              <CardTitle>📝 Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">{mealPlan.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Weekly Meal Grid */}
        <Card>
          <CardHeader>
            <CardTitle>📅 Weekly Meal Plan</CardTitle>
            <CardDescription>
              Your planned meals for the week
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
              {DAYS_OF_WEEK.map(day => (
                <div key={day} className="border rounded-lg p-4 min-h-[300px]">
                  <div className="font-semibold text-center mb-3 text-brand-600 border-b pb-2">
                    <div>{getDayName(day)}</div>
                    <div className="text-xs text-gray-500 font-normal">
                      {format(getDayDate(day, mealPlan.weekStartDate), 'MMM dd')}
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    {MEAL_TYPES.map(mealType => {
                      const meal = mealPlan.meals[day]?.[mealType];
                      
                      return (
                        <div key={mealType} className="border-l-2 border-gray-200 pl-3">
                          <div className="font-medium text-sm text-gray-700 mb-1">
                            {getMealTypeEmoji(mealType)} {formatMealTypeName(mealType)}
                          </div>
                          
                          {meal ? (
                            <div className="space-y-1">
                              {meal.recipeName && (
                                <div className="text-sm font-medium text-gray-900">
                                  {meal.recipeName}
                                </div>
                              )}
                              {meal.servings && (
                                <div className="text-xs text-gray-600">
                                  👥 {meal.servings} servings
                                </div>
                              )}
                              {meal.notes && (
                                <div className="text-xs text-gray-600 italic">
                                  {meal.notes}
                                </div>
                              )}
                              {meal.recipeId && (
                                <Link href={`/recipes/${meal.recipeId}`} target="_blank">
                                  <Button variant="outline" size="sm" className="mt-1 text-xs h-6">
                                    📖 View Recipe
                                  </Button>
                                </Link>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-400 italic">
                              No meal planned
                            </div>
                          )}
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
        <div className="flex gap-4 justify-center">
          {mealPlan.isOwner && (
            <Link href={`/meal-plans/${mealPlan.id}/edit`}>
              <Button>
                ✏️ Edit Meal Plan
              </Button>
            </Link>
          )}
          <Link href={`/grocery-lists?meal_plan_id=${mealPlan.id}`}>
            <Button variant="outline">
              🛒 Generate Grocery List
            </Button>
          </Link>
          <Link href="/meal-plans">
            <Button variant="outline">
              📋 Back to All Plans
            </Button>
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}