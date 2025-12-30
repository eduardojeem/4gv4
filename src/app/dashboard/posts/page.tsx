'use client'

import { useState, useMemo, useCallback } from 'react'
import { 
  Search, 
  Plus, 
  Filter, 
  Grid3X3, 
  List, 
  Eye, 
  Heart, 
  MessageCircle, 
  Calendar, 
  User, 
  Tag, 
  MoreHorizontal,
  Edit,
  Trash2,
  Share2,
  BookOpen,
  TrendingUp,
  Clock,
  Star,
  ChevronDown,
  X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

// Tipos de datos
interface Post {
  id: string
  title: string
  content: string
  excerpt: string
  author: {
    name: string
    avatar: string
    role: string
  }
  category: string
  tags: string[]
  status: 'draft' | 'published' | 'archived'
  publishedAt: string
  updatedAt: string
  metrics: {
    views: number
    likes: number
    comments: number
    shares: number
  }
  featured: boolean
  readTime: number
  image?: string
}

// Datos de ejemplo
const mockPosts: Post[] = [
  {
    id: '1',
    title: 'Guía Completa de Gestión de Inventario para Pequeñas Empresas',
    content: 'En este artículo exploramos las mejores prácticas para gestionar el inventario de manera eficiente...',
    excerpt: 'Descubre las estrategias más efectivas para optimizar tu inventario y reducir costos operativos.',
    author: {
      name: 'María González',
      avatar: '/avatars/maria.jpg',
      role: 'Especialista en Inventario'
    },
    category: 'Gestión',
    tags: ['inventario', 'gestión', 'pequeñas empresas', 'optimización'],
    status: 'published',
    publishedAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-15T10:30:00Z',
    metrics: {
      views: 1250,
      likes: 89,
      comments: 23,
      shares: 15
    },
    featured: true,
    readTime: 8,
    image: '/posts/inventory-guide.jpg'
  },
  {
    id: '2',
    title: 'Tendencias en Sistemas POS para 2024',
    content: 'Los sistemas de punto de venta están evolucionando rápidamente...',
    excerpt: 'Explora las últimas innovaciones en tecnología POS que están transformando el retail.',
    author: {
      name: 'Carlos Rodríguez',
      avatar: '/avatars/carlos.jpg',
      role: 'Analista de Tecnología'
    },
    category: 'Tecnología',
    tags: ['pos', 'tecnología', 'tendencias', 'retail'],
    status: 'published',
    publishedAt: '2024-01-14T14:20:00Z',
    updatedAt: '2024-01-14T14:20:00Z',
    metrics: {
      views: 890,
      likes: 67,
      comments: 18,
      shares: 12
    },
    featured: false,
    readTime: 6,
    image: '/posts/pos-trends.jpg'
  },
  {
    id: '3',
    title: 'Cómo Mejorar la Experiencia del Cliente en tu Tienda',
    content: 'La experiencia del cliente es fundamental para el éxito de cualquier negocio...',
    excerpt: 'Estrategias probadas para crear experiencias memorables que fidelicen a tus clientes.',
    author: {
      name: 'Ana Martínez',
      avatar: '/avatars/ana.jpg',
      role: 'Consultora de CX'
    },
    category: 'Marketing',
    tags: ['experiencia cliente', 'servicio', 'fidelización', 'ventas'],
    status: 'published',
    publishedAt: '2024-01-13T09:15:00Z',
    updatedAt: '2024-01-13T09:15:00Z',
    metrics: {
      views: 2100,
      likes: 156,
      comments: 42,
      shares: 28
    },
    featured: true,
    readTime: 10,
    image: '/posts/customer-experience.jpg'
  },
  {
    id: '4',
    title: 'Análisis de Datos de Ventas: Métricas Clave',
    content: 'Los datos de ventas contienen información valiosa para la toma de decisiones...',
    excerpt: 'Aprende a interpretar las métricas más importantes para impulsar tu negocio.',
    author: {
      name: 'Luis Fernández',
      avatar: '/avatars/luis.jpg',
      role: 'Analista de Datos'
    },
    category: 'Analytics',
    tags: ['datos', 'ventas', 'métricas', 'análisis'],
    status: 'draft',
    publishedAt: '',
    updatedAt: '2024-01-12T16:45:00Z',
    metrics: {
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0
    },
    featured: false,
    readTime: 12,
    image: '/posts/sales-analytics.jpg'
  },
  {
    id: '5',
    title: 'Automatización de Procesos en el Retail',
    content: 'La automatización está revolucionando la forma en que operan las tiendas...',
    excerpt: 'Descubre cómo la automatización puede reducir costos y mejorar la eficiencia.',
    author: {
      name: 'Patricia Silva',
      avatar: '/avatars/patricia.jpg',
      role: 'Especialista en Automatización'
    },
    category: 'Tecnología',
    tags: ['automatización', 'retail', 'eficiencia', 'procesos'],
    status: 'published',
    publishedAt: '2024-01-11T11:30:00Z',
    updatedAt: '2024-01-11T11:30:00Z',
    metrics: {
      views: 756,
      likes: 45,
      comments: 12,
      shares: 8
    },
    featured: false,
    readTime: 7,
    image: '/posts/automation.jpg'
  }
]

const categories = ['Todos', 'Gestión', 'Tecnología', 'Marketing', 'Analytics', 'Ventas']
const statusOptions = ['Todos', 'Publicado', 'Borrador', 'Archivado']

export default function PostsPage() {
  // Estados principales
  const [posts, setPosts] = useState<Post[]>(mockPosts)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Todos')
  const [selectedStatus, setSelectedStatus] = useState('Todos')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState('publishedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false)

  // Estados para nuevo post
  const [newPost, setNewPost] = useState<{ title: string; content: string; excerpt: string; category: string; tags: string; status: Post['status']; featured: boolean }>({
    title: '',
    content: '',
    excerpt: '',
    category: '',
    tags: '',
    status: 'draft',
    featured: false
  })

  // Obtener todas las etiquetas únicas
  const allTags = useMemo(() => {
    const tags = new Set<string>()
    posts.forEach(post => post.tags.forEach(tag => tags.add(tag)))
    return Array.from(tags).sort()
  }, [posts])

  // Filtrar y ordenar posts
  const filteredPosts = useMemo(() => {
    const filtered = posts.filter(post => {
      const matchesSearch = 
        post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.author.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchesCategory = selectedCategory === 'Todos' || post.category === selectedCategory
      
      const matchesStatus = selectedStatus === 'Todos' || 
        (selectedStatus === 'Publicado' && post.status === 'published') ||
        (selectedStatus === 'Borrador' && post.status === 'draft') ||
        (selectedStatus === 'Archivado' && post.status === 'archived')

      const matchesTags = selectedTags.length === 0 || 
        selectedTags.some(tag => post.tags.includes(tag))

      return matchesSearch && matchesCategory && matchesStatus && matchesTags
    })

    // Ordenamiento
    filtered.sort((a, b) => {
      let aValue: any, bValue: any
      
      switch (sortBy) {
        case 'title':
          aValue = a.title.toLowerCase()
          bValue = b.title.toLowerCase()
          break
        case 'publishedAt':
          aValue = new Date(a.publishedAt || a.updatedAt)
          bValue = new Date(b.publishedAt || b.updatedAt)
          break
        case 'views':
          aValue = a.metrics.views
          bValue = b.metrics.views
          break
        case 'likes':
          aValue = a.metrics.likes
          bValue = b.metrics.likes
          break
        default:
          aValue = a.title.toLowerCase()
          bValue = b.title.toLowerCase()
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })

    return filtered
  }, [posts, searchTerm, selectedCategory, selectedStatus, selectedTags, sortBy, sortOrder])

  // Estadísticas
  const stats = useMemo(() => {
    const published = posts.filter(p => p.status === 'published')
    const totalViews = published.reduce((sum, p) => sum + p.metrics.views, 0)
    const totalLikes = published.reduce((sum, p) => sum + p.metrics.likes, 0)
    const avgReadTime = published.reduce((sum, p) => sum + p.readTime, 0) / published.length || 0

    return {
      total: posts.length,
      published: published.length,
      drafts: posts.filter(p => p.status === 'draft').length,
      totalViews,
      totalLikes,
      avgReadTime: Math.round(avgReadTime)
    }
  }, [posts])

  // Funciones de utilidad
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Sin fecha'
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      published: 'default',
      draft: 'secondary',
      archived: 'outline'
    } as const

    const labels = {
      published: 'Publicado',
      draft: 'Borrador',
      archived: 'Archivado'
    }

    return (
      <Badge variant={variants[status as keyof typeof variants]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    )
  }

  const handleCreatePost = () => {
    const post: Post = {
      id: Date.now().toString(),
      title: newPost.title,
      content: newPost.content,
      excerpt: newPost.excerpt,
      author: {
        name: 'Usuario Actual',
        avatar: '/avatars/current-user.jpg',
        role: 'Editor'
      },
      category: newPost.category,
      tags: newPost.tags.split(',').map(tag => tag.trim()).filter(Boolean),
      status: newPost.status,
      publishedAt: newPost.status === 'published' ? new Date().toISOString() : '',
      updatedAt: new Date().toISOString(),
      metrics: {
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0
      },
      featured: newPost.featured,
      readTime: Math.ceil(newPost.content.length / 200) // Estimación simple
    }

    setPosts(prev => [post, ...prev])
    setNewPost({
      title: '',
      content: '',
      excerpt: '',
      category: '',
      tags: '',
      status: 'draft',
      featured: false
    })
    setIsCreatePostOpen(false)
  }

  const removeTag = (tagToRemove: string) => {
    setSelectedTags(prev => prev.filter(tag => tag !== tagToRemove))
  }

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedCategory('Todos')
    setSelectedStatus('Todos')
    setSelectedTags([])
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Posts</h1>
          <p className="text-gray-600">Gestiona y publica contenido para tu audiencia</p>
        </div>
        <Dialog open={isCreatePostOpen} onOpenChange={setIsCreatePostOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nuevo Post
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Post</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  value={newPost.title}
                  onChange={(e) => setNewPost(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Título del post..."
                />
              </div>
              <div>
                <Label htmlFor="excerpt">Extracto</Label>
                <Textarea
                  id="excerpt"
                  value={newPost.excerpt}
                  onChange={(e) => setNewPost(prev => ({ ...prev, excerpt: e.target.value }))}
                  placeholder="Breve descripción del post..."
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="content">Contenido</Label>
                <Textarea
                  id="content"
                  value={newPost.content}
                  onChange={(e) => setNewPost(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Contenido completo del post..."
                  rows={8}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">Categoría</Label>
                  <Select value={newPost.category} onValueChange={(value) => setNewPost(prev => ({ ...prev, category: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.filter(cat => cat !== 'Todos').map(category => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status">Estado</Label>
                  <Select value={newPost.status} onValueChange={(value: 'draft' | 'published') => setNewPost(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Borrador</SelectItem>
                      <SelectItem value="published">Publicar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="tags">Etiquetas (separadas por comas)</Label>
                <Input
                  id="tags"
                  value={newPost.tags}
                  onChange={(e) => setNewPost(prev => ({ ...prev, tags: e.target.value }))}
                  placeholder="etiqueta1, etiqueta2, etiqueta3..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsCreatePostOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreatePost} disabled={!newPost.title || !newPost.content}>
                  Crear Post
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <BookOpen className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Posts</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Eye className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Publicados</p>
                <p className="text-2xl font-bold text-gray-900">{stats.published}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Edit className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Borradores</p>
                <p className="text-2xl font-bold text-gray-900">{stats.drafts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Vistas</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalViews.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <Heart className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Likes</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalLikes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Clock className="h-6 w-6 text-indigo-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Lectura Prom.</p>
                <p className="text-2xl font-bold text-gray-900">{stats.avgReadTime}min</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros y Búsqueda */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros y Búsqueda
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              >
                {viewMode === 'grid' ? <List className="h-4 w-4" /> : <Grid3X3 className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4" />
                {showFilters ? 'Ocultar' : 'Mostrar'} Filtros
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Búsqueda principal */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar por título, contenido, autor o etiquetas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filtros avanzados */}
          {showFilters && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(category => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(status => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger>
                    <SelectValue placeholder="Ordenar por" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="publishedAt">Fecha</SelectItem>
                    <SelectItem value="title">Título</SelectItem>
                    <SelectItem value="views">Vistas</SelectItem>
                    <SelectItem value="likes">Likes</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortOrder} onValueChange={(value: 'asc' | 'desc') => setSortOrder(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Orden" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">Descendente</SelectItem>
                    <SelectItem value="asc">Ascendente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Etiquetas seleccionadas */}
              {selectedTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm font-medium text-gray-600">Etiquetas:</span>
                  {selectedTags.map(tag => (
                    <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                      {tag}
                      <X 
                        className="h-3 w-3 cursor-pointer" 
                        onClick={() => removeTag(tag)}
                      />
                    </Badge>
                  ))}
                </div>
              )}

              {/* Etiquetas disponibles */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Filtrar por etiquetas:</Label>
                <div className="flex flex-wrap gap-2">
                  {allTags.map(tag => (
                    <Badge
                      key={tag}
                      variant={selectedTags.includes(tag) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        if (selectedTags.includes(tag)) {
                          removeTag(tag)
                        } else {
                          setSelectedTags(prev => [...prev, tag])
                        }
                      }}
                    >
                      <Tag className="h-3 w-3 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <Button variant="outline" onClick={clearFilters}>
                  Limpiar Filtros
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de Posts */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPosts.map((post) => (
            <Card key={post.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="space-y-4">
                  {/* Header del post */}
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(post.status)}
                      {post.featured && (
                        <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                          <Star className="h-3 w-3 mr-1" />
                          Destacado
                        </Badge>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Share2 className="h-4 w-4 mr-2" />
                          Compartir
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Título y extracto */}
                  <div>
                    <h3 className="font-semibold text-lg mb-2 line-clamp-2">
                      {post.title}
                    </h3>
                    <p className="text-gray-600 text-sm line-clamp-3">
                      {post.excerpt}
                    </p>
                  </div>

                  {/* Autor y fecha */}
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={post.author.avatar} />
                      <AvatarFallback>
                        {post.author.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {post.author.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(post.publishedAt || post.updatedAt)}
                      </p>
                    </div>
                  </div>

                  {/* Categoría y tiempo de lectura */}
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <Badge variant="outline">{post.category}</Badge>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {post.readTime} min
                    </span>
                  </div>

                  {/* Etiquetas */}
                  <div className="flex flex-wrap gap-1">
                    {post.tags.slice(0, 3).map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {post.tags.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{post.tags.length - 3}
                      </Badge>
                    )}
                  </div>

                  {/* Métricas */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Eye className="h-4 w-4" />
                        {post.metrics.views}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="h-4 w-4" />
                        {post.metrics.likes}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-4 w-4" />
                        {post.metrics.comments}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {filteredPosts.map((post) => (
                <div key={post.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(post.status)}
                        {post.featured && (
                          <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                            <Star className="h-3 w-3 mr-1" />
                            Destacado
                          </Badge>
                        )}
                        <Badge variant="outline">{post.category}</Badge>
                      </div>
                      
                      <div>
                        <h3 className="font-semibold text-lg mb-1">{post.title}</h3>
                        <p className="text-gray-600 text-sm">{post.excerpt}</p>
                      </div>

                      <div className="flex items-center gap-6 text-sm text-gray-500">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={post.author.avatar} />
                            <AvatarFallback>
                              {post.author.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <span>{post.author.name}</span>
                        </div>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDate(post.publishedAt || post.updatedAt)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {post.readTime} min
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap gap-1">
                          {post.tags.slice(0, 4).map(tag => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {post.tags.length > 4 && (
                            <Badge variant="secondary" className="text-xs">
                              +{post.tags.length - 4}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Eye className="h-4 w-4" />
                            {post.metrics.views}
                          </span>
                          <span className="flex items-center gap-1">
                            <Heart className="h-4 w-4" />
                            {post.metrics.likes}
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageCircle className="h-4 w-4" />
                            {post.metrics.comments}
                          </span>
                        </div>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="ml-4">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Share2 className="h-4 w-4 mr-2" />
                          Compartir
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mensaje cuando no hay resultados */}
      {filteredPosts.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No se encontraron posts</h3>
            <p className="text-muted-foreground text-center mb-4">
              No hay posts que coincidan con los filtros aplicados.
            </p>
            <Button variant="outline" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}