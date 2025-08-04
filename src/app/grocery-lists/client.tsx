'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { DashboardLayout } from '../../components/layouts/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import Link from 'next/link';
import { format } from 'date-fns';

interface GroceryItem {
  name: string;
  amount: string;
  unit: string;
  category: string;
  checked: boolean;
  recipeSources?: string[];
  notes?: string;
}

interface AdditionalItem {
  name: string;
  category: string;
  checked: boolean;
  notes?: string;
}

interface GroceryList {
  id: string;
  name: string;
  mealPlanId?: string;
  ingredients: GroceryItem[];
  additionalItems: AdditionalItem[];
  status: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  familyGroup: {
    id: string;
    name: string;
  };
  mealPlan?: {
    id: string;
    name: string;
    weekStartDate: string;
  };
  creator: {
    id: string;
    username: string;
    firstName?: string;
    lastName?: string;
  };
  completionStats: {
    totalItems: number;
    checkedItems: number;
    percentageComplete: number;
  };
  isOwner: boolean;
}

interface FamilyGroup {
  id: string;
  name: string;
  role: string;
}

interface MealPlan {
  id: string;
  name: string;
  weekStartDate: string;
  weekEndDate: string;
  familyGroup: {
    id: string;
    name: string;
  };
}

const CATEGORIES = [
  { id: 'produce', name: '🥬 Produce', color: 'bg-green-100 text-green-800' },
  { id: 'meat', name: '🥩 Meat & Seafood', color: 'bg-red-100 text-red-800' },
  { id: 'dairy', name: '🥛 Dairy', color: 'bg-blue-100 text-blue-800' },
  { id: 'pantry', name: '🥫 Pantry', color: 'bg-yellow-100 text-yellow-800' },
  { id: 'frozen', name: '🧊 Frozen', color: 'bg-cyan-100 text-cyan-800' },
  { id: 'bakery', name: '🍞 Bakery', color: 'bg-orange-100 text-orange-800' },
  { id: 'other', name: '🛒 Other', color: 'bg-gray-100 text-gray-800' },
];

