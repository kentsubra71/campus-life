// Simple PayPal API Test Script
const axios = require('axios');

// Your PayPal credentials from the .env file
const PAYPAL_CLIENT_ID = 'AUwfzm6qAkoeoQRjK--9ovv36PKtRndoZYnFIoACjhSCA8fqAuC-uXYC7nM06eS7eDcsheQg2wSpivQM';
const PAYPAL_CLIENT_SECRET = 'EJgB1tqYXJCFxEmuZDT7hoTJSMvfm-_EsskwIKWmQZOoiUy4NgOf2TWwqZ7pYN_iPcHk7cx-ivFwjedM';
const PAYPAL_BASE_URL = 'https://api-m.sandbox.paypal.com';

// Test functions
async function getAccessToken() {
  console.log('🔑 Getting PayPal access token...');
  
  try {
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
    
    const response = await axios.post(`${PAYPAL_BASE_URL}/v1/oauth2/token`, 'grant_type=client_credentials', {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    
    console.log('✅ Access token received');
    return response.data.access_token;
  } catch (error) {
    console.error('❌ Error getting access token:', error.response?.data || error.message);
    throw error;
  }
}

async function createOrder(accessToken) {
  console.log('📝 Creating PayPal order...');
  
  try {
    const orderData = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'USD',
          value: '5.00'
        },
        description: 'Test payment from Campus Life',
        payee: {
          email_address: 'student-sandbox@example.com' // Replace with your student sandbox email
        }
      }],
      application_context: {
        return_url: 'https://campus-life-verification.vercel.app/api/paypal-success',
        cancel_url: 'https://campus-life-verification.vercel.app/api/paypal-cancel',
        brand_name: 'Campus Life Test',
        user_action: 'PAY_NOW'
      }
    };

    const response = await axios.post(`${PAYPAL_BASE_URL}/v2/checkout/orders`, orderData, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const orderId = response.data.id;
    const approvalUrl = response.data.links.find(link => link.rel === 'approve')?.href;

    console.log('✅ Order created successfully');
    console.log('📋 Order ID:', orderId);
    console.log('🔗 Approval URL:', approvalUrl);
    
    return { orderId, approvalUrl };
  } catch (error) {
    console.error('❌ Error creating order:', error.response?.data || error.message);
    throw error;
  }
}

async function getOrderDetails(accessToken, orderId) {
  console.log('📊 Getting order details...');
  
  try {
    const response = await axios.get(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('✅ Order details retrieved');
    console.log('📋 Order status:', response.data.status);
    console.log('💰 Amount:', response.data.purchase_units[0].amount.value, response.data.purchase_units[0].amount.currency_code);
    
    return response.data;
  } catch (error) {
    console.error('❌ Error getting order details:', error.response?.data || error.message);
    throw error;
  }
}

// Main test function
async function runPayPalTests() {
  console.log('🚀 Starting PayPal API Tests');
  console.log('================================');
  
  try {
    // Test 1: Get Access Token
    const accessToken = await getAccessToken();
    
    // Test 2: Create Order
    const { orderId, approvalUrl } = await createOrder(accessToken);
    
    // Test 3: Get Order Details
    await getOrderDetails(accessToken, orderId);
    
    console.log('================================');
    console.log('🎉 All tests completed successfully!');
    console.log('');
    console.log('💡 Next steps:');
    console.log('1. Open this URL in browser:', approvalUrl);
    console.log('2. Login with your parent sandbox account');
    console.log('3. Complete the payment');
    console.log('4. Test the capture/verification in your app');
    
  } catch (error) {
    console.log('================================');
    console.error('💥 Test failed:', error.message);
  }
}

// Run the tests
runPayPalTests();