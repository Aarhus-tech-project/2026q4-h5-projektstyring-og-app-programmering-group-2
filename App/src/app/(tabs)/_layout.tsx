import AppTabs from '@/components/app-tabs';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { isLoggedIn } from '../../../lib/api';

export default function TabLayout() {
  useEffect(() => {
    isLoggedIn().then((loggedIn) => {
      if (!loggedIn) router.push('/login');
    });
  }, []);

  return <AppTabs />;
}