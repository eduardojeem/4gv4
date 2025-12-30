export interface ConfigurationGroup {
  id: string
  title: string
  description: string
  icon: string
  sections: ConfigurationSection[]
  searchKeywords: string[]
}

export interface ConfigurationSection {
  id: string
  title: string
  description: string
  component: string
  settings: ConfigurationSetting[]
  permissions?: string[]
}

export interface ConfigurationSetting {
  id: string
  key: string
  title: string
  description: string
  type: 'text' | 'number' | 'boolean' | 'select' | 'color' | 'file' | 'textarea'
  value: string | number | boolean | File | null
  defaultValue: string | number | boolean | File | null
  options?: { label: string; value: string | number | boolean }[]
  validation?: {
    required?: boolean
    min?: number
    max?: number
    pattern?: string
  }
  searchKeywords: string[]
  category: string
  subcategory?: string
}

export interface SearchResult {
  setting: ConfigurationSetting
  section: ConfigurationSection
  group: ConfigurationGroup
  relevanceScore: number
}

export interface ConfigurationState {
  groups: ConfigurationGroup[]
  searchQuery: string
  activeGroup: string | null
  activeSection: string | null
  hasUnsavedChanges: boolean
  isLoading: boolean
}