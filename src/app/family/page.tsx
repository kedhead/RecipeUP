import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../lib/auth';
import { FamilyClient } from './client';

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

  return <FamilyClient user={user} />;
}