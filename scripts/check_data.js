
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env if possible, or use a hardcoded service role key if I can find it.
// Since I can't easily load .env in this script without dotenv, I'll try to find the credentials in the project files or ask the user.
// Wait, I can use the project's own supabase client if I run it via `ts-node` or similar, but setting up the environment is tricky.

// Let's try to read the .env file to get the credentials.
try {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const envConfig = require('dotenv').config({ path: envPath });
    // console.log('Loaded env:', envConfig);
  } else {
    // try .env.local
    const envLocalPath = path.resolve(__dirname, '../.env.local');
    if (fs.existsSync(envLocalPath)) {
        require('dotenv').config({ path: envLocalPath });
    }
  }
} catch (e) {
  console.log('Error loading .env', e);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key not found in environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
  console.log('Checking recent users...');
  
  // Get recent auth users (this requires service role key usually, but let's try)
  // Actually, we can't query auth.users directly with the JS client unless we are admin.
  // But we can check profiles and customers.
  
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (profilesError) {
    console.error('Error fetching profiles:', profilesError);
  } else {
    console.log('Recent Profiles:', profiles);
  }

  const { data: customers, error: customersError } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (customersError) {
    console.error('Error fetching customers:', customersError);
  } else {
    console.log('Recent Customers:', customers);
  }
}

checkUsers();