export function GroceryListsClient({ user }: { user: any }) {
  const searchParams = useSearchParams();
  const mealPlanIdParam = searchParams.get('meal_plan_id');
  
  const [groceryLists, setGroceryLists] = useState<GroceryList[]>([]);
  const [familyGroups, setFamilyGroups] = useState<FamilyGroup[]>([]);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showGenerateForm, setShowGenerateForm] = useState(!!mealPlanIdParam);
  const [selectedList, setSelectedList] = useState<GroceryList | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Create form state
  const [createFormData, setCreateFormData] = useState({
    familyGroupId: '',
    name: '',
  });

  // Generate form state
  const [generateFormData, setGenerateFormData] = useState({
    mealPlanId: mealPlanIdParam || '',
    name: '',
  });

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mealPlanIdParam) {
      const mealPlan = mealPlans.find(mp => mp.id === mealPlanIdParam);
      if (mealPlan) {
        setGenerateFormData({
          mealPlanId: mealPlanIdParam,
          name: `Grocery List - ${mealPlan.name}`,
        });
      }
    }
  }, [mealPlanIdParam, mealPlans]);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadGroceryLists(),
        loadFamilyGroups(),
        loadMealPlans(),
      ]);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGroceryLists = async () => {
    try {
      const response = await fetch('/api/grocery-lists?limit=20', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const data = await response.json();
        setGroceryLists(data.groceryLists);
      }
    } catch (error) {
      console.error('Failed to load grocery lists:', error);
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

  const loadMealPlans = async () => {
    try {
      const response = await fetch('/api/meal-plans?limit=50', {
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

  const handleGenerateFromMealPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!generateFormData.mealPlanId || !generateFormData.name.trim()) return;

    try {
      setSubmitting(true);
      
      const mealPlan = mealPlans.find(mp => mp.id === generateFormData.mealPlanId);
      if (!mealPlan) {
        alert('Selected meal plan not found.');
        return;
      }
      
      const response = await fetch('/api/grocery-lists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          familyGroupId: mealPlan.familyGroup.id,
          mealPlanId: generateFormData.mealPlanId,
          name: generateFormData.name.trim(),
          ingredients: [], // Let the API extract from meal plan
          additionalItems: [],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        await loadGroceryLists();
        setShowGenerateForm(false);
        setGenerateFormData({ mealPlanId: '', name: '' });
        
        // Auto-select the newly created list
        const newList = groceryLists.find(list => list.id === data.groceryList.id);
        if (newList) {
          setSelectedList(newList);
        } else {
          // Reload to get the new list
          setTimeout(() => loadGroceryLists(), 500);
        }
      } else {
        const error = await response.json();
        alert(`Failed to generate grocery list: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to generate grocery list:', error);
      alert('Failed to generate grocery list. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleItemChecked = async (listId: string, itemType: 'ingredients' | 'additionalItems', itemIndex: number) => {
    try {
      const list = groceryLists.find(l => l.id === listId);
      if (!list) return;

      const items = list[itemType];
      const updatedItems = [...items];
      updatedItems[itemIndex] = { ...updatedItems[itemIndex], checked: !updatedItems[itemIndex].checked };

      const response = await fetch(`/api/grocery-lists/${listId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          [itemType]: updatedItems,
        }),
      });

      if (response.ok) {
        // Update local state
        setGroceryLists(prev => prev.map(l => 
          l.id === listId 
            ? { ...l, [itemType]: updatedItems }
            : l
        ));
        
        // Update selected list if it's the one being modified
        if (selectedList?.id === listId) {
          setSelectedList(prev => prev ? { ...prev, [itemType]: updatedItems } : null);
        }
      }
    } catch (error) {
      console.error('Failed to update item:', error);
    }
  };

  const getCategoryInfo = (categoryId: string) => {
    return CATEGORIES.find(cat => cat.id === categoryId) || CATEGORIES[CATEGORIES.length - 1];
  };

  if (loading) {
    return (
      <DashboardLayout user={user}>
        <div className="text-center py-12">
          <div className="text-gray-600">Loading grocery lists...</div>
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
            <h1 className="text-3xl font-bold text-gray-900">Grocery Lists</h1>
            <p className="text-gray-600 mt-2">Smart shopping lists generated from your meal plans</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowCreateForm(true)}>
              📝 Create Manual List
            </Button>
            <Button onClick={() => setShowGenerateForm(true)}>
              🛒 Generate from Meal Plan
            </Button>
          </div>
        </div>

        {/* Generate Form */}
        {showGenerateForm && (
          <Card className="border-brand-200">
            <CardHeader>
              <CardTitle>🛒 Generate Grocery List from Meal Plan</CardTitle>
              <CardDescription>
                Automatically extract ingredients from your meal plan recipes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGenerateFromMealPlan} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Meal Plan *
                  </label>
                  <select
                    value={generateFormData.mealPlanId}
                    onChange={(e) => {
                      const mealPlan = mealPlans.find(mp => mp.id === e.target.value);
                      setGenerateFormData({
                        mealPlanId: e.target.value,
                        name: mealPlan ? `Grocery List - ${mealPlan.name}` : '',
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    required
                  >
                    <option value="">Choose a meal plan...</option>
                    {mealPlans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} ({format(new Date(plan.weekStartDate), 'MMM dd, yyyy')})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    List Name *
                  </label>
                  <input
                    type="text"
                    value={generateFormData.name}
                    onChange={(e) => setGenerateFormData({ ...generateFormData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    placeholder="e.g., Grocery List - Week of Jan 15"
                    required
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Generating...' : '🛒 Generate Grocery List'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowGenerateForm(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Grocery Lists */}
        {groceryLists.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* List Selection */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Your Grocery Lists</h2>
              {groceryLists.map((list) => (
                <Card 
                  key={list.id} 
                  className={`cursor-pointer transition-colors ${
                    selectedList?.id === list.id ? 'border-brand-500 bg-brand-50' : 'hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedList(list)}
                >
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold">{list.name}</h3>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        list.status === 'completed' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {list.completionStats.percentageComplete}% Complete
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-600 space-y-1">
                      <div>👨‍👩‍👧‍👦 {list.familyGroup.name}</div>
                      {list.mealPlan && (
                        <div>📅 {list.mealPlan.name}</div>
                      )}
                      <div>🛒 {list.completionStats.checkedItems}/{list.completionStats.totalItems} items</div>
                      <div>📅 {format(new Date(list.createdAt), 'MMM dd, yyyy')}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Selected List Details */}
            {selectedList && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">{selectedList.name}</h2>
                  <Link href={`/grocery-lists/${selectedList.id}`}>
                    <Button variant="outline" size="sm">
                      📱 Mobile View
                    </Button>
                  </Link>
                </div>

                {/* Progress Bar */}
                <div className="bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-brand-500 h-2 rounded-full transition-all" 
                    style={{ width: `${selectedList.completionStats.percentageComplete}%` }}
                  />
                </div>
                <div className="text-sm text-gray-600 text-center">
                  {selectedList.completionStats.checkedItems} of {selectedList.completionStats.totalItems} items completed
                </div>

                {/* Ingredients by Category */}
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {CATEGORIES.map(category => {
                    const categoryItems = selectedList.ingredients.filter(item => item.category === category.id);
                    if (categoryItems.length === 0) return null;

                    return (
                      <div key={category.id}>
                        <div className={`px-2 py-1 rounded text-sm font-medium mb-2 ${category.color}`}>
                          {category.name} ({categoryItems.length})
                        </div>
                        <div className="space-y-2">
                          {categoryItems.map((item, index) => {
                            const actualIndex = selectedList.ingredients.indexOf(item);
                            return (
                              <div 
                                key={actualIndex}
                                className={`flex items-center gap-3 p-2 rounded border ${
                                  item.checked ? 'bg-gray-50 text-gray-500' : 'bg-white'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={item.checked}
                                  onChange={() => toggleItemChecked(selectedList.id, 'ingredients', actualIndex)}
                                  className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                                />
                                <div className={`flex-1 ${item.checked ? 'line-through' : ''}`}>
                                  <div className="font-medium">
                                    {item.amount} {item.unit} {item.name}
                                  </div>
                                  {item.recipeSources && item.recipeSources.length > 0 && (
                                    <div className="text-xs text-gray-500">
                                      📖 {item.recipeSources.length === 1 
                                        ? item.recipeSources[0]
                                        : item.recipeSources.length === 2
                                        ? item.recipeSources.join(' & ')
                                        : `${item.recipeSources[0]} & ${item.recipeSources.length - 1} other${item.recipeSources.length > 2 ? 's' : ''}`
                                      }
                                    </div>
                                  )}
                                  {item.notes && (
                                    <div className="text-xs text-gray-500 italic">
                                      {item.notes}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {/* Additional Items */}
                  {selectedList.additionalItems.length > 0 && (
                    <div>
                      <div className="px-2 py-1 rounded text-sm font-medium mb-2 bg-purple-100 text-purple-800">
                        ➕ Additional Items ({selectedList.additionalItems.length})
                      </div>
                      <div className="space-y-2">
                        {selectedList.additionalItems.map((item, index) => (
                          <div 
                            key={index}
                            className={`flex items-center gap-3 p-2 rounded border ${
                              item.checked ? 'bg-gray-50 text-gray-500' : 'bg-white'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={item.checked}
                              onChange={() => toggleItemChecked(selectedList.id, 'additionalItems', index)}
                              className="w-4 h-4 text-brand-600 rounded focus:ring-brand-500"
                            />
                            <div className={`flex-1 ${item.checked ? 'line-through' : ''}`}>
                              <div className="font-medium">{item.name}</div>
                              {item.notes && (
                                <div className="text-xs text-gray-500 italic">
                                  {item.notes}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>🛒 No Grocery Lists Yet</CardTitle>
              <CardDescription>
                Create your first grocery list or generate one from a meal plan.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <div className="text-gray-600 mb-4">
                  Smart grocery lists automatically consolidate ingredients from your meal plan recipes.
                </div>
                <div className="flex gap-2 justify-center">
                  <Button onClick={() => setShowGenerateForm(true)}>
                    🛒 Generate from Meal Plan
                  </Button>
                  <Button variant="outline" onClick={() => setShowCreateForm(true)}>
                    📝 Create Manual List
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Banner */}
        <div className="bg-brand-50 border border-brand-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-brand-900 mb-2">
            🛒 Smart Grocery Lists
          </h3>
          <div className="text-brand-800 text-sm space-y-1">
            <div>• Automatically extract ingredients from meal plan recipes</div>
            <div>• Consolidate duplicate ingredients across multiple recipes</div>
            <div>• Organize by grocery store categories for efficient shopping</div>
            <div>• Check off items as you shop with real-time progress tracking</div>
            <div>• Share lists with family members for collaborative shopping</div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}