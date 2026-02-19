
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkStorage() {
  console.log('Checking Supabase Storage buckets...')
  
  const { data: buckets, error } = await supabase.storage.listBuckets()
  
  if (error) {
    console.error('Error listing buckets:', error)
    return
  }
  
  console.log('Buckets found:', buckets.map(b => b.name))
  
  const bucketName = 'product-images'
  const bucket = buckets.find(b => b.name === bucketName)
  
  if (!bucket) {
    console.log(`Bucket '${bucketName}' does not exist. Creating it...`)
    const { data, error: createError } = await supabase.storage.createBucket(bucketName, {
      public: true
    })
    
    if (createError) {
      console.error(`Error creating bucket '${bucketName}':`, createError)
    } else {
      console.log(`Bucket '${bucketName}' created successfully.`)
    }
  } else {
    console.log(`Bucket '${bucketName}' exists. Public: ${bucket.public}`)
  }

  // Check if we can upload a test file
  console.log('Attempting to upload a test file...')
  const testFileName = `test-upload-${Date.now()}.txt`
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(testFileName, 'Test content', {
      contentType: 'text/plain',
      upsert: true
    })

  if (uploadError) {
    console.error('Error uploading test file:', uploadError)
  } else {
    console.log('Test file uploaded successfully:', uploadData)
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(testFileName)
      
    console.log('Public URL:', urlData.publicUrl)
    
    // Clean up
    console.log('Cleaning up...')
    await supabase.storage.from(bucketName).remove([testFileName])
  }
}

checkStorage()
