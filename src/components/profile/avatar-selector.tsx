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
  Download, 
  Check, 
  RefreshCw,
  Sparkles,
  User,
  Bot,
  Heart,
  Clock,
  Wand2,
  Copy,
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
    setSelectedStyle(style)
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

  const copyAvatarUrl = useCallback(async (avatarUrl: string) => {
    try {
      await navigator.clipboard.writeText(avatarUrl)
      // Aquí podrías mostrar un toast de confirmación
    } catch (error) {
      console.error('Error copiando URL:', error)
    }
  }, [])

  const generateMoreVariants = useCallback(() => {
    const newSeed = Math.random().toString(36).substring(7)
    setCustomSeed(newSeed)
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[85vh] p-0 flex flex-col gap-0 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-2 border-b flex items-center justify-between bg-background z-10">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg">Seleccionar Avatar</DialogTitle>
              <DialogDescription className="text-xs">
                Personaliza y elige tu nuevo avatar
              </DialogDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar - Settings & Preview */}
          <ScrollArea className="w-72 border-r bg-muted/10">
            <div className="p-3 space-y-3">
              {/* Preview Section - Compact Row */}
              <div className="flex items-center gap-3 p-2 bg-background rounded-lg border shadow-sm">
                <div className="relative shrink-0">
                  <Avatar className={cn(
                    "w-16 h-16 border-2 border-muted transition-all",
                    useRoundedCorners ? "rounded-full" : "rounded-lg"
                  )}>
                    <AvatarImage 
                      src={previewAvatar || avatarVariants[0]?.url} 
                      className="object-cover bg-white"
                    />
                    <AvatarFallback>
                      <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    Vista previa
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full h-7 text-xs gap-2"
                    onClick={handleRandomize}
                    disabled={isGenerating}
                  >
                    <Shuffle className={cn("h-3 w-3", isGenerating && "animate-spin")} />
                    Aleatorio
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Customization Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Background Color - Full Width */}
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-[10px] uppercase text-muted-foreground font-semibold">Fondo</Label>
                  <div className="flex flex-wrap gap-1">
                    {BACKGROUND_COLORS.map((colorArr, index) => {
                      const colorValue = colorArr[0]
                      const isTransparent = colorValue === 'transparent'
                      return (
                        <button
                          key={index}
                          className={cn(
                            "w-5 h-5 rounded-full border transition-all",
                            backgroundIndex === index 
                              ? "border-primary scale-110 shadow-sm" 
                              : "border-transparent hover:scale-105"
                          )}
                          style={{ 
                            backgroundColor: isTransparent ? '#ffffff' : colorValue,
                            backgroundImage: isTransparent
                              ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)'
                              : undefined,
                            backgroundSize: '4px 4px'
                          }}
                          onClick={() => setBackgroundIndex(index)}
                          title={isTransparent ? 'Transparente' : colorValue}
                        />
                      )
                    })}
                  </div>
                </div>

                {/* Scale */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase text-muted-foreground font-semibold">Escala ({scale}%)</Label>
                  <Slider
                    value={[scale]}
                    onValueChange={(vals) => setScale(vals[0])}
                    min={50}
                    max={150}
                    step={5}
                    className="w-full [&>span:first-child]:h-1 [&>span:last-child]:h-3 [&>span:last-child]:w-3"
                  />
                </div>

                {/* Rotate */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase text-muted-foreground font-semibold">Rotación ({rotate}°)</Label>
                  <Slider
                    value={[rotate]}
                    onValueChange={(vals) => setRotate(vals[0])}
                    min={-180}
                    max={180}
                    step={5}
                    className="w-full [&>span:first-child]:h-1 [&>span:last-child]:h-3 [&>span:last-child]:w-3"
                  />
                </div>

                {/* Toggles */}
                <div className="flex items-center justify-between bg-background p-1.5 rounded border">
                  <Label htmlFor="rounded" className="text-[10px] cursor-pointer">Redondo</Label>
                  <Switch
                    id="rounded"
                    checked={useRoundedCorners}
                    onCheckedChange={setUseRoundedCorners}
                    className="scale-50 origin-right"
                  />
                </div>
                
                <div className="flex items-center justify-between bg-background p-1.5 rounded border">
                  <Label htmlFor="flip" className="text-[10px] cursor-pointer">Voltear</Label>
                  <Switch
                    id="flip"
                    checked={flip}
                    onCheckedChange={setFlip}
                    className="scale-50 origin-right"
                  />
                </div>
              </div>

              <Separator />

              {/* Seed Input */}
              <div className="space-y-1.5">
                 <div className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  <Sparkles className="h-3 w-3" />
                  Semilla
                </div>
                <div className="flex gap-1.5">
                  <Input 
                    value={customSeed}
                    onChange={(e) => setCustomSeed(e.target.value)}
                    placeholder="Semilla..."
                    className="h-7 text-xs"
                  />
                  <Button 
                    size="icon" 
                    variant="outline" 
                    className="h-7 w-7 shrink-0"
                    onClick={generateMoreVariants}
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* URL Display */}
              <div className="space-y-1.5">
                 <Label className="text-[10px] uppercase font-semibold text-muted-foreground">URL</Label>
                 <div className="relative">
                   <Input 
                     readOnly 
                     value={previewAvatar || ''} 
                     className="h-7 text-[10px] pr-7 bg-muted/50 font-mono" 
                   />
                   <Button
                     size="icon"
                     variant="ghost"
                     className="absolute right-0 top-0 h-7 w-7 hover:bg-transparent text-muted-foreground hover:text-foreground"
                     onClick={() => copyAvatarUrl(previewAvatar || '')}
                     disabled={!previewAvatar}
                   >
                     <Copy className="h-3 w-3" />
                   </Button>
                 </div>
              </div>
            </div>
          </ScrollArea>

          {/* Main Content - Styles & Grid */}
          <div className="flex-1 flex flex-col min-w-0 bg-background">
            <Tabs value={activeCategory} onValueChange={setActiveCategory} className="flex-1 flex flex-col min-h-0">
              <div className="px-4 border-b">
                <TabsList className="w-full justify-start h-10 bg-transparent p-0 gap-4">
                  {Object.entries(categoryNames).map(([category, name]) => (
                    <TabsTrigger 
                      key={category} 
                      value={category}
                      className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none h-full px-0 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground transition-none"
                    >
                      <div className="flex items-center gap-1.5">
                        {categoryIcons[category as keyof typeof categoryIcons]}
                        {name}
                      </div>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-6">
                    {Object.entries(stylesByCategory).map(([category, styles]) => (
                      <TabsContent key={category} value={category} className="mt-0 space-y-5">
                        {/* Styles Selection */}
                        <div className="space-y-2.5">
                          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estilo de Arte</Label>
                          <div className="flex flex-wrap gap-2">
                            {styles.map((style) => (
                              <button
                                key={style.style}
                                onClick={() => handleStyleChange(style.style)}
                                className={cn(
                                  "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                                  selectedStyle === style.style
                                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                    : "bg-background hover:bg-muted border-input text-foreground"
                                )}
                              >
                                {style.name}
                              </button>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {styles.find(s => s.style === selectedStyle)?.description}
                          </p>
                        </div>

                        <Separator />

                        {/* Avatars Grid */}
                        <div className="space-y-2.5">
                          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resultados</Label>
                          {isLoading ? (
                            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-3">
                              {Array.from({ length: 28 }).map((_, i) => (
                                <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" />
                              ))}
                            </div>
                          ) : (
                            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 gap-3">
                              {avatarVariants.map((variant, index) => (
                                <button
                                  key={`${variant.seed}-${index}`}
                                  className={cn(
                                    "group relative aspect-square rounded-lg overflow-hidden border transition-all hover:shadow-md",
                                    selectedAvatar === variant.url
                                      ? "border-primary ring-2 ring-primary/30"
                                      : "border-transparent hover:border-muted-foreground/20"
                                  )}
                                  onClick={() => handleAvatarClick(variant.url)}
                                  onMouseEnter={() => handleAvatarHover(variant.url)}
                                  onMouseLeave={handleAvatarLeave}
                                >
                                  <div className="absolute inset-0 bg-muted/20" />
                                  <img 
                                    src={variant.url} 
                                    alt="Avatar variant"
                                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                    loading="lazy"
                                  />
                                  
                                  {selectedAvatar === variant.url && (
                                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center backdrop-blur-sm">
                                      <Check className="h-6 w-6 text-primary drop-shadow-md" />
                                    </div>
                                  )}

                                  {/* Hover Actions */}
                                  <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                    <div 
                                      role="button"
                                      className="p-1 bg-background/90 rounded shadow-sm hover:bg-background text-foreground"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        copyAvatarUrl(variant.url)
                                      }}
                                      title="Copiar URL"
                                    >
                                      <Copy className="h-2.5 w-2.5" />
                                    </div>
                                    <div 
                                      role="button"
                                      className="p-1 bg-background/90 rounded shadow-sm hover:bg-background text-foreground"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        downloadAvatar(variant.url)
                                      }}
                                      title="Descargar"
                                    >
                                      <Download className="h-2.5 w-2.5" />
                                    </div>
                                  </div>
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
        <div className="px-4 py-3 border-t bg-muted/10 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {selectedAvatar ? '¡Excelente elección!' : 'Selecciona un avatar para continuar'}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-8">
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirm}
              disabled={!selectedAvatar}
              className="px-6 h-8 text-xs"
              size="sm"
            >
              Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}