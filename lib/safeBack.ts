/**
 * Safe back/close helper — ensures navigation always lands somewhere valid.
 *
 * `router.back()` throws "GO_BACK was not handled" warnings (and shows a
 * red toast in dev) when there's nothing on the back stack. This happens
 * regularly when modals are deep-linked or the user lands on a screen via
 * `router.replace()`. This helper checks first and falls back to the tabs
 * root so the app never gets stuck on a dead-end screen.
 */
import { useRouter } from 'expo-router';

export function useSafeBack(fallbackPath: string = '/(tabs)') {
  const router = useRouter();
  return () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallbackPath as any);
    }
  };
}
