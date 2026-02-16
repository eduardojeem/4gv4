'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Twitter, 
  Linkedin, 
  Github, 
  Globe, 
  Instagram,
  ExternalLink,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface SocialLink {
  platform: 'twitter' | 'linkedin' | 'github' | 'website' | 'instagram'
  url: string
  isVerified?: boolean
  username?: string
}

interface SocialLinksProps {
  links: SocialLink[]
  showVerification?: boolean
  className?: string
}

const platformConfig = {
  twitter: {
    name: 'Twitter',
    icon: Twitter,
    color: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
    hoverColor: 'hover:bg-blue-500 hover:text-white'
  },
  linkedin: {
    name: 'LinkedIn',
    icon: Linkedin,
    color: 'bg-blue-600/10 text-blue-700 dark:bg-blue-600/20 dark:text-blue-400',
    hoverColor: 'hover:bg-blue-600 hover:text-white'
  },
  github: {
    name: 'GitHub',
    icon: Github,
    color: 'bg-gray-800/10 text-gray-800 dark:bg-gray-800/20 dark:text-gray-300',
    hoverColor: 'hover:bg-gray-800 hover:text-white'
  },
  website: {
    name: 'Website',
    icon: Globe,
    color: 'bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400',
    hoverColor: 'hover:bg-green-500 hover:text-white'
  },
  instagram: {
    name: 'Instagram',
    icon: Instagram,
    color: 'bg-pink-500/10 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400',
    hoverColor: 'hover:bg-pink-500 hover:text-white'
  }
}

function SocialLinkCard({ link, showVerification }: { link: SocialLink; showVerification: boolean }) {
  const config = platformConfig[link.platform]
  const Icon = config.icon
  
  const getDisplayUrl = (url: string) => {
    try {
      const urlObj = new URL(url)
      return urlObj.hostname.replace('www.', '')
    } catch {
      return url
    }
  }

  return (
    <motion.a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="block"
    >
      <Card className={cn(
        "h-full border-none shadow-lg bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm",
        "hover:shadow-xl transition-all duration-300 p-6 group cursor-pointer"
      )}>
        <div className="flex items-center justify-between mb-4">
          <div className={cn("p-3 rounded-xl transition-colors duration-300", config.color, config.hoverColor)}>
            <Icon className="h-6 w-6" />
          </div>
          {showVerification && link.isVerified && (
            <div className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 px-2 py-1 rounded-full flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              <span className="text-xs font-medium">Verificado</span>
            </div>
          )}
          {showVerification && !link.isVerified && link.platform !== 'website' && (
            <div className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-1 rounded-full flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              <span className="text-xs font-medium">No verificado</span>
            </div>
          )}
        </div>
        
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">
            {config.name}
          </h3>
          {link.username && (
            <p className="text-sm font-medium text-muted-foreground">
              @{link.username}
            </p>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{getDisplayUrl(link.url)}</span>
            <ExternalLink className="h-3 w-3" />
          </div>
        </div>
      </Card>
    </motion.a>
  )
}

export function SocialLinks({ links, showVerification = true, className }: SocialLinksProps) {
  if (!links || links.length === 0) {
    return null
  }

  return (
    <section className={cn("space-y-6", className)}>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="text-center sm:text-left"
      >
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Redes Sociales
        </h2>
        <p className="text-muted-foreground">
          Conecta conmigo en mis redes sociales
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {links.map((link, index) => (
          <motion.div
            key={link.platform}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <SocialLinkCard link={link} showVerification={showVerification} />
          </motion.div>
        ))}
      </div>
    </section>
  )
}