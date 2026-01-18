'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
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
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
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
  Check, 
  RefreshCw,
  Sparkles,
  User,
  Bot,
  Heart,
  Clock,
  Wand2,
  Eye,
  Zap,
  X
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
  const [scale, setScale] = useState(100)
  const [flip, setFlip] = useState(false)
  const [rotate, setRotate] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState('human')
  const [isLoading, setIsLoading] = useState(false)

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setCustomSeed('')
      setSelectedAvatar(null)
      setPreviewAvatar(null)
      setUseRoundedCorners(true)
      setScale(100)
      setFlip(false)
      setRotate(0)
      setBackgroundIndex(0)
      setSelectedStyle('avataaars')
      setActiveCategory('human')
    }
  }, [open])

  // Generar seed basado en usuario
  const userSeed = useMemo(() => 
    generateUserSeed(userId, email, name), 
    [userId, email, name]
  )

  // Seed actual a usar
  const currentSeed = customSeed.trim() || userSeed

  // Generar variantes del estilo seleccionado con animación
  const avatarVariants = useMemo(() => {
    const variants = []
    
    // Generar 28 variantes para el modal más ancho
    for (let i = 0; i < 28; i++) {
      const seed = `${currentSeed}-${i}`
      const url = generateDiceBearAvatar(seed, {
        style: selectedStyle,
        size: 200,
        backgroundColor: BACKGROUND_COLORS[backgroundIndex],
        radius: useRoundedCorners ? 50 : 0,
        scale,
        flip,
        rotate
      })
      variants.push({ seed, url, index: i })
    }
    
    return variants
  }, [selectedStyle, currentSeed, backgroundIndex, useRoundedCorners, scale, flip, rotate])

  // Efecto para actualizar la selección inicial si no hay avatar seleccionado
  useEffect(() => {
    if (open && !selectedAvatar && avatarVariants.length > 0) {
      // Opcional: Seleccionar el primero por defecto o dejarlo vacío
      // setSelectedAvatar(avatarVariants[0].url)
      // setPreviewAvatar(avatarVariants[0].url)
    }
  }, [open, avatarVariants, selectedAvatar])

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

  // Efecto para resetear selección cuando cambia el estilo
  useEffect(() => {
    setSelectedAvatar(null)
    setPreviewAvatar(null)
    setIsLoading(true)
    
    // Simular carga de avatares
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 300)
    
    return () => clearTimeout(timer)
  }, [selectedStyle, currentSeed, backgroundIndex, useRoundedCorners, scale, flip, rotate])

  const handleStyleChange = useCallback((style: DiceBearStyle) => {
    setIsLoading(true)
    setSelectedStyle(style)
    // El efecto de useEffect se encargará de quitar el loading
  }, [])

  const handleAvatarClick = useCallback((avatarUrl: string) => {
    setSelectedAvatar(avatarUrl)
    setPreviewAvatar(avatarUrl)
  }, [])

  const handleAvatarHover = useCallback((avatarUrl: string) => {
    setPreviewAvatar(avatarUrl)
  }, [])

  const handleAvatarLeave = useCallback(() => {
    setPreviewAvatar(selectedAvatar)
  }, [selectedAvatar])

  const handleConfirm = useCallback(() => {
    if (selectedAvatar) {
      onAvatarSelect(selectedAvatar)
      onOpenChange(false)
    }
  }, [selectedAvatar, onAvatarSelect, onOpenChange])

  const handleRandomize = useCallback(() => {
    setIsGenerating(true)
    
    // Animación más fluida
    setTimeout(() => {
      const randomStyle = AVATAR_STYLES[Math.floor(Math.random() * AVATAR_STYLES.length)]
      const randomBg = Math.floor(Math.random() * BACKGROUND_COLORS.length)
      const randomSeed = Math.random().toString(36).substring(7)
      
      setSelectedStyle(randomStyle.style)
      setBackgroundIndex(randomBg)
      setUseRoundedCorners(Math.random() > 0.5)
      setFlip(Math.random() > 0.5)
      setScale(90 + Math.floor(Math.random() * 20)) // 90-110
      setRotate(Math.floor(Math.random() * 20) - 10) // -10 to 10
      setCustomSeed(randomSeed)
      setActiveCategory(randomStyle.category)
      setIsGenerating(false)
    }, 800)
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] p-0 flex flex-col gap-0 overflow-hidden bg-background/95 backdrop-blur-xl border-border/50">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-background/50 z-10 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold tracking-tight">Estudio de Avatares</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Diseña tu identidad digital única con IA
              </DialogDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-muted/80" onClick={() => onOpenChange(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - Settings & Preview */}
          <ScrollArea className="w-80 border-r bg-muted/30">
            <div className="p-6 space-y-6">
              {/* Preview Section - Large & Centered */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative group">
                  <div className={cn(
                    "absolute -inset-0.5 bg-gradient-to-tr from-primary to-purple-500 rounded-full opacity-75 blur group-hover:opacity-100 transition duration-500",
                    useRoundedCorners ? "rounded-full" : "rounded-2xl"
                  )} />
                  <Avatar className={cn(
                    "w-40 h-40 border-4 border-background shadow-xl relative transition-all duration-300",
                    useRoundedCorners ? "rounded-full" : "rounded-2xl"
                  )}>
                    <AvatarImage 
                      src={previewAvatar || avatarVariants[0]?.url} 
                      className="object-cover bg-white"
                    />
                    <AvatarFallback className="bg-muted">
                      <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground/50" />
                    </AvatarFallback>
                  </Avatar>
                  
                  {/* Quick Actions Overlay */}
                  <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 translate-y-2 group-hover:translate-y-0">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-8 w-8 rounded-full shadow-lg"
                      onClick={() => handleRandomize()}
                      disabled={isGenerating}
                      title="Aleatorio"
                    >
                      <Shuffle className={cn("h-4 w-4", isGenerating && "animate-spin")} />
                    </Button>
                  </div>
                </div>
                
                <div className="text-center space-y-1">
                  <h3 className="font-medium text-sm">Vista previa</h3>
                  <p className="text-xs text-muted-foreground">Así se verá tu avatar en el perfil.</p>
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={handleRandomize}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Explorando estilos...
                    </>
                  ) : (
                    <>
                      <Shuffle className="h-4 w-4 mr-2" />
                      Sugerir avatar
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Elige un estilo y haz clic en la opción que más te guste.
                </p>
              </div>
            </div>
          </ScrollArea>

          {/* Main Content - Styles & Grid */}
          <div className="flex-1 flex flex-col min-w-0 bg-background/30">
            <Tabs value={activeCategory} onValueChange={setActiveCategory} className="flex-1 flex flex-col min-h-0">
              <div className="px-6 border-b bg-background/50 backdrop-blur-sm sticky top-0 z-10">
                <TabsList className="w-full justify-start h-14 bg-transparent p-0 gap-6">
                  {Object.entries(categoryNames).map(([category, name]) => (
                    <TabsTrigger 
                      key={category} 
                      value={category}
                      className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-0 text-sm font-medium text-muted-foreground data-[state=active]:text-primary transition-all hover:text-foreground"
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "p-1.5 rounded-md transition-colors",
                          activeCategory === category ? "bg-primary/10 text-primary" : "bg-muted"
                        )}>
                          {categoryIcons[category as keyof typeof categoryIcons]}
                        </div>
                        {name}
                      </div>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="p-6 max-w-5xl mx-auto space-y-8">
                    {Object.entries(stylesByCategory).map(([category, styles]) => (
                      <TabsContent key={category} value={category} className="mt-0 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Styles Selection */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Estilo Artístico</Label>
                            <span className="text-xs text-muted-foreground">
                              {styles.find(s => s.style === selectedStyle)?.name || 'Selecciona uno'}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {styles.map((style) => (
                              <button
                                key={style.style}
                                onClick={() => handleStyleChange(style.style)}
                                className={cn(
                                  "px-4 py-2 rounded-xl text-xs font-medium transition-all border shadow-sm",
                                  selectedStyle === style.style
                                    ? "bg-primary text-primary-foreground border-primary ring-2 ring-primary/20 scale-105"
                                    : "bg-card hover:bg-accent border-border text-card-foreground hover:border-primary/50"
                                )}
                              >
                                {style.name}
                              </button>
                            ))}
                          </div>
                          <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg border border-border/50">
                            <span className="font-semibold text-foreground mr-1">Info:</span>
                            {styles.find(s => s.style === selectedStyle)?.description}
                          </p>
                        </div>

                        <Separator className="bg-border/50" />

                        {/* Avatars Grid */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Variaciones Disponibles</Label>
                            <Badge variant="outline" className="text-xs font-normal">
                              {avatarVariants.length} opciones
                            </Badge>
                          </div>
                          
                          {isLoading ? (
                            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-4">
                              {Array.from({ length: 24 }).map((_, i) => (
                                <div key={i} className="aspect-square rounded-xl bg-muted/50 animate-pulse border border-border/50" />
                              ))}
                            </div>
                          ) : (
                            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-4 pb-8">
                              {avatarVariants.map((variant, index) => (
                                <button
                                  key={`${variant.seed}-${index}`}
                                  className={cn(
                                    "group relative aspect-square rounded-xl overflow-hidden border bg-card transition-all duration-200 hover:shadow-lg hover:-translate-y-1",
                                    selectedAvatar === variant.url
                                      ? "border-primary ring-4 ring-primary/20 shadow-lg scale-105 z-10"
                                      : "border-border hover:border-primary/50"
                                  )}
                                  onClick={() => handleAvatarClick(variant.url)}
                                  onMouseEnter={() => handleAvatarHover(variant.url)}
                                  onMouseLeave={handleAvatarLeave}
                                >
                                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  <img 
                                    src={variant.url} 
                                    alt="Avatar variant"
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    loading="lazy"
                                  />
                                  
                                  {selectedAvatar === variant.url && (
                                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1 shadow-md animate-in zoom-in duration-200">
                                      <Check className="h-3 w-3" />
                                    </div>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </TabsContent>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </Tabs>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-background/80 backdrop-blur-md flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full animate-pulse",
              selectedAvatar ? "bg-green-500" : "bg-yellow-500"
            )} />
            <span className="text-xs text-muted-foreground font-medium">
              {selectedAvatar ? 'Avatar seleccionado listo para usar' : 'Elige tu avatar favorito'}
            </span>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="h-10 px-4">
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirm}
              disabled={!selectedAvatar}
              className={cn(
                "h-10 px-8 transition-all duration-300",
                selectedAvatar ? "bg-primary shadow-lg shadow-primary/25" : "opacity-50"
              )}
            >
              {selectedAvatar ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Aplicar Avatar
                </>
              ) : (
                'Seleccionar'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
