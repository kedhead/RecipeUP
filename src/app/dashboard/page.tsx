import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { DashboardLayout } from '@/components/layouts/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

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

export default async function DashboardPage() {
  const user = await getUser();

  const quickActions = [
    {
      title: 'Browse Recipes',
      description: 'Discover new recipes from our collection',
      href: '/recipes',
      icon: '🍳',
    },
    {
      title: 'Plan Meals',
      description: 'Create weekly meal plans for your family',
      href: '/meal-plans',
      icon: '📅',
    },
    {
      title: 'Family Groups',
      description: 'Manage your family and share recipes',
      href: '/family',
      icon: '👨‍👩‍👧‍👦',
    },
    {
      title: 'Grocery Lists',
      description: 'Generate shopping lists from meal plans',
      href: '/grocery-lists',
      icon: '🛒',
    },
  ];

  const recentActivity = [
    'Welcome to RecipeUp v2! 🎉',
    'Your account has been created successfully',
    'Start by exploring recipes or creating your first meal plan',
  ];

  return (
    <DashboardLayout user={user}>
      <div className="space-y-8">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-brand-600 to-brand-700 rounded-lg text-white p-8">
          <h1 className="text-3xl font-bold mb-2">
            Welcome back, {user.firstName || user.username}! 👋
          </h1>
          <p className="text-brand-100 text-lg">
            Ready to cook something amazing today?
          </p>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {quickActions.map((action, index) => (
              <Card key={index} className="hover:shadow-md transition-shadow cursor-pointer">
                <Link href={action.href}>
                  <CardHeader className="text-center pb-2">
                    <div className="text-4xl mb-2">{action.icon}</div>
                    <CardTitle className="text-lg">{action.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center pt-0">
                    <CardDescription>{action.description}</CardDescription>
                  </CardContent>
                </Link>
              </Card>
            ))}
          </div>
        </div>

        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your latest actions and updates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-brand-500 rounded-full mt-2 flex-shrink-0"></div>
                    <p className="text-sm text-gray-600">{activity}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Getting Started */}
          <Card>
            <CardHeader>
              <CardTitle>Getting Started</CardTitle>
              <CardDescription>Complete these steps to get the most out of RecipeUp</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">✅ Create your account</span>
                  <span className="text-xs text-green-600 font-medium">Complete</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">⏳ Browse some recipes</span>
                  <Link href="/recipes">
                    <Button variant="outline" size="sm">Start</Button>
                  </Link>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">⏳ Create a family group</span>
                  <Link href="/family">
                    <Button variant="outline" size="sm">Create</Button>
                  </Link>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">⏳ Plan your first meal</span>
                  <Link href="/meal-plans">
                    <Button variant="outline" size="sm">Plan</Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Saved Recipes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">0</div>
              <p className="text-xs text-gray-500 mt-1">Start saving your favorites</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Meal Plans</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">0</div>
              <p className="text-xs text-gray-500 mt-1">No meal plans yet</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">Family Members</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-900">1</div>
              <p className="text-xs text-gray-500 mt-1">Just you for now</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}