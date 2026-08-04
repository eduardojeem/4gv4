import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import jwt from 'jsonwebtoken' // We can just sign a custom JWT since Supabase uses the JWT secret!

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const jwtSecret = process.env.SUPABASE_JWT_SECRET! // usually not exposed, but maybe it is? Wait, we don't have it. Let's check env vars.
