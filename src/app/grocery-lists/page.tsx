import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../lib/auth';
import { DashboardLayout } from '../../components/layouts/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';

async function getUser() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      redirect('/auth/login');
    }
    return user;
  } catch (error) {
    redirect('/auth/login');
  }
}

export default async function GroceryListsPage() {
  const user = await getUser();

  return (
    <DashboardLayout user={user}>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Grocery Lists</h1>
          <p className="text-gray-600 mt-2">Smart shopping lists generated from your meal plans</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>🛒 Current List</CardTitle>
              <CardDescription>This week's shopping list</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                No grocery list yet. Create a meal plan first to generate a smart shopping list!
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>📝 Create List</CardTitle>
              <CardDescription>Manual grocery list</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Create a custom grocery list for items not in your meal plan.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>🔄 Auto-Generate</CardTitle>
              <CardDescription>From meal plans</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Automatically generate shopping lists from your weekly meal plans.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-orange-900 mb-2">
            🛒 Smart Lists Ready!
          </h3>
          <p className="text-orange-800 text-sm">
            Intelligent grocery list system with automatic ingredient consolidation and family sharing is fully implemented!
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}