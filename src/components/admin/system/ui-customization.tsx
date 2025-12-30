"use client"

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { useTheme } from "@/contexts/theme-context"
  import { 
    Palette, Monitor, Smartphone, Tablet, Sun, Moon, 
    Settings, Save, RotateCcw, Eye, Download, Upload, Copy,
    Type, Layout, Image, Brush, Zap, Star, Heart,
    Grid, List, BarChart3, PieChart, LineChart,
    Home, User, ShoppingCart, FileText, Bell,
    ChevronRight, Plus, Minus, Check, X
  } from 'lucide-react'

interface ThemeConfig {
  id: string
  name: string
  description: string
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
    surface: string
    text: string
    textSecondary: string
  }
  typography: {
    fontFamily: string
    fontSize: number
    lineHeight: number
    fontWeight: string
  }
  layout: {
    borderRadius: number
    spacing: number
    shadows: boolean
    animations: boolean
  }
  components: {
    buttonStyle: 'rounded' | 'square' | 'pill'
    cardStyle: 'flat' | 'elevated' | 'outlined'
    navigationStyle: 'sidebar' | 'topbar' | 'hybrid'
  }
}

interface CustomComponent {
  id: string
  name: string
  type: 'button' | 'card' | 'input' | 'badge' | 'navigation'
  preview: React.ReactNode
  customizable: string[]
}

const defaultThemes: ThemeConfig[] = [
  {
    id: 'modern-blue',
    name: 'Azul Moderno',
    description: 'Tema profesional con tonos azules',
    colors: {
      primary: '#3B82F6',
      secondary: '#64748B',
      accent: '#06B6D4',
      background: '#FFFFFF',
      surface: '#F8FAFC',
      text: '#1E293B',
      textSecondary: '#64748B'
    },
    typography: {
      fontFamily: 'Inter',
      fontSize: 14,
      lineHeight: 1.5,
      fontWeight: '400'
    },
    layout: {
      borderRadius: 8,
      spacing: 16,
      shadows: true,
      animations: true
    },
    components: {
      buttonStyle: 'rounded',
      cardStyle: 'elevated',
      navigationStyle: 'sidebar'
    }
  },
  {
    id: 'dark-purple',
    name: 'Púrpura Oscuro',
    description: 'Tema oscuro con acentos púrpura',
    colors: {
      primary: '#8B5CF6',
      secondary: '#6B7280',
      accent: '#EC4899',
      background: '#111827',
      surface: '#1F2937',
      text: '#F9FAFB',
      textSecondary: '#9CA3AF'
    },
    typography: {
      fontFamily: 'Inter',
      fontSize: 14,
      lineHeight: 1.5,
      fontWeight: '400'
    },
    layout: {
      borderRadius: 12,
      spacing: 20,
      shadows: true,
      animations: true
    },
    components: {
      buttonStyle: 'pill',
      cardStyle: 'elevated',
      navigationStyle: 'hybrid'
    }
  },
  {
    id: 'green-nature',
    name: 'Verde Naturaleza',
    description: 'Tema inspirado en la naturaleza',
    colors: {
      primary: '#10B981',
      secondary: '#6B7280',
      accent: '#F59E0B',
      background: '#FFFFFF',
      surface: '#F0FDF4',
      text: '#064E3B',
      textSecondary: '#6B7280'
    },
    typography: {
      fontFamily: 'Poppins',
      fontSize: 15,
      lineHeight: 1.6,
      fontWeight: '400'
    },
    layout: {
      borderRadius: 16,
      spacing: 24,
      shadows: false,
      animations: true
    },
    components: {
      buttonStyle: 'rounded',
      cardStyle: 'outlined',
      navigationStyle: 'topbar'
    }
  }
]

const fontFamilies = [
  'Inter', 'Poppins', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Source Sans Pro', 'Nunito'
]

