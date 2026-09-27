'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { AlertCircle, ArrowLeft, Settings, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProfileHeader } from '@/components/public/ProfileHeader'
import { UserStats } from '@/components/public/UserStats'
import { SocialLinks, SocialLink } from '@/components/public/SocialLinks'
import { ContentGrid } from '@/components/public/ContentGrid'
import { toast } from 'sonner'
import type { PublicProfileData } from '@/lib/profile/public-profile'
import '@/styles/profile-accessibility.css'

export type { PublicProfileData } from '@/lib/profile/public-profile'

export function PublicProfileClient({ data, isOwnProfile }: { data: PublicProfileData; isOwnProfile: boolean }) {
  const profileData = {
    username: data.profile.username,
    displayName: data.profile.display_name,
    title: data.profile.title ?? undefined,
    bio: data.profile.bio ?? undefined,
    location: data.profile.location ?? undefined,
    avatarUrl: data.profile.avatar_url ?? undefined,
    email: '',
    isVerified: data.profile.verified,
  }

  const statsData = {
    followers: data.stats.followers_count,
    following: data.stats.following_count,
    posts: data.stats.posts_count,
    projects: data.stats.projects_count,
    profileViews: data.stats.profile_views ?? 0,
    likes: data.stats.total_likes ?? 0,
  }

  const socialLinksData = data.socialLinks.map((link) => ({
    platform: link.platform as SocialLink['platform'],
    url: link.url,
    username: link.username ?? undefined,
    isVerified: link.is_verified,
  }))

  const contentData = data.content.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description ?? undefined,
    imageUrl: item.image_url ?? undefined,
    category: item.category ?? undefined,
    date: item.date,
    type: item.type,
    views: item.views ?? 0,
    likes: item.likes ?? 0,
    comments: item.comments ?? 0,
    link: item.link ?? undefined,
    tags: item.tags ?? undefined,
  }))

  const handleShare = async () => {
    const shareData = { title: profileData.displayName, text: `Perfil de ${profileData.displayName}`, url: window.location.href }
    try {
      if (navigator.share) await navigator.share(shareData)
      else {
        await navigator.clipboard.writeText(shareData.url)
        toast.success('Enlace copiado')
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      toast.error('No se pudo compartir el perfil')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-blue-950">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -right-[20%] w-[60%] h-[60%] bg-blue-500/5 rounded-full blur-[200px]" />
        <div className="absolute -bottom-[20%] -left-[20%] w-[50%] h-[50%] bg-purple-500/5 rounded-full blur-[150px]" />
      </div>

      <div className="relative z-10">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800"
        >
          <div className="container max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Button asChild variant="ghost" size="sm">
                <Link href="/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver
                </Link>
              </Button>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleShare}>
                  <Share2 className="h-4 w-4" />
                  Compartir
                </Button>

                {isOwnProfile && (
                  <Button asChild size="sm">
                    {/* Bare /perfil hereda la vidriera de una tienda cualquiera
                        por defecto: este perfil publico no pertenece a ninguna
                        tienda, asi que el link tiene que quedarse en el
                        marketplace, igual que el resto de la nav. */}
                    <Link href="/marketplace/perfil#datos-personales">
                      <Settings className="mr-2 h-4 w-4" />
                      Configurar
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </motion.header>

        <a href="#main-content" className="skip-link">
          Saltar al contenido principal
        </a>

        <main id="main-content" className="container max-w-6xl mx-auto px-4 py-8 space-y-12">
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
          />

          <UserStats
            followers={statsData.followers}
            following={statsData.following}
            posts={statsData.posts}
            projects={statsData.projects}
            profileViews={statsData.profileViews}
            likes={statsData.likes}
          />

          {socialLinksData.length > 0 && (
            <SocialLinks links={socialLinksData} showVerification={true} />
          )}

          {contentData.length > 0 && (
            <ContentGrid
              items={contentData}
              title="Publicaciones y Proyectos"
              description={`Explora el contenido y proyectos de ${profileData.displayName}`}
              showFilters={true}
              showStats={true}
            />
          )}

        </main>

        <footer className="border-t border-slate-200 dark:border-slate-800 mt-16">
          <div className="container max-w-6xl mx-auto px-4 py-8 text-center text-muted-foreground">
            <p>
              Perfil de {profileData.displayName} • Última actualización:{' '}
              {new Date(data.profile.updated_at).toLocaleDateString('es-ES')}
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}

export function ProfileError({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="bg-red-100 dark:bg-red-900/20 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Error al cargar el perfil</h2>
        <p className="text-muted-foreground mb-6">{message}</p>
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
