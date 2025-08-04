import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../lib/auth';
import { GroceryListsClient } from './client';

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

  return <GroceryListsClient user={user} />;
}