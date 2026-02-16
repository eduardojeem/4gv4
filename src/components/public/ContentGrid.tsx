'use client'

import React, { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Calendar, 
  Eye, 
  Heart, 
  MessageCircle,
  ExternalLink,
  Filter,
  Grid3x3,
  List
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { LazyImage } from '@/components/ui/lazy-image'

interface ContentItem {
  id: string
  title: string
  description: string
  imageUrl?: string
  category: string
  date: string
  views?: number
  likes?: number
  comments?: number
  link?: string
  type: 'post' | 'project'
  tags?: string[]
}

interface ContentGridProps {
  items: ContentItem[]
  title?: string
  description?: string
  showFilters?: boolean
  showStats?: boolean
  className?: string
}

function ContentCard({ item, showStats }: { item: ContentItem; showStats: boolean }) {
  const [isHovered, setIsHovered] = useState(false)
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'tecnología': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      'diseño': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
      'negocios': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      'marketing': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
      'desarrollo': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300'
    }
    return colors[category.toLowerCase()] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      whileHover={{ y: -4 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="h-full"
    >
      <Card className={cn(
        "h-full border-none shadow-lg bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm",
        "hover:shadow-xl transition-all duration-300 overflow-hidden group"
      )}>
        {/* Image */}
        {item.imageUrl && (
          <div className="relative aspect-video overflow-hidden">
            <LazyImage
              src={item.imageUrl}
              alt={item.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            {/* Category badge */}
            <div className="absolute top-3 left-3">
              <Badge className={cn("text-xs font-medium", getCategoryColor(item.category))}>
                {item.category}
              </Badge>
            </div>
            
            {/* Link overlay */}
            {item.link && (
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 z-10"
                aria-label={`Ver ${item.title}`}
              >
                <span className="sr-only">Ver {item.title}</span>
              </a>
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white line-clamp-2 group-hover:text-primary transition-colors">
                {item.title}
              </h3>
              {!item.imageUrl && (
                <Badge className={cn("text-xs font-medium", getCategoryColor(item.category))}>
                  {item.category}
                </Badge>
              )}
            </div>
            
            <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed">
              {item.description}
            </p>
          </div>

          {/* Tags */}
          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {item.tags.slice(0, 3).map((tag, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  #{tag}
                </Badge>
              ))}
              {item.tags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{item.tags.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>{formatDate(item.date)}</span>
              </div>
              
              {showStats && (
                <>
                  {item.views && (
                    <div className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      <span>{item.views}</span>
                    </div>
                  )}
                  {item.likes && (
                    <div className="flex items-center gap-1">
                      <Heart className="h-3 w-3" />
                      <span>{item.likes}</span>
                    </div>
                  )}
                  {item.comments && (
                    <div className="flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" />
                      <span>{item.comments}</span>
                    </div>
                  )}
                </>
              )}
            </div>
            
            {item.link && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                asChild
              >
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1"
                >
                  <span>Ver</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </Card>
    </motion.article>
  )
}

export function ContentGrid({
  items,
  title = "Contenido",
  description,
  showFilters = true,
  showStats = true,
  className
}: ContentGridProps) {
  const [filter, setFilter] = useState<'all' | 'post' | 'project'>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const filteredItems = items.filter(item => 
    filter === 'all' || item.type === filter
  )

  const categories = Array.from(new Set(items.map(item => item.category)))

  return (
    <section className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            {title}
          </h2>
          {description && (
            <p className="text-muted-foreground">
              {description}
            </p>
          )}
        </motion.div>

        {/* Controls */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2"
          >
            {/* Filter buttons */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <Button
                size="sm"
                variant={filter === 'all' ? 'default' : 'ghost'}
                onClick={() => setFilter('all')}
                className="h-8 px-3 text-sm"
              >
                Todo
              </Button>
              <Button
                size="sm"
                variant={filter === 'post' ? 'default' : 'ghost'}
                onClick={() => setFilter('post')}
                className="h-8 px-3 text-sm"
              >
                Publicaciones
              </Button>
              <Button
                size="sm"
                variant={filter === 'project' ? 'default' : 'ghost'}
                onClick={() => setFilter('project')}
                className="h-8 px-3 text-sm"
              >
                Proyectos
              </Button>
            </div>

            {/* View mode toggle */}
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                onClick={() => setViewMode('grid')}
                className="h-8 w-8 p-0"
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                onClick={() => setViewMode('list')}
                className="h-8 w-8 p-0"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Content */}
      <AnimatePresence mode="popLayout">
        <motion.div
          layout
          className={cn(
            "grid gap-6",
            viewMode === 'grid' 
              ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" 
              : "grid-cols-1"
          )}
        >
          {filteredItems.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              showStats={showStats}
            />
          ))}
        </motion.div>
      </AnimatePresence>

      {/* Empty state */}
      {filteredItems.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <div className="text-muted-foreground">
            <p className="text-lg font-medium mb-2">No hay contenido disponible</p>
            <p className="text-sm">
              {filter === 'all' 
                ? "Aún no hay publicaciones o proyectos para mostrar."
                : `No hay ${filter === 'post' ? 'publicaciones' : 'proyectos'} para mostrar.`
              }
            </p>
          </div>
        </motion.div>
      )}
    </section>
  )
}