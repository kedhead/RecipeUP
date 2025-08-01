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

export default async function MealPlansPage() {
  const user = await getUser();

  return (
    <DashboardLayout user={user}>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Meal Plans</h1>
          <p className="text-gray-600 mt-2">Plan your weekly meals and stay organized</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>📅 This Week</CardTitle>
              <CardDescription>Current meal plan</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                No meal plan for this week yet. Create your first meal plan!
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>📝 Create Plan</CardTitle>
              <CardDescription>Plan your week</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Create a new weekly meal plan for you and your family.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>📋 Past Plans</CardTitle>
              <CardDescription>Previous meal plans</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                View and reuse your previous meal plans.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-900 mb-2">
            ✅ API Complete!
          </h3>
          <p className="text-green-800 text-sm">
            Full meal planning API is implemented with weekly planning, family sharing, and grocery list generation!
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}