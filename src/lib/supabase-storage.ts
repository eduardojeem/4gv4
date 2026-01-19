import { createClient } from '@/lib/supabase/client'

/**
 * Utility functions for Supabase storage operations with proper error handling
 */

export interface StorageBucket {
  name: string
  description: string
  public: boolean
}

export const REQUIRED_BUCKETS: StorageBucket[] = [
  {
    name: 'repair-images',
    description: 'Images for repair documentation',
    public: true
  },
  {
    name: 'product-images', 
    description: 'Product catalog images',
    public: true
  },
  {
    name: 'avatars',
    description: 'User profile avatars',
    public: true
  }
]

/**
 * Check if a storage bucket exists
 */
export async function checkBucketExists(bucketName: string): Promise<boolean> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.storage.listBuckets()
    
    if (error) {
      console.warn(`Error checking buckets: ${error.message}`)
      return false
    }
    
    return data?.some(bucket => bucket.name === bucketName) ?? false
  } catch (error) {
    console.warn(`Error checking bucket ${bucketName}:`, error)
    return false
  }
}

/**
 * Get public URL for a file with error handling
 */
export function getPublicUrl(bucketName: string, filePath: string): string {
  try {
    const supabase = createClient()
    const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath)
    return data?.publicUrl || ''
  } catch (error) {
    console.warn(`Error getting public URL for ${bucketName}/${filePath}:`, error)
    return ''
  }
}

/**
 * Upload file with error handling
 */
export async function uploadFile(
  bucketName: string, 
  filePath: string, 
  file: File,
  options?: { upsert?: boolean }
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const supabase = createClient()
    
    // Check if bucket exists first
    // Note: We skip this check to avoid RLS issues listing buckets. 
    // If the bucket doesn't exist, the upload will fail anyway.
    /*
    const bucketExists = await checkBucketExists(bucketName)
    if (!bucketExists) {
      return {
        success: false,
        error: `Storage bucket '${bucketName}' not found. Please contact administrator to set up storage.`
      }
    }
    */
    
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, options)
    
    if (uploadError) {
      return {
        success: false,
        error: uploadError.message
      }
    }
    
    const url = getPublicUrl(bucketName, filePath)
    return {
      success: true,
      url
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

/**
 * Setup instructions for missing buckets
 */
export function getBucketSetupInstructions(): string {
  return `
To set up Supabase storage buckets, run these SQL commands in your Supabase SQL editor:

${REQUIRED_BUCKETS.map(bucket => `
-- Create ${bucket.name} bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('${bucket.name}', '${bucket.name}', ${bucket.public});

-- Set up RLS policy for ${bucket.name}
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = '${bucket.name}');
CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = '${bucket.name}' AND auth.role() = 'authenticated');
`).join('\n')}

Or use the Supabase Dashboard:
1. Go to Storage in your Supabase dashboard
2. Create the following buckets: ${REQUIRED_BUCKETS.map(b => b.name).join(', ')}
3. Make them public if needed
4. Set up appropriate RLS policies
`
}