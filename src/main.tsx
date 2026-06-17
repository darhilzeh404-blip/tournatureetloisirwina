import { start } from "@tanstack/start";
import router from "./router";

// Vérification Capacitor (mobile seulement)
const isNative = typeof window !== 'undefined' && 'Capacitor' in window;

// Fonction push notifications
async function initPushNotifications() {
  if (!isNative) {
    console.log('⚠️ Browser mode - push notifications inactive');
    return;
  }

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    
    // Request permission
    const permission = await PushNotifications.requestPermissions();
    
    if (permission.receive === 'granted') {
      await PushNotifications.register();
      console.log('✅ Push notifications registered!');
    } else {
      console.log('❌ Permission denied');
    }

    // Get FCM token
    PushNotifications.addListener('registration', (token) => {
      console.log('🔑 FCM Token:', token.value);
      sendTokenToServer(token.value);
    });

    // Handle notification received
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('📬 Notification received:', notification.title, notification.body);
      showNotification(notification);
    });

    // Handle notification tap
    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('👆 Notification tapped:', action.notification.data);
      handleNotificationTap(action.notification);
    });
  } catch (error) {
    console.error('❌ Push error:', error);
  }
}

// Send token to Supabase/server
async function sendTokenToServer(token: string) {
  console.log('📤 Sending token to server:', token);
  // TODO: await supabase.from('users').update({ push_token: token })
}

// Show notification in app UI
function showNotification(notification: any) {
  console.log('🖼️ Showing notification:', notification.title, notification.body);
  // TODO: Afficher notification dans votre UI
}

// Handle notification tap (navigation)
function handleNotificationTap(notification: any) {
  console.log('🎯 Navigation from notification:', notification.data);
  // TODO: Naviguer selon les données
}

// Init push notifications when app starts
initPushNotifications();

// Start TanStack router (code original)
start(router, {
  routeTree: router.routeTree,
});