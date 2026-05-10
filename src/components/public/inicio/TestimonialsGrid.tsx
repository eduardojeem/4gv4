'use client'

import { Star } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import type { Testimonial } from '@/types/website-settings'

interface TestimonialsGridProps {
  testimonials: Testimonial[]
}

export function TestimonialsGrid({ testimonials }: TestimonialsGridProps) {
  if (testimonials.length === 0) return null

  return (
    <section className="border-t bg-muted/40 py-16 md:py-24">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Lo que dicen nuestros clientes
          </h2>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <Card key={testimonial.id} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col pt-6">
                {/* Stars */}
                <div className="flex gap-1 text-yellow-400">
                  {[...Array(Math.max(0, Math.min(5, Math.round(Number(testimonial.rating) || 0))))].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>

                {/* Comment */}
                <p className="mt-4 flex-1 text-sm text-muted-foreground">
                  &ldquo;{testimonial.comment}&rdquo;
                </p>

                {/* Author */}
                <div className="mt-6 flex items-center gap-3 border-t pt-4">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={testimonial.avatarUrl} alt={testimonial.name} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                      {testimonial.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{testimonial.name}</p>
                    {testimonial.role && (
                      <p className="truncate text-xs text-muted-foreground">{testimonial.role}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
