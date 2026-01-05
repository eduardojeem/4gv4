'use client'

import { useState, useCallback, useMemo } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { 
  generateAvatarVariants, 
  generateDiceBearAvatar, 
  generateUserSeed,
  AVATAR_STYLES,
  BACKGROUND_COLORS,
  type DiceBearStyle,
  type AvatarVariant
} from '@/lib/dicebear'
import { 
  Palette, 
  Shuffle, 
  Download, 
  Check, 
  RefreshCw,
  Sparkles,
  User,
  Bot,
  Heart,
  Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AvatarSelectorProps {
  userId: string
  email?: string
  name?: string
  currentAvatar?: string
  onAvatarSelect: (avatarUrl: string) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AvatarSelector({
  userId,
  email,
  name,
  currentAvatar,
  onAvatarSelect,
  open,
  onOpenChange
}: AvatarSelectorProps) {
  const [selectedStyle, setSelectedStyle] = useState<DiceBearStyle>('avataaars')
  const [customSeed, setCustomSeed] = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null)
  const [backgroundIndex, setBackgroundIndex] = useState(0)
  const [useRoundedCorners, setUseRoundedCorners] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)

  // Generar seed basado en usuario
  const userSeed = useMemo(() => 
    generateUserSeed(userId, email, name), 
    [userId, email, name]
  )

  // Seed actual a usar
  const currentSeed = customSeed.trim() || userSeed

  // Generar variantes del estilo seleccionado
  const avatarVariants = useMemo(() => {
    const variants = []
    
    // Generar 8 variantes con diferentes seeds
    for (let i = 0; i < 8; i++) {
      const seed = `${currentSeed}-${i}`
      const url = generateDiceBearAvatar(seed, {
        style: selectedStyle,
        size: 200,
        backgroundColor: BACKGROUND_COLORS[backgroundIndex],
        radius: useRoundedCorners ? 50 : 0
      })
      variants.push({ seed, url })
    }
    
    return variants
  }, [selectedStyle, currentSeed, backgroundIndex, useRoundedCorners])

  // Agrupar estilos por categoría
  const stylesByCategory = useMemo(() => {
    const grouped = AVATAR_STYLES.reduce((acc, style) => {
      if (!acc[style.category]) {
        acc[style.category] = []
      }
      acc[style.category].push(style)
      return acc
    }, {} as Record<string, AvatarVariant[]>)
    
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

  const handleStyleChange = useCallback((style: DiceBearStyle) => {
    setSelectedStyle(style)
    setSelectedAvatar(null)
  }, [])

  const handleAvatarClick = useCallback((avatarUrl: string) => {
    setSelectedAvatar(avatarUrl)
  }, [])

  const handleConfirm = useCallback(() => {
    if (selectedAvatar) {
      onAvatarSelect(selectedAvatar)
      onOpenChange(false)
    }
  }, [selectedAvatar, onAvatarSelect, onOpenChange])

  const handleRandomize = useCallback(() => {
    setIsGenerating(true)
    
    // Simular tiempo de generación
    setTimeout(() => {
      const randomStyle = AVATAR_STYLES[Math.floor(Math.random() * AVATAR_STYLES.length)]
      const randomBg = Math.floor(Math.random() * BACKGROUND_COLORS.length)
      
      setSelectedStyle(randomStyle.style)
      setBackgroundIndex(randomBg)
      setUseRoundedCorners(Math.random() > 0.5)
      setIsGenerating(false)
    }, 500)
  }, [])

  const downloadAvatar = useCallback(async (avatarUrl: string) => {
    try {
      const response = await fetch(avatarUrl)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      
      const a = document.createElement('a')
      a.href = url
      a.download = `avatar-${Date.now()}.svg`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error descargando avatar:', error)
    }
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Seleccionar Avatar
          </DialogTitle>
          <DialogDescription>
            Elige un avatar generado automáticamente o personaliza uno
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 py-4">
          {/* Panel de control */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Personalización
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Seed personalizado */}
                <div className="space-y-2">
                  <Label htmlFor="custom-seed">Palabra clave (opcional)</Label>
                  <Input
                    id="custom-seed"
                    placeholder={`Por defecto: ${userSeed}`}
                    value={customSeed}
                    onChange={(e) => setCustomSeed(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Cambia esta palabra para generar avatares diferentes
                  </p>
                </div>

                {/* Fondo */}
                <div className="space-y-2">
                  <Label>Color de fondo</Label>
                  <div className="grid grid-cols-5 gap-2">
                    {BACKGROUND_COLORS.map((colors, index) => (
                      <button
                        key={index}
                        className={cn(
                          'w-8 h-8 rounded-full border-2 transition-all',
                          backgroundIndex === index 
                            ? 'border-primary scale-110' 
                            : 'border-muted hover:border-muted-foreground'
                        )}
                        style={{ 
                          backgroundColor: colors[0] === 'transparent' 
                            ? '#f3f4f6' 
                            : colors[0],
                          backgroundImage: colors[0] === 'transparent' 
                            ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)'
                            : undefined,
                          backgroundSize: colors[0] === 'transparent' ? '8px 8px' : undefined,
                          backgroundPosition: colors[0] === 'transparent' ? '0 0, 0 4px, 4px -4px, -4px 0px' : undefined
                        }}
                        onClick={() => setBackgroundIndex(index)}
                      />
                    ))}
                  </div>
                </div>

                {/* Opciones */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="rounded-corners">Bordes redondeados</Label>
                    <Switch
                      id="rounded-corners"
                      checked={useRoundedCorners}
                      onCheckedChange={setUseRoundedCorners}
                    />
                  </div>
                </div>

                {/* Botón aleatorio */}
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={handleRandomize}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <Shuffle className="h-4 w-4 mr-2" />
                      Aleatorio
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Selector de estilos y avatares */}
          <div className="lg:col-span-2 space-y-4">
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
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4">
                      {/* Selector de estilos */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {styles.map((style) => (
                          <Button
                            key={style.style}
                            variant={selectedStyle === style.style ? "default" : "outline"}
                            size="sm"
                            className="h-auto p-2 text-left"
                            onClick={() => handleStyleChange(style.style)}
                          >
                            <div>
                              <div className="font-medium text-xs">{style.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {style.description}
                              </div>
                            </div>
                          </Button>
                        ))}
                      </div>

                      {/* Grid de avatares */}
                      <div className="grid grid-cols-4 gap-3">
                        {avatarVariants.map((variant, index) => (
                          <div key={index} className="relative group">
                            <button
                              className={cn(
                                'relative w-full aspect-square rounded-lg border-2 transition-all overflow-hidden',
                                selectedAvatar === variant.url
                                  ? 'border-primary ring-2 ring-primary/20'
                                  : 'border-muted hover:border-muted-foreground'
                              )}
                              onClick={() => handleAvatarClick(variant.url)}
                            >
                              <Avatar className="w-full h-full">
                                <AvatarImage 
                                  src={variant.url} 
                                  alt={`Avatar ${index + 1}`}
                                  className="object-cover"
                                />
                                <AvatarFallback>
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                </AvatarFallback>
                              </Avatar>
                              
                              {selectedAvatar === variant.url && (
                                <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                  <Check className="h-6 w-6 text-primary" />
                                </div>
                              )}
                            </button>

                            {/* Botón de descarga */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="absolute -top-2 -right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation()
                                downloadAvatar(variant.url)
                              }}
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </div>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              {selectedAvatar && (
                <Badge variant="secondary" className="gap-1">
                  <Check className="h-3 w-3" />
                  Avatar seleccionado
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleConfirm}
                disabled={!selectedAvatar}
              >
                Usar este avatar
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}