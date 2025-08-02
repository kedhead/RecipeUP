import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../../lib/auth';
import { MealPlanDetailClient } from './client';

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

export default async function MealPlanDetailPage({ params }: { params: { id: string } }) {
  const user = await getUser();

  return <MealPlanDetailClient user={user} mealPlanId={params.id} />;
}