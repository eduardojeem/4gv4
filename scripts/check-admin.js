console.log('Script started');
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load env vars manually
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^["']|["']$/g, ''); // Remove quotes
            process.env[key] = value;
        }
    });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; // Or SERVICE_ROLE_KEY if available, but ANON should work for reading if RLS allows

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser() {
    const email = 'jeem101595@gmail.com';
    console.log(`Checking user: ${email}`);

    // 1. Get Profile
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .maybeSingle();

    if (profileError) {
        console.error('Error fetching profile:', profileError);
    } else {
        console.log('Profile:', profile);
    }

    if (profile) {
        // 2. Get Roles
        const { data: roles, error: rolesError } = await supabase
            .from('user_roles')
            .select('*')
            .eq('user_id', profile.id);

        if (rolesError) {
            console.error('Error fetching roles:', rolesError);
        } else {
            console.log('Roles:', roles);
        }
    } else {
        console.log('No profile found with that email.');

        // Try to find in auth.users using Service Role Key
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (serviceRoleKey) {
            console.log('Service Role Key found. Attempting to find user in auth.users...');
            const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

            const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers();

            if (authError) {
                console.error('Error listing users:', authError);
            } else {
                const authUser = users.find(u => u.email === email);
                if (authUser) {
                    console.log('Found user in auth.users:', authUser.id);

                    // Check if profile exists by ID
                    const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
                        .from('profiles')
                        .select('*')
                        .eq('id', authUser.id)
                        .maybeSingle();

                    if (existingProfile) {
                        console.log('Profile exists by ID:', existingProfile);
                        console.log('Updating profile for ID:', authUser.id);

                        const { data: updatedData, error: updateError } = await supabaseAdmin
                            .from('profiles')
                            .update({
                                email: email,
                                full_name: 'Admin User',
                                role: 'admin'
                            })
                            .eq('id', authUser.id)
                            .select();

                        if (updateError) {
                            console.error('Error updating profile:', updateError);
                        } else {
                            console.log('Profile updated successfully! Result:', updatedData);
                        }
                    } else {
                        console.log('Creating missing profile...');
                        const { error: createError } = await supabaseAdmin
                            .from('profiles')
                            .insert({
                                id: authUser.id,
                                email: email,
                                full_name: 'Admin User',
                                role: 'admin'
                            });

                        if (createError) console.error('Error creating profile:', createError);
                        else console.log('Profile created successfully with admin role!');
                    }

                    // Check user_roles
                    const { data: userRoles, error: userRolesError } = await supabaseAdmin
                        .from('user_roles')
                        .select('*')
                        .eq('user_id', authUser.id);

                    if (userRolesError) {
                        console.error('Error fetching user_roles:', userRolesError);
                    } else {
                        console.log('Current user_roles:', userRoles);

                        // If role is not admin, update it
                        if (userRoles.length > 0 && userRoles[0].role !== 'admin') {
                            console.log('Updating user_role to admin...');
                            const { error: updateRoleError } = await supabaseAdmin
                                .from('user_roles')
                                .update({ role: 'admin' })
                                .eq('user_id', authUser.id);

                            if (updateRoleError) console.error('Error updating user_role:', updateRoleError);
                            else console.log('User role updated to admin!');
                        } else if (userRoles.length === 0) {
                            console.log('Creating user_role admin...');
                            const { error: insertRoleError } = await supabaseAdmin
                                .from('user_roles')
                                .insert({ user_id: authUser.id, role: 'admin' });

                            if (insertRoleError) console.error('Error inserting user_role:', insertRoleError);
                            else console.log('User role inserted!');
                        }
                    }

                } else {
                    console.log('User NOT found in auth.users either. They need to sign up.');
                }
            }
        } else {
            console.log('No Service Role Key available. Cannot check auth.users.');
        }
    }
}

checkUser();
