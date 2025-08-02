import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../../../lib/auth';
import { MealPlanEditClient } from './client';

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

export default async function MealPlanEditPage({ params }: { params: { id: string } }) {
  const user = await getUser();

  return <MealPlanEditClient user={user} mealPlanId={params.id} />;
}