const customComponents: CustomComponent[] = [
  {
    id: 'primary-button',
    name: 'Botón Primario',
    type: 'button',
    preview: <Button className="bg-blue-600 hover:bg-blue-700 text-white">Ejemplo</Button>,
    customizable: ['color', 'size', 'style', 'animation']
  },
  {
    id: 'info-card',
    name: 'Tarjeta de Información',
    type: 'card',
    preview: (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Título</CardTitle>
          <CardDescription>Descripción de ejemplo</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Contenido de la tarjeta</p>
        </CardContent>
      </Card>
    ),
    customizable: ['background', 'border', 'shadow', 'spacing']
  },
  {
    id: 'text-input',
    name: 'Campo de Texto',
    type: 'input',
    preview: <Input placeholder="Texto de ejemplo" className="w-full" />,
    customizable: ['border', 'focus', 'size', 'placeholder']
  },
  {
    id: 'status-badge',
    name: 'Insignia de Estado',
    type: 'badge',
    preview: <Badge className="bg-green-100 text-green-800">Activo</Badge>,
    customizable: ['color', 'size', 'style']
  }
]

export default function UICustomization() {
  const [activeTheme, setActiveTheme] = useState<ThemeConfig>(defaultThemes[0])
  const [customTheme, setCustomTheme] = useState<ThemeConfig>(defaultThemes[0])
  const [activeTab, setActiveTab] = useState('themes')
  const [previewMode, setPreviewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [isDarkMode, setIsDarkMode] = useState(false)
  const { setTheme, isDark } = useTheme()

  const [colorErrors, setColorErrors] = useState<Record<string, string>>({})
  const [themeSearch, setThemeSearch] = useState("")
  const [themeSearchDebounced, setThemeSearchDebounced] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setThemeSearchDebounced(themeSearch.trim().toLowerCase()), 250)
    return () => clearTimeout(timer)
  }, [themeSearch])

  const filteredThemes = useMemo(() => {
    if (!themeSearchDebounced) return defaultThemes
    return defaultThemes.filter(t =>
      t.name.toLowerCase().includes(themeSearchDebounced) ||
      t.description.toLowerCase().includes(themeSearchDebounced)
    )
  }, [themeSearchDebounced])

  const isValidHexColor = (val: string) => /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/.test(val)

  const applyCustomThemeToCSSVariables = (theme: ThemeConfig) => {
    const root = document.documentElement
    root.classList.add('theme-transition')
    root.style.setProperty('--background', theme.colors.background)
    root.style.setProperty('--foreground', theme.colors.text)
    root.style.setProperty('--card', theme.colors.surface)
    root.style.setProperty('--popover', theme.colors.surface)
    root.style.setProperty('--primary', theme.colors.primary)
    root.style.setProperty('--secondary', theme.colors.secondary)
    root.style.setProperty('--accent', theme.colors.accent)
    root.style.setProperty('--muted-foreground', theme.colors.textSecondary)
    root.style.setProperty('--radius', `${theme.layout.borderRadius}px`)
  }

  const saveCustomTheme = (theme: ThemeConfig) => {
    try {
      localStorage.setItem('custom-theme', JSON.stringify(theme))
    } catch {}
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem('custom-theme')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed && parsed.colors && parsed.typography && parsed.layout && parsed.components) {
          setCustomTheme(parsed)
          setActiveTheme(parsed)
          applyCustomThemeToCSSVariables(parsed)
        }
      }
    } catch {}
  }, [])

  const updateThemeColor = (colorKey: keyof ThemeConfig['colors'], value: string) => {
    // Validación HEX
    setColorErrors(prev => ({
      ...prev,
      [colorKey]: isValidHexColor(value) ? '' : 'Color inválido (use HEX como #RRGGBB)'
    }))

    const next = {
      ...customTheme,
      colors: {
        ...customTheme.colors,
        [colorKey]: value
      }
    }
    setCustomTheme(next)
    applyCustomThemeToCSSVariables(next)
    saveCustomTheme(next)
  }

  const updateTypography = (key: keyof ThemeConfig['typography'], value: any) => {
    const next = {
      ...customTheme,
      typography: {
        ...customTheme.typography,
        [key]: value
      }
    }
    setCustomTheme(next)
    applyCustomThemeToCSSVariables(next)
    saveCustomTheme(next)
  }

  const updateLayout = (key: keyof ThemeConfig['layout'], value: any) => {
    const next = {
      ...customTheme,
      layout: {
        ...customTheme.layout,
        [key]: value
      }
    }
    setCustomTheme(next)
    applyCustomThemeToCSSVariables(next)
    saveCustomTheme(next)
  }

  const updateComponent = (key: keyof ThemeConfig['components'], value: any) => {
    setCustomTheme(prev => ({
      ...prev,
      components: {
        ...prev.components,
        [key]: value
      }
    }))
  }

  const applyTheme = (theme: ThemeConfig) => {
    setActiveTheme(theme)
    setCustomTheme(theme)
    applyCustomThemeToCSSVariables(theme)
    saveCustomTheme(theme)
  }

  const resetToDefault = () => {
    setCustomTheme(defaultThemes[0])
    applyCustomThemeToCSSVariables(defaultThemes[0])
    saveCustomTheme(defaultThemes[0])
  }

  const exportTheme = () => {
    const dataStr = JSON.stringify(customTheme, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
    const exportFileDefaultName = `theme-${customTheme.name.toLowerCase().replace(/\s+/g, '-')}.json`
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  // Copiar variables CSS al portapapeles
  const copyCSSVariables = async () => {
    const css = [
      ':root {',
      `  --background: ${customTheme.colors.background};`,
      `  --foreground: ${customTheme.colors.text};`,
      `  --card: ${customTheme.colors.surface};`,
      `  --popover: ${customTheme.colors.surface};`,
      `  --primary: ${customTheme.colors.primary};`,
      `  --secondary: ${customTheme.colors.secondary};`,
      `  --accent: ${customTheme.colors.accent};`,
      `  --muted-foreground: ${customTheme.colors.textSecondary};`,
      `  --radius: ${customTheme.layout.borderRadius}px;`,
      '}'
    ].join('\n')
    try {
      await navigator.clipboard.writeText(css)
    } catch {}
  }

  // Importación de tema desde archivo JSON
  const handleImportClick = () => {
    setImportError(null)
    fileInputRef.current?.click()
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null)
    try {
      const file = e.target.files?.[0]
      if (!file) return
      const text = await file.text()
      const parsed = JSON.parse(text)
      // Validación mínima de estructura
      const hasStructure = parsed && parsed.colors && parsed.typography && parsed.layout && parsed.components
      if (!hasStructure) {
        setImportError('Archivo inválido: estructura de tema incompleta.')
        return
      }
      applyTheme(parsed)
      // limpiar input para permitir reimportar el mismo archivo
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setImportError('No se pudo importar el tema. Verifique el JSON.')
    }
  }

  // Reseteos por pestaña
  const resetColors = () => {
    const next = {
      ...customTheme,
      colors: { ...defaultThemes[0].colors }
    }
    setColorErrors({})
    setCustomTheme(next)
    applyCustomThemeToCSSVariables(next)
    saveCustomTheme(next)
  }

  const resetTypographyTab = () => {
    const next = {
      ...customTheme,
      typography: { ...defaultThemes[0].typography }
    }
    setCustomTheme(next)
    applyCustomThemeToCSSVariables(next)
    saveCustomTheme(next)
  }

  const resetLayoutTab = () => {
    const next = {
      ...customTheme,
      layout: { ...defaultThemes[0].layout }
    }
    setCustomTheme(next)
    applyCustomThemeToCSSVariables(next)
    saveCustomTheme(next)
  }

  const getPreviewSize = () => {
    switch (previewMode) {
      case 'mobile': return 'w-80 h-96'
      case 'tablet': return 'w-96 h-80'
      default: return 'w-full h-96'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-6 rounded-lg border border-indigo-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center">
              <Palette className="h-6 w-6 mr-2 text-indigo-600" />
              Personalización de UI
            </h2>
            <p className="text-indigo-600 mt-1">Configura temas y personaliza la interfaz de usuario</p>
            {importError && (
              <div className="mt-2 text-xs text-red-600">{importError}</div>
            )}
          </div>
          
          <div className="flex items-center space-x-3">
            <Button 
              variant="outline"
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className="border-indigo-300 text-indigo-600 hover:bg-indigo-50"
            >
              {isDark ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
              {isDark ? 'Modo Claro' : 'Modo Oscuro'}
            </Button>
            <div className="flex items-center space-x-2 bg-white rounded-lg p-2 border border-indigo-200">
              <Monitor className={`h-5 w-5 cursor-pointer ${previewMode === 'desktop' ? 'text-indigo-600' : 'text-gray-400'}`} 
                      onClick={() => setPreviewMode('desktop')} />
              <Tablet className={`h-5 w-5 cursor-pointer ${previewMode === 'tablet' ? 'text-indigo-600' : 'text-gray-400'}`} 
                     onClick={() => setPreviewMode('tablet')} />
              <Smartphone className={`h-5 w-5 cursor-pointer ${previewMode === 'mobile' ? 'text-indigo-600' : 'text-gray-400'}`} 
                          onClick={() => setPreviewMode('mobile')} />
            </div>
            
            <Button 
              variant="outline" 
              onClick={exportTheme}
              className="border-indigo-300 text-indigo-600 hover:bg-indigo-50"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>

            <Button 
              variant="outline" 
              onClick={copyCSSVariables}
              className="border-indigo-300 text-indigo-600 hover:bg-indigo-50"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copiar CSS
            </Button>
            
            <Button 
              variant="outline" 
              onClick={handleImportClick}
              className="border-indigo-300 text-indigo-600 hover:bg-indigo-50"
            >
              <Upload className="h-4 w-4 mr-2" />
              Importar
            </Button>
            <input type="file" accept="application/json" ref={fileInputRef} onChange={handleImportFile} className="hidden" />
            
            <Button 
              onClick={() => applyTheme(customTheme)}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
            >
              <Save className="h-4 w-4 mr-2" />
              Aplicar Tema
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel de Configuración */}
        <div className="lg:col-span-1 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4 bg-gradient-to-r from-indigo-100 to-purple-100 p-1">
              <TabsTrigger 
                value="themes" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-500 data-[state=active]:to-indigo-600 data-[state=active]:text-white"
              >
                <Palette className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger 
                value="colors" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white"
              >
                <Brush className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger 
                value="typography" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-pink-500 data-[state=active]:to-pink-600 data-[state=active]:text-white"
              >
                <Type className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger 
                value="layout" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white"
              >
                <Layout className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>

            {/* Tab: Temas Predefinidos */}
            <TabsContent value="themes" className="space-y-4">
              <Card className="border-gray-200 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-gray-800">Temas Predefinidos</CardTitle>
                  <CardDescription>Selecciona un tema base para personalizar</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Buscar temas…"
                      value={themeSearch}
                      onChange={(e) => setThemeSearch(e.target.value)}
                      className="flex-1"
                    />
                    <Badge variant="outline">{filteredThemes.length} resultados</Badge>
                  </div>
                  {filteredThemes.map((theme) => (
                    <div 
                      key={theme.id} 
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all duration-300 ${
                        customTheme.id === theme.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => applyTheme(theme)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-gray-900">{theme.name}</h4>
                        {customTheme.id === theme.id && <Check className="h-5 w-5 text-indigo-600" />}
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{theme.description}</p>
                      
                      <div className="flex space-x-2">
                        <div 
                          className="w-6 h-6 rounded-full border border-gray-300" 
                          style={{ backgroundColor: theme.colors.primary }}
                        ></div>
                        <div 
                          className="w-6 h-6 rounded-full border border-gray-300" 
                          style={{ backgroundColor: theme.colors.secondary }}
                        ></div>
                        <div 
                          className="w-6 h-6 rounded-full border border-gray-300" 
                          style={{ backgroundColor: theme.colors.accent }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  onClick={resetColors}
                  className="flex-1 border-gray-300 text-gray-600 hover:bg-gray-50"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Resetear colores
                </Button>
              </div>
            </TabsContent>

            {/* Tab: Colores */}
            <TabsContent value="colors" className="space-y-4">
              <Card className="border-gray-200 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-gray-800">Paleta de Colores</CardTitle>
                  <CardDescription>Personaliza los colores del tema</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(customTheme.colors).map(([key, value]) => (
                    <div key={key} className="space-y-2">
                      <Label className="text-sm font-medium capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </Label>
                      <div className="flex items-center space-x-3">
                        <Input
                          type="color"
                          value={value}
                          onChange={(e) => updateThemeColor(key as keyof ThemeConfig['colors'], e.target.value)}
                          className="w-12 h-10 p-1 border border-gray-300"
                        />
                        <Input
                          type="text"
                          value={value}
                          onChange={(e) => updateThemeColor(key as keyof ThemeConfig['colors'], e.target.value)}
                          className="flex-1 font-mono text-sm"
                        />
                      </div>
                      {colorErrors[key] && (
                        <div className="text-xs text-red-600">{colorErrors[key]}</div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  onClick={resetTypographyTab}
                  className="flex-1 border-gray-300 text-gray-600 hover:bg-gray-50"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Resetear tipografía
                </Button>
              </div>
            </TabsContent>

            {/* Tab: Tipografía */}
            <TabsContent value="typography" className="space-y-4">
              <Card className="border-gray-200 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-gray-800">Tipografía</CardTitle>
                  <CardDescription>Configura fuentes y estilos de texto</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Familia de Fuente</Label>
                    <Select 
                      value={customTheme.typography.fontFamily} 
                      onValueChange={(value) => updateTypography('fontFamily', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fontFamilies.map((font) => (
                          <SelectItem key={font} value={font}>{font}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Tamaño de Fuente: {customTheme.typography.fontSize}px</Label>
                    <Slider
                      value={[customTheme.typography.fontSize]}
                      onValueChange={([value]) => updateTypography('fontSize', value)}
                      min={12}
                      max={20}
                      step={1}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Altura de Línea: {customTheme.typography.lineHeight}</Label>
                    <Slider
                      value={[customTheme.typography.lineHeight]}
                      onValueChange={([value]) => updateTypography('lineHeight', value)}
                      min={1.2}
                      max={2.0}
                      step={0.1}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Peso de Fuente</Label>
                    <Select 
                      value={customTheme.typography.fontWeight} 
                      onValueChange={(value) => updateTypography('fontWeight', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="300">Light (300)</SelectItem>
                        <SelectItem value="400">Regular (400)</SelectItem>
                        <SelectItem value="500">Medium (500)</SelectItem>
                        <SelectItem value="600">Semibold (600)</SelectItem>
                        <SelectItem value="700">Bold (700)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Layout */}
            <TabsContent value="layout" className="space-y-4">
              <Card className="border-gray-200 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-gray-800">Layout y Componentes</CardTitle>
                  <CardDescription>Configura el diseño y estilo de componentes</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Radio de Bordes: {customTheme.layout.borderRadius}px</Label>
                    <Slider
                      value={[customTheme.layout.borderRadius]}
                      onValueChange={([value]) => updateLayout('borderRadius', value)}
                      min={0}
                      max={24}
                      step={2}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Espaciado: {customTheme.layout.spacing}px</Label>
                    <Slider
                      value={[customTheme.layout.spacing]}
                      onValueChange={([value]) => updateLayout('spacing', value)}
                      min={8}
                      max={32}
                      step={4}
                      className="w-full"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Sombras</Label>
                    <Switch
                      checked={customTheme.layout.shadows}
                      onCheckedChange={(checked) => updateLayout('shadows', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Animaciones</Label>
                    <Switch
                      checked={customTheme.layout.animations}
                      onCheckedChange={(checked) => updateLayout('animations', checked)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Estilo de Botones</Label>
                    <Select 
                      value={customTheme.components.buttonStyle} 
                      onValueChange={(value) => updateComponent('buttonStyle', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rounded">Redondeado</SelectItem>
                        <SelectItem value="square">Cuadrado</SelectItem>
                        <SelectItem value="pill">Píldora</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Estilo de Tarjetas</Label>
                    <Select 
                      value={customTheme.components.cardStyle} 
                      onValueChange={(value) => updateComponent('cardStyle', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flat">Plano</SelectItem>
                        <SelectItem value="elevated">Elevado</SelectItem>
                        <SelectItem value="outlined">Contorneado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Estilo de Navegación</Label>
                    <Select 
                      value={customTheme.components.navigationStyle} 
                      onValueChange={(value) => updateComponent('navigationStyle', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sidebar">Barra Lateral</SelectItem>
                        <SelectItem value="topbar">Barra Superior</SelectItem>
                        <SelectItem value="hybrid">Híbrido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  onClick={resetLayoutTab}
                  className="flex-1 border-gray-300 text-gray-600 hover:bg-gray-50"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Resetear layout
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Vista Previa */}
        <div className="lg:col-span-2">
          <Card className="border-gray-200 shadow-lg h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-gray-800">Vista Previa</CardTitle>
                  <CardDescription>Previsualización del tema personalizado</CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className="bg-indigo-100 text-indigo-800">
                    {previewMode === 'desktop' ? 'Escritorio' : previewMode === 'tablet' ? 'Tablet' : 'Móvil'}
                  </Badge>
                  <Button variant="ghost" size="sm">
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className={`mx-auto border border-gray-300 rounded-lg overflow-hidden ${getPreviewSize()}`}>
                <div 
                  className="h-full p-4 overflow-y-auto"
                  style={{
                    backgroundColor: customTheme.colors.background,
                    fontFamily: customTheme.typography.fontFamily,
                    fontSize: `${customTheme.typography.fontSize}px`,
                    lineHeight: customTheme.typography.lineHeight,
                    color: customTheme.colors.text
                  }}
                >
                  {/* Header de Ejemplo */}
                  <div 
                    className="p-4 rounded-lg mb-4"
                    style={{
                      backgroundColor: customTheme.colors.primary,
                      borderRadius: `${customTheme.layout.borderRadius}px`,
                      boxShadow: customTheme.layout.shadows ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none'
                    }}
                  >
                    <h1 className="text-xl font-bold text-white mb-2">Panel de Administración</h1>
                    <p className="text-white opacity-90">Vista previa del tema personalizado</p>
                  </div>

                  {/* Navegación de Ejemplo */}
                  <div 
                    className="p-3 rounded-lg mb-4"
                    style={{
                      backgroundColor: customTheme.colors.surface,
                      borderRadius: `${customTheme.layout.borderRadius}px`,
                      boxShadow: customTheme.layout.shadows ? '0 1px 3px 0 rgba(0, 0, 0, 0.1)' : 'none'
                    }}
                  >
                    <div className="flex space-x-4">
                      {[
                        { icon: Home, label: 'Inicio' },
                        { icon: User, label: 'Usuarios' },
                        { icon: ShoppingCart, label: 'Ventas' },
                        { icon: FileText, label: 'Reportes' }
                      ].map((item, index) => (
                        <div 
                          key={index}
                          className="flex items-center space-x-2 px-3 py-2 rounded cursor-pointer"
                          style={{
                            backgroundColor: index === 0 ? customTheme.colors.primary : 'transparent',
                            color: index === 0 ? 'white' : customTheme.colors.text,
                            borderRadius: `${customTheme.layout.borderRadius}px`
                          }}
                        >
                          <item.icon className="h-4 w-4" />
                          <span className="text-sm">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tarjetas de Ejemplo */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {[
                      { title: 'Usuarios Activos', value: '1,247', color: customTheme.colors.primary },
                      { title: 'Ventas del Mes', value: '$45,678', color: customTheme.colors.accent }
                    ].map((card, index) => (
                      <div 
                        key={index}
                        className="p-4 rounded-lg"
                        style={{
                          backgroundColor: customTheme.colors.surface,
                          borderRadius: `${customTheme.layout.borderRadius}px`,
                          boxShadow: customTheme.layout.shadows ? '0 1px 3px 0 rgba(0, 0, 0, 0.1)' : 'none',
                          border: customTheme.components.cardStyle === 'outlined' ? `1px solid ${customTheme.colors.secondary}` : 'none'
                        }}
                      >
                        <h3 className="text-sm font-medium" style={{ color: customTheme.colors.textSecondary }}>
                          {card.title}
                        </h3>
                        <p className="text-2xl font-bold mt-1" style={{ color: card.color }}>
                          {card.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Botones de Ejemplo */}
                  <div className="flex flex-wrap gap-3 mb-4">
                    {[
                      { label: 'Primario', variant: 'primary' },
                      { label: 'Secundario', variant: 'secondary' },
                      { label: 'Acento', variant: 'accent' }
                    ].map((button, index) => (
                      <button
                        key={index}
                        className="px-4 py-2 text-sm font-medium transition-colors"
                        style={{
                          backgroundColor: button.variant === 'primary' ? customTheme.colors.primary :
                                         button.variant === 'secondary' ? customTheme.colors.secondary :
                                         customTheme.colors.accent,
                          color: 'white',
                          borderRadius: customTheme.components.buttonStyle === 'pill' ? '9999px' :
                                       customTheme.components.buttonStyle === 'square' ? '0px' :
                                       `${customTheme.layout.borderRadius}px`,
                          boxShadow: customTheme.layout.shadows ? '0 1px 2px 0 rgba(0, 0, 0, 0.05)' : 'none'
                        }}
                      >
                        {button.label}
                      </button>
                    ))}
                  </div>

                  {/* Lista de Ejemplo */}
                  <div 
                    className="rounded-lg overflow-hidden"
                    style={{
                      backgroundColor: customTheme.colors.surface,
                      borderRadius: `${customTheme.layout.borderRadius}px`,
                      boxShadow: customTheme.layout.shadows ? '0 1px 3px 0 rgba(0, 0, 0, 0.1)' : 'none'
                    }}
                  >
                    {['Elemento 1', 'Elemento 2', 'Elemento 3'].map((item, index) => (
                      <div 
                        key={index}
                        className="p-3 border-b last:border-b-0 flex items-center justify-between"
                        style={{ borderColor: customTheme.colors.secondary + '20' }}
                      >
                        <span style={{ color: customTheme.colors.text }}>{item}</span>
                        <ChevronRight className="h-4 w-4" style={{ color: customTheme.colors.textSecondary }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Componentes Personalizables */}
      <Card className="border-gray-200 shadow-lg">
        <CardHeader>
          <CardTitle className="text-gray-800">Componentes Personalizables</CardTitle>
          <CardDescription>Personaliza componentes específicos de la interfaz</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {customComponents.map((component) => (
              <div key={component.id} className="space-y-3">
                <h4 className="font-medium text-gray-900">{component.name}</h4>
                <div className="p-4 bg-gray-50 rounded-lg">
                  {component.preview}
                </div>
                <div className="flex flex-wrap gap-1">
                  {component.customizable.map((feature) => (
                    <Badge key={feature} variant="outline" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  <Settings className="h-4 w-4 mr-2" />
                  Personalizar
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}