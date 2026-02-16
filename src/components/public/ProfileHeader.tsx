'use client'

import React from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MapPin, Calendar, CheckCircle2, Edit3, Mail, Briefcase } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ProfileHeaderProps {
  username: string
  displayName: string
  title?: string
  bio?: string
  location?: string
  avatarUrl?: string
  email?: string
  isVerified?: boolean
  isOwnProfile?: boolean
  onEditClick?: () => void
  className?: string
}

export function ProfileHeader({
  username,
  displayName,
  title,
  bio,
  location,
  avatarUrl,
  email,
  isVerified = true,
  isOwnProfile = false,
  onEditClick,
  className
}: ProfileHeaderProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className={cn("relative overflow-hidden", className)}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.1),transparent_50%)]" />
      
      <div className="relative px-6 py-8 sm:px-8 sm:py-12">
        <div className="flex flex-col items-center text-center sm:flex-row sm:text-left sm:items-start gap-6">
          {/* Avatar Section */}
          <div className="relative group">
            <div className="absolute -inset-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full blur-lg opacity-25 group-hover:opacity-40 transition-opacity duration-300" />
            <Avatar className="h-32 w-32 sm:h-40 sm:w-40 ring-4 ring-white dark:ring-slate-800 shadow-2xl relative">
              <AvatarImage 
                src={avatarUrl} 
                alt={`${displayName}'s avatar`}
                className="object-cover"
              />
              <AvatarFallback className="text-2xl sm:text-3xl font-bold bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            
            {/* Verification badge */}
            {isVerified && (
              <div className="absolute -bottom-2 -right-2 bg-green-500 rounded-full p-2 shadow-lg">
                <CheckCircle2 className="h-5 w-5 text-white" />
              </div>
            )}
            
            {/* Edit button for own profile */}
            {isOwnProfile && onEditClick && (
              <Button
                onClick={onEditClick}
                size="sm"
                variant="secondary"
                className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full shadow-lg"
              >
                <Edit3 className="h-3 w-3 mr-1" />
                Editar
              </Button>
            )}
          </div>

          {/* Profile Info */}
          <div className="flex-1 space-y-4">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
                <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                  {displayName}
                </h1>
                <div className="flex items-center gap-2">
                  {isVerified && (
                    <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Verificado
                    </Badge>
                  )}
                  <span className="text-sm text-muted-foreground font-medium">
                    @{username}
                  </span>
                </div>
              </div>
              
              {title && (
                <div className="flex items-center gap-2 text-lg text-muted-foreground">
                  <Briefcase className="h-4 w-4" />
                  <span className="font-medium">{title}</span>
                </div>
              )}
            </div>

            {bio && (
              <p className="text-base text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                {bio}
              </p>
            )}

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {location && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  <span>{location}</span>
                </div>
              )}
              {email && (
                <div className="flex items-center gap-1.5">
                  <Mail className="h-4 w-4" />
                  <span>{email}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                <span>Se unió en {new Date().getFullYear()}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3 pt-2">
              {!isOwnProfile && (
                <>
                  <Button className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800">
                    Contactar
                  </Button>
                  <Button variant="outline">
                    Seguir
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}