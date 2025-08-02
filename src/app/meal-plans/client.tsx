'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '../../components/layouts/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import Link from 'next/link';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';

interface Recipe {
  id: string;
  title: string;
  description: string;
  readyInMinutes: number;
  servings: number;
  imageUrl?: string;
}

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

interface FamilyGroup {
  id: string;
  name: string;
  role: string;
}

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

export function MealPlansClient({ user }: { user: any }) {
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [familyGroups, setFamilyGroups] = useState<FamilyGroup[]>([]);
  const [currentWeekPlan, setCurrentWeekPlan] = useState<MealPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadMealPlans(),
        loadFamilyGroups(),
        loadCurrentWeekPlan()
      ]);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMealPlans = async () => {
    try {
      const response = await fetch('/api/meal-plans?limit=10', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setMealPlans(data.mealPlans);
      }
    } catch (error) {
      console.error('Failed to load meal plans:', error);
    }
  };

  const loadFamilyGroups = async () => {
    try {
      const response = await fetch('/api/family-groups', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setFamilyGroups(data.familyGroups);
      }
    } catch (error) {
      console.error('Failed to load family groups:', error);
    }
  };

  const loadCurrentWeekPlan = async () => {
    try {
      const thisWeek = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const response = await fetch(`/api/meal-plans?week_start=${thisWeek}&active=true`, {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.mealPlans.length > 0) {
          setCurrentWeekPlan(data.mealPlans[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load current week plan:', error);
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

  if (loading) {
    return (
      <DashboardLayout user={user}>
        <div className="text-center py-12">
          <div className="text-gray-600">Loading meal plans...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={user}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Meal Plans</h1>
            <p className="text-gray-600 mt-2">Plan your weekly meals and stay organized</p>
          </div>
          {familyGroups.length > 0 && (
            <Button onClick={() => setShowCreateForm(true)}>
              📅 Create Meal Plan
            </Button>
          )}
        </div>

        {/* Family Groups Check */}
        {familyGroups.length === 0 && (
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader>
              <CardTitle className="text-amber-800">🏠 Join a Family Group First</CardTitle>
              <CardDescription className="text-amber-700">
                You need to be part of a family group to create meal plans.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/family">
                <Button className="bg-amber-600 hover:bg-amber-700">
                  Go to Family Groups
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {familyGroups.length > 0 && (
          <>
            {/* Current Week Plan */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  📅 This Week&apos;s Meal Plan
                  <span className="text-sm font-normal text-gray-500">
                    {format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'MMM dd')} - 
                    {format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 6), 'MMM dd, yyyy')}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {currentWeekPlan ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold text-lg">{currentWeekPlan.name}</h3>
                      <span className="text-sm text-gray-500">
                        by {currentWeekPlan.creator.firstName || currentWeekPlan.creator.username}
                      </span>
                    </div>
                    
                    {/* Weekly Grid */}
                    <div className="grid grid-cols-7 gap-2 text-xs">
                      {DAYS_OF_WEEK.map(day => (
                        <div key={day} className="border rounded p-2 min-h-[120px]">
                          <div className="font-semibold text-center mb-2 text-brand-600">
                            {getDayName(day)}
                          </div>
                          <div className="space-y-1">
                            {MEAL_TYPES.map(mealType => {
                              const meal = currentWeekPlan.meals[day]?.[mealType];
                              if (!meal) return null;
                              
                              return (
                                <div key={mealType} className="text-xs">
                                  <div className="font-medium">
                                    {getMealTypeEmoji(mealType)} {formatMealTypeName(mealType)}
                                  </div>
                                  <div className="text-gray-600 truncate">
                                    {meal.recipeName || 'No recipe'}
                                  </div>
                                  {meal.notes && (
                                    <div className="text-gray-500 italic truncate">
                                      {meal.notes}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <Link href={`/meal-plans/${currentWeekPlan.id}`}>
                        <Button variant="outline" size="sm">
                          📝 View Details
                        </Button>
                      </Link>
                      {currentWeekPlan.isOwner && (
                        <Link href={`/meal-plans/${currentWeekPlan.id}/edit`}>
                          <Button variant="outline" size="sm">
                            ✏️ Edit Plan
                          </Button>
                        </Link>
                      )}
                      <Link href={`/grocery-lists?meal_plan_id=${currentWeekPlan.id}`}>
                        <Button variant="outline" size="sm">
                          🛒 Generate Grocery List
                        </Button>
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-gray-600 mb-4">
                      No meal plan for this week yet.
                    </div>
                    <Button onClick={() => setShowCreateForm(true)}>
                      📅 Create This Week&apos;s Plan
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Meal Plans */}
            {mealPlans.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>📋 Recent Meal Plans</CardTitle>
                  <CardDescription>Your family&apos;s meal planning history</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {mealPlans.slice(0, 5).map((plan) => (
                      <div key={plan.id} className="flex justify-between items-center p-4 border rounded-lg">
                        <div>
                          <h4 className="font-semibold">{plan.name}</h4>
                          <div className="text-sm text-gray-600">
                            {format(new Date(plan.weekStartDate), 'MMM dd')} - {format(new Date(plan.weekEndDate), 'MMM dd, yyyy')}
                          </div>
                          <div className="text-xs text-gray-500">
                            {plan.familyGroup.name} • by {plan.creator.username}
                            {plan.isActive && <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded-full">Active</span>}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Link href={`/meal-plans/${plan.id}`}>
                            <Button variant="outline" size="sm">View</Button>
                          </Link>
                          {plan.isOwner && (
                            <Link href={`/meal-plans/${plan.id}/edit`}>
                              <Button variant="outline" size="sm">Edit</Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">📊 Family Groups</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-brand-600">{familyGroups.length}</div>
                  <div className="text-sm text-gray-600">Active memberships</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">📅 Meal Plans</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-brand-600">{mealPlans.length}</div>
                  <div className="text-sm text-gray-600">Total created</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">⏰ This Week</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-brand-600">
                    {currentWeekPlan ? '✅' : '❌'}
                  </div>
                  <div className="text-sm text-gray-600">
                    {currentWeekPlan ? 'Planned' : 'Not planned'}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}