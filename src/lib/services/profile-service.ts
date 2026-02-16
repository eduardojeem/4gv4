import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'

// Create a client instance for use in this service
const supabase = createSupabaseClient()

export interface Profile {
  id: string
  user_id: string
  username: string
  display_name: string
  bio?: string
  avatar_url?: string
  location?: string
  title?: string
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface SocialLink {
  id: string
  user_id: string
  platform: 'twitter' | 'linkedin' | 'github' | 'website' | 'instagram'
  url: string
  is_verified: boolean
  username?: string
  order_index: number
  created_at: string
}

export interface UserStats {
  id: string
  user_id: string
  followers_count: number
  following_count: number
  posts_count: number
  projects_count: number
  last_calculated: string
}

export interface ContentItem {
  id: string
  user_id: string
  title: string
  description: string
  image_url?: string
  category: string
  type: 'post' | 'project'
  date: string
  views?: number
  likes?: number
  comments?: number
  link?: string
  tags?: string[]
  is_public: boolean
  created_at: string
}

export interface PublicProfileData {
  profile: Profile
  socialLinks: SocialLink[]
  stats: UserStats
  content: ContentItem[]
}

export class ProfileService {
  private static instance: ProfileService
  
  private constructor() {}
  
  static getInstance(): ProfileService {
    if (!ProfileService.instance) {
      ProfileService.instance = new ProfileService()
    }
    return ProfileService.instance
  }

  /**
   * Get public profile by username
   */
  async getPublicProfile(username: string): Promise<PublicProfileData | null> {
    try {
      // Get profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(`
          *,
          social_links(*),
          user_stats(*)
        `)
        .eq('username', username)
        .eq('is_public', true)
        .single()

      if (profileError) {
        console.error('Error fetching profile:', profileError)
        return null
      }

      if (!profile) {
        return null
      }

      // Get content (posts and projects)
      const { data: content, error: contentError } = await supabase
        .from('content')
        .select('*')
        .eq('user_id', profile.user_id)
        .eq('is_public', true)
        .order('date', { ascending: false })
        .limit(20)

      if (contentError) {
        console.error('Error fetching content:', contentError)
      }

      return {
        profile: profile as Profile,
        socialLinks: (profile.social_links as SocialLink[]) || [],
        stats: (profile.user_stats as UserStats) || this.getDefaultStats(profile.user_id),
        content: (content as ContentItem[]) || []
      }
    } catch (error) {
      console.error('Error in getPublicProfile:', error)
      return null
    }
  }

  /**
   * Get profile by user ID (for authenticated users)
   */
  async getProfileByUserId(userId: string): Promise<Profile | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) {
        console.error('Error fetching profile by user ID:', error)
        return null
      }

      return data as Profile
    } catch (error) {
      console.error('Error in getProfileByUserId:', error)
      return null
    }
  }

  /**
   * Update profile
   */
  async updateProfile(userId: string, updates: Partial<Profile>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (error) {
        console.error('Error updating profile:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in updateProfile:', error)
      return false
    }
  }

  /**
   * Create or update social links
   */
  async updateSocialLinks(userId: string, links: Omit<SocialLink, 'id' | 'created_at'>[]): Promise<boolean> {
    try {
      // Delete existing links
      const { error: deleteError } = await supabase
        .from('social_links')
        .delete()
        .eq('user_id', userId)

      if (deleteError) {
        console.error('Error deleting social links:', deleteError)
        return false
      }

      // Insert new links
      if (links.length > 0) {
        const { error: insertError } = await supabase
          .from('social_links')
          .insert(links.map(link => ({
            ...link,
            id: crypto.randomUUID(),
            created_at: new Date().toISOString()
          })))

        if (insertError) {
          console.error('Error inserting social links:', insertError)
          return false
        }
      }

      return true
    } catch (error) {
      console.error('Error in updateSocialLinks:', error)
      return false
    }
  }

  /**
   * Update user stats
   */
  async updateUserStats(userId: string, stats: Partial<UserStats>): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('user_stats')
        .upsert({
          user_id: userId,
          ...stats,
          last_calculated: new Date().toISOString()
        })

      if (error) {
        console.error('Error updating user stats:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Error in updateUserStats:', error)
      return false
    }
  }

  /**
   * Search public profiles
   */
  async searchProfiles(query?: string, category?: string, location?: string, limit = 20, offset = 0) {
    try {
      let supabaseQuery = supabase
        .from('profiles')
        .select(`
          *,
          social_links(*),
          user_stats(*)
        `)
        .eq('is_public', true)

      if (query) {
        supabaseQuery = supabaseQuery.or(`display_name.ilike.%${query}%,bio.ilike.%${query}%,title.ilike.%${query}%`)
      }

      if (category) {
        supabaseQuery = supabaseQuery.eq('category', category)
      }

      if (location) {
        supabaseQuery = supabaseQuery.ilike('location', `%${location}%`)
      }

      const { data, error } = await supabaseQuery
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error) {
        console.error('Error searching profiles:', error)
        return []
      }

      return data as Array<Profile & { social_links: SocialLink[]; user_stats: UserStats }>
    } catch (error) {
      console.error('Error in searchProfiles:', error)
      return []
    }
  }

  /**
   * Create content item
   */
  async createContent(content: Omit<ContentItem, 'id' | 'created_at'>): Promise<ContentItem | null> {
    try {
      const { data, error } = await supabase
        .from('content')
        .insert({
          ...content,
          id: crypto.randomUUID(),
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) {
        console.error('Error creating content:', error)
        return null
      }

      return data as ContentItem
    } catch (error) {
      console.error('Error in createContent:', error)
      return null
    }
  }

  /**
   * Get content by user
   */
  async getContentByUser(userId: string, type?: 'post' | 'project', limit = 20, offset = 0) {
    try {
      let query = supabase
        .from('content')
        .select('*')
        .eq('user_id', userId)
        .eq('is_public', true)
        .order('date', { ascending: false })
        .range(offset, offset + limit - 1)

      if (type) {
        query = query.eq('type', type)
      }

      const { data, error } = await query

      if (error) {
        console.error('Error fetching content:', error)
        return []
      }

      return data as ContentItem[]
    } catch (error) {
      console.error('Error in getContentByUser:', error)
      return []
    }
  }

  private getDefaultStats(userId: string): UserStats {
    return {
      id: '',
      user_id: userId,
      followers_count: 0,
      following_count: 0,
      posts_count: 0,
      projects_count: 0,
      last_calculated: new Date().toISOString()
    }
  }
}

// Export singleton instance
export const profileService = ProfileService.getInstance()