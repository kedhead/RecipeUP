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

export default async function FamilyPage() {
  const user = await getUser();

  return (
    <DashboardLayout user={user}>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Family Groups</h1>
          <p className="text-gray-600 mt-2">Manage your family groups and share recipes</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>👨‍👩‍👧‍👦 My Family</CardTitle>
              <CardDescription>Your family group</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                You're not part of any family group yet. Create or join a family group to start sharing recipes!
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>➕ Create Group</CardTitle>
              <CardDescription>Start a new family group</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Create a family group and invite your family members to share recipes and meal plans.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>🔗 Join Group</CardTitle>
              <CardDescription>Join existing group</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Have an invite code? Join your family's group and start collaborating!
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-purple-900 mb-2">
            🔗 Family Features Ready!
          </h3>
          <p className="text-purple-800 text-sm">
            Complete family group system with invite codes, member management, and shared recipes is fully implemented in the backend!
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}