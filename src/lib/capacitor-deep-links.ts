import { App } from '@capacitor/app';

export function setupDeepLinks() {
  if (typeof window === 'undefined') return;

  App.addListener('appUrlOpen', async (data) => {
    // Handle Supabase auth redirects
    if (data.url.includes('access_token=') || data.url.includes('refresh_token=')) {
      const url = new URL(data.url.replace('#', '?'));
      const accessToken = url.searchParams.get('access_token');
      const refreshToken = url.searchParams.get('refresh_token');

      if (accessToken && refreshToken) {
        const { supabase } = await import('@/integrations/supabase/client');
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
      }
    }
  });
}
