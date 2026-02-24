// Test script to verify user registration automation through the web interface
// This can be run in the browser console or as a Node.js script

const testRegistration = async () => {
  const testData = {
    email: `test.automation.${Date.now()}@example.com`,
    password: 'TestPassword123!',
    fullName: 'Test Automation User'
  };

  console.log('🧪 Testing user registration automation...');
  console.log('📧 Test email:', testData.email);

  try {
    // Test the registration API endpoint
    const response = await fetch('/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    if (response.ok) {
      console.log('✅ Registration request sent successfully');
      
      // Wait a moment for database triggers to execute
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify the automation worked by checking the database
      await verifyAutomation(testData.email);
      
    } else {
      console.error('❌ Registration failed:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('❌ Registration error:', error);
  }
};

const verifyAutomation = async (email) => {
  console.log('🔍 Verifying automation results...');
  
  try {
    // Check if profile was created
    const profileResponse = await fetch(`/api/admin/users?search=${encodeURIComponent(email)}`);
    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      console.log('✅ Profile found:', profileData.users?.length > 0);
      
      if (profileData.users?.length > 0) {
        const user = profileData.users[0];
        console.log('👤 Profile details:', {
          id: user.id,
          email: user.email,
          role: user.role,
          fullName: user.name
        });
      }
    }
    
    // Check if customer was created (you might need to adjust this endpoint)
    const customerResponse = await fetch(`/api/customers?search=${encodeURIComponent(email)}`);
    if (customerResponse.ok) {
      const customerData = await customerResponse.json();
      console.log('✅ Customer found:', customerData.customers?.length > 0);
      
      if (customerData.customers?.length > 0) {
        const customer = customerData.customers[0];
        console.log('🏪 Customer details:', {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          profileId: customer.profile_id,
          customerType: customer.customer_type,
          segment: customer.segment
        });
      }
    }
    
    console.log('🎉 Automation verification complete!');
    
  } catch (error) {
    console.error('❌ Verification error:', error);
  }
};

// Instructions for testing
console.log(`
🧪 USER REGISTRATION AUTOMATION TEST
=====================================

To test the automation:

1. Open your browser and go to the registration page
2. Use these test credentials:
   - Email: test.automation.${Date.now()}@example.com  
   - Password: TestPassword123!
   - Full Name: Test Automation User

3. After registration, check the following:
   - User should appear in admin/users page
   - Customer should appear in dashboard/customers page
   - Both should be linked via profile_id

4. Or run this script in the browser console after the page loads
`);

// Export for use in browser console
if (typeof window !== 'undefined') {
  window.testRegistration = testRegistration;
  window.verifyAutomation = verifyAutomation;
}