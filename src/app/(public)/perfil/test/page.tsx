'use client'

import React from 'react'
import { ProfileHeader } from '@/components/public/ProfileHeader'
import { UserStats } from '@/components/public/UserStats'
import { SocialLinks } from '@/components/public/SocialLinks'
import { ContentGrid } from '@/components/public/ContentGrid'
import { ContactForm } from '@/components/public/ContactForm'

export default function ProfileTestPage() {
  const mockSocialLinks = [
    {
      platform: 'twitter' as const,
      url: 'https://twitter.com/juanperez',
      username: 'juanperez',
      isVerified: true
    },
    {
      platform: 'linkedin' as const,
      url: 'https://linkedin.com/in/juanperez',
      username: 'juanperez',
      isVerified: true
    },
    {
      platform: 'github' as const,
      url: 'https://github.com/juanperez',
      username: 'juanperez',
      isVerified: false
    }
  ]

  const mockContent = [
    {
      id: '1',
      title: 'Cómo construir una API REST con Node.js y Express',
      description: 'Guía completa para crear una API REST robusta y escalable usando Node.js, Express y mejores prácticas modernas.',
      imageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&h=400&fit=crop',
      category: 'Desarrollo',
      date: '2024-01-15',
      type: 'post' as const,
      views: 245,
      likes: 18,
      comments: 5,
      tags: ['nodejs', 'api', 'javascript', 'backend'],
      link: 'https://example.com/post1'
    },
    {
      id: '2',
      title: 'Sistema de Gestión de Tareas',
      description: 'Aplicación web completa para gestión de tareas personales y de equipo con autenticación y notificaciones en tiempo real.',
      imageUrl: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=600&h=400&fit=crop',
      category: 'Proyectos',
      date: '2024-01-10',
      type: 'project' as const,
      views: 156,
      likes: 23,
      comments: 8,
      tags: ['react', 'nodejs', 'mongodb', 'realtime'],
      link: 'https://github.com/juanperez/task-manager'
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-blue-950 p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        <h1 className="text-4xl font-bold text-center text-slate-900 dark:text-white mb-8">
          Prueba de Componentes de Perfil Público
        </h1>

        {/* Profile Header */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Profile Header</h2>
          <ProfileHeader
            username="juanperez"
            displayName="Juan Pérez"
            title="Desarrollador Full Stack"
            bio="Apasionado por la tecnología y el desarrollo web. Especializado en React, Node.js y cloud computing."
            location="Asunción, Paraguay"
            avatarUrl="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face"
            email="juan.perez@example.com"
            isVerified={true}
            isOwnProfile={false}
          />
        </section>

        {/* User Stats */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">User Stats</h2>
          <UserStats
            followers={1250}
            following={890}
            posts={45}
            projects={12}
            profileViews={3200}
            likes={567}
          />
        </section>

        {/* Social Links */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Social Links</h2>
          <SocialLinks
            links={mockSocialLinks}
            showVerification={true}
          />
        </section>

        {/* Content Grid */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Content Grid</h2>
          <ContentGrid
            items={mockContent}
            title="Publicaciones y Proyectos"
            description="Explora el contenido y proyectos"
            showFilters={true}
            showStats={true}
          />
        </section>

        {/* Contact Form */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Contact Form</h2>
          <ContactForm
            recipientName="Juan Pérez"
            recipientEmail="juan.perez@example.com"
          />
        </section>
      </div>
    </div>
  )
}