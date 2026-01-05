'use client'

import { useState, useMemo } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  generateAvatarVariants, 
  generateDiceBearAvatar,
  AVATAR_STYLES,
  type DiceBearStyle 
} from '@/lib/dicebear'
import { 
  Bot, 
  Shuffle, 
  Copy, 
  Download,
  User,
  Heart,
  Sparkles,
  Clock,
  RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'

export function DiceBearShowcase() {
  const [seed, setSeed] = useState('demo-user')
  const [selectedStyle, setSelectedStyle] = useState<DiceBearStyle>('avataaars')
  const [isGenerating, setIsGenerating] = useState(false)

  // Generar variantes del estilo seleccionado
  const variants = useMemo(() => 
    generateAvatarVariants(seed, 8, { style: selectedStyle }),
    [seed, selectedStyle]
  )

  // Agrupar estilos por categoría
  const stylesByCategory = useMemo(() => {
    const grouped = AVATAR_STYLES.reduce((acc, style) => {
      if (!acc[style.category]) {
        acc[style.category] = []
      }
      acc[style.category].push(style)
      return acc
    }, {} as Record<string, typeof AVATAR_STYLES>)
    
    return grouped
  }, [])

  const categoryIcons = {
    human: <User className="h-4 w-4" />,
    fun: <Heart className="h-4 w-4" />,
    abstract: <Sparkles className="h-4 w-4" />,
    retro: <Clock className="h-4 w-4" />
  }

  const categoryNames = {
    human: 'Humanos',
    fun: 'Divertidos',
    abstract: 'Abstractos',
    retro: 'Retro'
  }

  const handleRandomize = () => {
    setIsGenerating(true)
    
    setTimeout(() => {
      const randomStyle = AVATAR_STYLES[Math.floor(Math.random() * AVATAR_STYLES.length)]
      const randomSeed = `user-${Math.random().toString(36).substr(2, 9)}`
      
      setSelectedStyle(randomStyle.style)
      setSeed(randomSeed)
      setIsGenerating(false)
    }, 500)
  }

  const copyAvatarUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('URL copiada al portapapeles')
    } catch {
      toast.error('No se pudo copiar la URL')
    }
  }

  const downloadAvatar = async (url: string, index: number) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const downloadUrl = URL.createObjectURL(blob)
      
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `dicebear-${selectedStyle}-${seed}-${index + 1}.svg`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      
      URL.revokeObjectURL(downloadUrl)
      toast.success('Avatar descargado')
    } catch {
      toast.error('Error al descargar avatar')
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-6 w-6" />
            DiceBear Avatar Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Controles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="seed-input">Palabra clave (seed)</Label>
              <Input
                id="seed-input"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="Ej: mi-nombre"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Estilo actual</Label>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{selectedStyle}</Badge>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={handleRandomize}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Shuffle className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Estadísticas</Label>
              <div className="text-sm text-muted-foreground">
                {AVATAR_STYLES.length} estilos disponibles
              </div>
            </div>
          </div>

          {/* Grid de avatares generados */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Variantes generadas</h3>
            <div className="grid grid-cols-4 md:grid-cols-8 gap-4">
              {variants.map((variant, index) => (
                <div key={index} className="relative group">
                  <Avatar className="w-full aspect-square">
                    <AvatarImage 
                      src={variant.url} 
                      alt={`Avatar ${index + 1}`}
                      className="object-cover"
                    />
                    <AvatarFallback>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    </AvatarFallback>
                  </Avatar>
                  
                  {/* Controles de hover */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full flex items-center justify-center gap-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-6 w-6 p-0"
                      onClick={() => copyAvatarUrl(variant.url)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-6 w-6 p-0"
                      onClick={() => downloadAvatar(variant.url, index)}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Selector de estilos */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Estilos disponibles</h3>
            <Tabs defaultValue="human" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                {Object.entries(categoryNames).map(([category, name]) => (
                  <TabsTrigger key={category} value={category} className="gap-2">
                    {categoryIcons[category as keyof typeof categoryIcons]}
                    {name}
                  </TabsTrigger>
                ))}
              </TabsList>

              {Object.entries(stylesByCategory).map(([category, styles]) => (
                <TabsContent key={category} value={category}>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {styles.map((style) => (
                      <Button
                        key={style.style}
                        variant={selectedStyle === style.style ? "default" : "outline"}
                        size="sm"
                        className="h-auto p-3 text-left justify-start"
                        onClick={() => setSelectedStyle(style.style)}
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="w-8 h-8">
                            <AvatarImage 
                              src={generateDiceBearAvatar(seed, { 
                                style: style.style, 
                                size: 32 
                              })} 
                              alt={style.name}
                            />
                          </Avatar>
                          <div className="text-left">
                            <div className="font-medium text-xs">{style.name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {style.description}
                            </div>
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>

          {/* Información técnica */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{AVATAR_STYLES.length}</div>
              <div className="text-sm text-muted-foreground">Estilos disponibles</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">∞</div>
              <div className="text-sm text-muted-foreground">Combinaciones únicas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">SVG</div>
              <div className="text-sm text-muted-foreground">Formato vectorial</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}