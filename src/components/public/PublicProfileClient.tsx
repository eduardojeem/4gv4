'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { AlertCircle, ArrowLeft, MessageCircle, Settings, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProfileHeader } from '@/components/public/ProfileHeader'
import { UserStats } from '@/components/public/UserStats'
import { SocialLinks, SocialLink } from '@/components/public/SocialLinks'
import { ContentGrid } from '@/components/public/ContentGrid'
import { ContactForm } from '@/components/public/ContactForm'
import '@/styles/profile-accessibility.css'

export type PublicProfileData = {
  profile: {
    username: string
    display_name: string
    title?: string | null
    bio?: string | null
    location?: string | null
    avatar_url?: string | null
    updated_at: string
  }
  socialLinks: Array<{
    id: string
    platform: string
    url: string
    username?: string | null
    is_verified: boolean
  }>
  stats: {
    followers_count: number
    following_count: number
    posts_count: number
    projects_count: number
    profile_views?: number
    total_likes?: number
  }
  content: Array<{
    id: string
    title: string
    description?: string | null
    image_url?: string | null
    category?: string | null
    type: 'post' | 'project'
    date: string
    views?: number | null
    likes?: number | null
    comments?: number | null
    link?: string | null
    tags?: string[] | null
  }>
}

export function PublicProfileClient({ data, isOwnProfile }: { data: PublicProfileData; isOwnProfile: boolean }) {
  const [showContactForm, setShowContactForm] = useState(false)

  const profileData = {
    username: data.profile.username,
    displayName: data.profile.display_name,
    title: data.profile.title ?? undefined,
    bio: data.profile.bio ?? undefined,
    location: data.profile.location ?? undefined,
    avatarUrl: data.profile.avatar_url ?? undefined,
    email: '',
    isVerified: true,
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
                <Button variant="ghost" size="sm">
                  <Share2 className="h-4 w-4" />
                  Compartir
                </Button>

                {isOwnProfile && (
                  <Button asChild size="sm">
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

          <div>
            {!showContactForm ? (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">¿Interesado en colaborar?</h2>
                <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                  Ponte en contacto con {profileData.displayName} para discutir oportunidades de colaboración, proyectos o simplemente para conectar.
                </p>
                <Button
                  size="lg"
                  onClick={() => setShowContactForm(true)}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                >
                  <MessageCircle className="mr-2 h-5 w-5" />
                  Contactar
                </Button>
              </motion.div>
            ) : (
              <ContactForm
                recipientName={profileData.displayName}
                recipientEmail={profileData.displayName}
                onSuccess={() => setShowContactForm(false)}
                className="max-w-4xl mx-auto"
              />
            )}
          </div>
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
