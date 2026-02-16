'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { Users, Package, Award, TrendingUp, Eye, Heart } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  color: 'blue' | 'green' | 'purple' | 'orange' | 'pink' | 'red'
  className?: string
}

function StatCard({ icon, label, value, color, className }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400',
    green: 'bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400',
    purple: 'bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400',
    orange: 'bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400',
    pink: 'bg-pink-500/10 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400',
    red: 'bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      className={cn("h-full", className)}
    >
      <Card className="h-full border-none shadow-lg bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm hover:shadow-xl transition-all duration-300 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={cn("p-3 rounded-xl", colorClasses[color])}>
            {icon}
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            {value}
          </p>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
            {label}
          </p>
        </div>
      </Card>
    </motion.div>
  )
}

interface UserStatsProps {
  followers?: number
  following?: number
  posts?: number
  projects?: number
  profileViews?: number
  likes?: number
  className?: string
}

export function UserStats({
  followers = 0,
  following = 0,
  posts = 0,
  projects = 0,
  profileViews = 0,
  likes = 0,
  className
}: UserStatsProps) {
  const stats = [
    {
      icon: <Users className="h-6 w-6" />,
      label: 'Seguidores',
      value: followers.toLocaleString(),
      color: 'blue' as const
    },
    {
      icon: <TrendingUp className="h-6 w-6" />,
      label: 'Siguiendo',
      value: following.toLocaleString(),
      color: 'green' as const
    },
    {
      icon: <Package className="h-6 w-6" />,
      label: 'Publicaciones',
      value: posts.toLocaleString(),
      color: 'purple' as const
    },
    {
      icon: <Award className="h-6 w-6" />,
      label: 'Proyectos',
      value: projects.toLocaleString(),
      color: 'orange' as const
    },
    {
      icon: <Eye className="h-6 w-6" />,
      label: 'Vistas de Perfil',
      value: profileViews.toLocaleString(),
      color: 'pink' as const
    },
    {
      icon: <Heart className="h-6 w-6" />,
      label: 'Me Gusta',
      value: likes.toLocaleString(),
      color: 'red' as const
    }
  ]

  return (
    <section className={cn("space-y-6", className)}>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="text-center sm:text-left"
      >
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Estadísticas
        </h2>
        <p className="text-muted-foreground">
          Métricas y actividad del perfil
        </p>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <StatCard {...stat} />
          </motion.div>
        ))}
      </div>
    </section>
  )
}