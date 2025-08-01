import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../../lib/auth';
import { RecipeDetailClient } from './client';

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

export default async function RecipeDetailPage({ params }: { params: { id: string } }) {
  const user = await getUser();
  return <RecipeDetailClient user={user} recipeId={params.id} />;
}