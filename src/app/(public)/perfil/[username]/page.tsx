'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { ProfileHeader } from '@/components/public/ProfileHeader'
import { UserStats } from '@/components/public/UserStats'
import { SocialLinks } from '@/components/public/SocialLinks'
import { ContentGrid } from '@/components/public/ContentGrid'
import { ContactForm } from '@/components/public/ContactForm'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, ArrowLeft, Edit3, Settings, Share2, MessageCircle } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { profileService, type PublicProfileData } from '@/lib/services/profile-service'
import '@/styles/profile-accessibility.css'

function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="container max-w-6xl mx-auto px-4 py-8">
        {/* Header skeleton */}
        <div className="mb-8">
          <Skeleton className="h-12 w-32 mb-4" />
          <div className="flex flex-col sm:flex-row gap-6">
            <Skeleton className="h-32 w-32 rounded-full" />
            <div className="flex-1 space-y-4">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </div>
        
        {/* Stats skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        
        {/* Content skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    </div>
  )
}

function ProfileError({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="bg-red-100 dark:bg-red-900/20 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          Error al cargar el perfil
        </h2>
        <p className="text-muted-foreground mb-6">
          {message}
        </p>
        <Button asChild>
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al inicio
          </Link>
        </Button>
      </div>
    </div>
  )
}

export default function PublicProfilePage() {
  const params = useParams()
  const username = params.username as string
  
  const [profile, setProfile] = useState<PublicProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showContactForm, setShowContactForm] = useState(false)
  const [isOwnProfile, setIsOwnProfile] = useState(false)

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true)
        
        // Cargar perfil desde Supabase
        const data = await profileService.getPublicProfile(username)
        
        if (!data) {
          setError('Perfil no encontrado o no disponible públicamente.')
          return
        }
        
        // Verificar si es el perfil del usuario actual
        // Esto vendría del contexto de autenticación
        setIsOwnProfile(false) // Mock: siempre falso para demo
        
        setProfile(data)
      } catch (err) {
        setError('No se pudo cargar el perfil. Por favor, intenta de nuevo.')
        console.error('Error loading profile:', err)
      } finally {
        setLoading(false)
      }
    }

    if (username) {
      loadProfile()
    }
  }, [username])

  if (loading) {
    return <ProfileSkeleton />
  }

  if (error || !profile) {
    return <ProfileError message={error || 'Perfil no encontrado'} />
  }

  const handleContactSuccess = () => {
    setShowContactForm(false)
  }

  // Mapear datos del servicio al formato de los componentes
  const profileData = {
    username: profile.profile.username,
    displayName: profile.profile.display_name,
    title: profile.profile.title,
    bio: profile.profile.bio,
    location: profile.profile.location,
    avatarUrl: profile.profile.avatar_url,
    email: profile.profile.display_name, // No exponemos el email real por privacidad
    isVerified: true // Esto vendría de una verificación real
  }

  const statsData = {
    followers: profile.stats.followers_count,
    following: profile.stats.following_count,
    posts: profile.stats.posts_count,
    projects: profile.stats.projects_count,
    profileViews: profile.stats.profile_views,
    likes: profile.stats.total_likes
  }

  const socialLinksData = profile.socialLinks.map(link => ({
    platform: link.platform,
    url: link.url,
    username: link.username,
    isVerified: link.is_verified
  }))

  const contentData = profile.content.map(item => ({
    id: item.id,
    title: item.title,
    description: item.description,
    imageUrl: item.image_url,
    category: item.category,
    date: item.date,
    type: item.type,
    views: item.views,
    likes: item.likes,
    comments: item.comments,
    link: item.link,
    tags: item.tags
  }))

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-blue-950">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -right-[20%] w-[60%] h-[60%] bg-blue-500/5 rounded-full blur-[200px]" />
        <div className="absolute -bottom-[20%] -left-[20%] w-[50%] h-[50%] bg-purple-500/5 rounded-full blur-[150px]" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800"
        >
          <div className="container max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Button asChild variant="ghost" size="sm" className="profile-focus">
                <Link href="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver
                </Link>
              </Button>
              
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="profile-focus">
                  <Share2 className="h-4 w-4" />
                  Compartir
                </Button>
                
                {isOwnProfile && (
                  <Button asChild size="sm" className="profile-focus">
                    <Link href="/perfil">
                      <Settings className="mr-2 h-4 w-4" />
                      Configurar
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </motion.header>

        {/* Skip link for keyboard navigation */}
        <a href="#main-content" className="skip-link">
          Saltar al contenido principal
        </a>

        {/* Main content */}
        <main id="main-content" className="container max-w-6xl mx-auto px-4 py-8 space-y-12">
          {/* Profile Header */}
          <ProfileHeader
            username={profileData.username}
            displayName={profileData.displayName}
            title={profileData.title}
            bio={profileData.bio}
            location={profileData.location}
            avatarUrl={profileData.avatarUrl}
            email={profileData.email}
            isVerified={profileData.isVerified}
            isOwnProfile={isOwnProfile}
            className="profile-animation"
          />

          {/* User Stats */}
          <UserStats
            followers={statsData.followers}
            following={statsData.following}
            posts={statsData.posts}
            projects={statsData.projects}
            profileViews={statsData.profileViews}
            likes={statsData.likes}
            className="profile-animation"
          />

          {/* Social Links */}
          {socialLinksData.length > 0 && (
            <SocialLinks
              links={socialLinksData}
              showVerification={true}
              className="profile-animation"
            />
          )}

          {/* Content Grid */}
          {contentData.length > 0 && (
            <ContentGrid
              items={contentData}
              title="Publicaciones y Proyectos"
              description={`Explora el contenido y proyectos de ${profileData.displayName}`}
              showFilters={true}
              showStats={true}
              className="profile-animation"
            />
          )}

          {/* Contact Section */}
          <div className="profile-animation">
            {!showContactForm ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
              >
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                  ¿Interesado en colaborar?
                </h2>
                <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                  Ponte en contacto con {profileData.displayName} para discutir oportunidades de colaboración, proyectos o simplemente para conectar.
                </p>
                <Button
                  size="lg"
                  onClick={() => setShowContactForm(true)}
                  className="profile-button bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                >
                  <MessageCircle className="mr-2 h-5 w-5" />
                  Contactar
                </Button>
              </motion.div>
            ) : (
              <ContactForm
                recipientName={profileData.displayName}
                recipientEmail={profileData.displayName} // Usamos el nombre como placeholder
                onSuccess={handleContactSuccess}
                className="max-w-4xl mx-auto"
              />
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200 dark:border-slate-800 mt-16">
          <div className="container max-w-6xl mx-auto px-4 py-8 text-center text-muted-foreground">
            <p>Perfil de {profileData.displayName} • Última actualización: {new Date(profile.profile.updated_at).toLocaleDateString('es-ES')}</p>
          </div>
        </footer>
      </div>
    </div>
  )
}