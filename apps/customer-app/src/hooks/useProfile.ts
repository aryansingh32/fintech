import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';

export function useMyProfile() {
  return useQuery({
    queryKey: ['profile', 'me'],
    queryFn: () => apiClient.myProfile.get(),
    refetchInterval: 20_000,
  });
}
