import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner-native';
import { addFavorite, getFavorites, removeFavorite, type Post } from '../../lib/api';
import { useAuthStatus } from '../../lib/auth';
import { errorMessage } from '../../lib/errors';

const favoritesKey = ['favorites'];
const toggleKey = ['favorite-toggle'];

export function useFavorites() {
  const auth = useAuthStatus();
  return useQuery({
    queryKey: favoritesKey,
    queryFn: getFavorites,
    enabled: auth === 'signedIn',
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: toggleKey,
    mutationFn: ({ post, favorite }: { post: Post; favorite: boolean }) =>
      favorite ? addFavorite(post.id) : removeFavorite(post.id),
    onMutate: async ({ post, favorite }) => {
      await queryClient.cancelQueries({ queryKey: favoritesKey });
      const previous = queryClient.getQueryData<Post[]>(favoritesKey);
      queryClient.setQueryData<Post[]>(favoritesKey, (old = []) => {
        const rest = old.filter((p) => p.id !== post.id);
        return favorite ? [post, ...rest] : rest;
      });
      return { previous };
    },
    onError: (error, { favorite }, context) => {
      queryClient.setQueryData(favoritesKey, context?.previous);
      toast.error(errorMessage(error, favorite ? 'Could not add to favorites.' : 'Could not remove from favorites.'));
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: toggleKey }) === 1) {
        return queryClient.invalidateQueries({ queryKey: favoritesKey });
      }
    },
  });
}
