import useSWR from 'swr'

interface Category {
  id: string
  name: string
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch')
  const data = await res.json()
  return data.data || []
}

export function usePublicCategories() {
  const { data, error, isLoading } = useSWR<Category[]>(
    '/api/public/categories',
    fetcher,
    { revalidateOnFocus: false }
  )

  return {
    categories: data || [],
    isLoading,
    error: error ? error.message : null
  }
}
