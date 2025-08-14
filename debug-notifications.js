// Debug script to test notifications manually
// Run this in the browser console while app is open

const testNotification = async () => {
  try {
    const { httpsCallable } = await import('firebase/functions');
    const { functions } = await import('./src/lib/firebase');
    
    const sendNotification = httpsCallable(functions, 'sendPushNotification');
    
    const result = await sendNotification({
      userId: 'YOUR_USER_ID_HERE',
      type: 'support_received',
      title: 'Test Notification',
      body: 'This is a test notification!',
      notificationData: { test: true }
    });
    
    console.log('Test notification result:', result.data);
  } catch (error) {
    console.error('Test notification error:', error);
  }
};

// Call the function
testNotification();