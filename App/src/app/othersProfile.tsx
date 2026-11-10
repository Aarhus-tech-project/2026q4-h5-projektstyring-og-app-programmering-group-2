import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { getUserProfile } from '../../lib/api';

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { data: profile } = useQuery({ queryKey: ['profile', userId], queryFn: () => getUserProfile(userId) });
}