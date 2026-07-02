import { App } from '@capacitor/app';
import { supabase } from '@/integrations/supabase/client';

export function setupDeepLinks() {
  if (typeof window === 'undefined') return;

  App.addListener('appUrlOpen', async (data) => {
    console.log('[DeepLink] App opened with URL:', data.url);
    
    // Handle Supabase auth redirects
    if (data.url.includes('access_token=') || data.url.includes('refresh_token=')) {
      const url = new URL(data.url.replace('#', '?'));
      const accessToken = url.searchParams.get('access_token');
      const refreshToken = url.searchParams.get('refresh_token');

      if (accessToken && refreshToken) {
        console.log('[DeepLink] Setting Supabase session from URL');
        await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
      }
    }
  });
}
