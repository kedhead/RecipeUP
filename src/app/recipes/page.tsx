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

export default async function RecipesPage() {
  const user = await getUser();

  return (
    <DashboardLayout user={user}>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Recipes</h1>
          <p className="text-gray-600 mt-2">Discover and manage your favorite recipes</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>🍳 Browse Recipes</CardTitle>
              <CardDescription>Explore our recipe collection</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Feature coming soon! Browse thousands of recipes from our integrated Spoonacular API.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>❤️ My Favorites</CardTitle>
              <CardDescription>Your saved recipes</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                No favorites yet. Start exploring recipes to save your favorites!
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>📝 Create Recipe</CardTitle>
              <CardDescription>Add your own recipe</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Share your family recipes with the community!
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            🚀 Backend Ready!
          </h3>
          <p className="text-blue-800 text-sm">
            All recipe APIs are implemented and working! Frontend recipe browsing, creation, and management features will be added in the next phase.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}