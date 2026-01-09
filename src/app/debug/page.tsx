'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient as createSupabaseClient } from '@/lib/supabase/client'

export default function DebugPage() {
  const [logs, setLogs] = useState<string[]>([])
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [error, setError] = useState<any>(null)
  
  const supabase = createSupabaseClient()
  
  const addLog = (message: string) => {
    console.log(message)
    setLogs(prev => [...prev, `${new Date().toISOString()}: ${message}`])
  }
  
  const testConnection = useCallback(async () => {
    addLog('🔍 Testing Supabase connection...')
    
    try {
      // Test basic connection
      const { data, error } = await supabase.from('profiles').select('count').limit(1)
      if (error) {
        addLog(`❌ Connection test failed: ${error.message}`)
        setError(error)
        return
      }
      addLog('✅ Supabase connection successful')
      
      // Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        addLog(`❌ Session error: ${sessionError.message}`)
        setError(sessionError)
        return
      }
      
      if (!session?.user) {
        addLog('⚠️ No authenticated user found')
        return
      }
      
      addLog(`👤 User found: ${session.user.id} (${session.user.email})`)
      setUser(session.user)
      
      // Try to fetch profile
      addLog('📡 Fetching user profile...')
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()
      
      if (profileError) {
        addLog(`❌ Profile error: ${profileError.code} - ${profileError.message}`)
        if (profileError.details) {
          addLog(`Details: ${profileError.details}`)
        }
        if (profileError.hint) {
          addLog(`Hint: ${profileError.hint}`)
        }
        setError(profileError)
        
        // Check if profile exists at all
        addLog('🔍 Checking if any profile exists for this user...')
        const { data: allProfiles, error: allError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
        
        if (allError) {
          addLog(`❌ Error checking profiles: ${allError.message}`)
        } else {
          addLog(`📊 Found ${allProfiles?.length || 0} profiles for user`)
          if (allProfiles && allProfiles.length > 0) {
            addLog(`Profile data: ${JSON.stringify(allProfiles[0], null, 2)}`)
          }
        }
        return
      }
      
      addLog('✅ Profile fetched successfully')
      addLog(`Profile: ${JSON.stringify(profileData, null, 2)}`)
      setProfile(profileData)
      
    } catch (err) {
      addLog(`💥 Unexpected error: ${err}`)
      setError(err)
    }
  }, [supabase])
  
  useEffect(() => {
    testConnection()
  }, [testConnection])
  
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Debug Page - Auth & Profile</h1>
      
      <div className="space-y-6">
        <button 
          onClick={testConnection}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Run Test Again
        </button>
        
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="font-semibold mb-2">Logs:</h2>
          <div className="space-y-1 text-sm font-mono">
            {logs.map((log, index) => (
              <div key={index}>{log}</div>
            ))}
          </div>
        </div>
        
        {user && (
          <div className="bg-green-100 p-4 rounded">
            <h2 className="font-semibold mb-2">User Session:</h2>
            <pre className="text-sm">{JSON.stringify(user, null, 2)}</pre>
          </div>
        )}
        
        {profile && (
          <div className="bg-blue-100 p-4 rounded">
            <h2 className="font-semibold mb-2">User Profile:</h2>
            <pre className="text-sm">{JSON.stringify(profile, null, 2)}</pre>
          </div>
        )}
        
        {error && (
          <div className="bg-red-100 p-4 rounded">
            <h2 className="font-semibold mb-2">Error Details:</h2>
            <pre className="text-sm">{JSON.stringify(error, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  )
}