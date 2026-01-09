'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function CheckUserPage() {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('jeem101595@gmail.com')

  const checkUser = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    try {
      // 1. Check profiles table
      const { data: profile, error: profileError } = await (supabase as any)
        .from('profiles')
        .select('*')
        .eq('email', email)
        .maybeSingle()

      // If email is not in profiles (it might not be, sometimes it's only in auth.users), we might need to search by ID if we knew it.
      // But auth-context selects 'email' from profiles, so it must be there.

      // 2. Check user_roles table
      let roleData = null
      if (profile) {
        const { data: roles, error: roleError } = await (supabase as any)
          .from('user_roles')
          .select('*')
          .eq('user_id', profile.id)

        roleData = roles
      }

      setData({ profile, profileError, roleData })
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [email])

  useEffect(() => {
    checkUser()
  }, [checkUser])

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug User: {email}</h1>
      <div className="flex gap-2 mb-4">
        <input
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="border p-2 rounded"
        />
        <button onClick={checkUser} className="bg-blue-500 text-white p-2 rounded">Check</button>
      </div>

      {loading && <div>Loading...</div>}
      {error && <div className="text-red-500">Error: {JSON.stringify(error)}</div>}

      {data && (
        <pre className="bg-gray-100 p-4 rounded overflow-auto">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  )
}
