# Arquitectura Técnica: Sistema SaaS Multi-Tenant

## Diagrama de Arquitectura General

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND LAYER                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Next.js 16 App Router + React 19 + TypeScript          │  │
│  │  - Multi-tenant UI                                        │  │
│  │  - Organization Switcher                                  │  │
│  │  - Usage Dashboard                                        │  │
│  │  - Billing Portal                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓ ↑
┌─────────────────────────────────────────────────────────────────┐
│                      API/MIDDLEWARE LAYER                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Next.js API Routes + Middleware                         │  │
│  │  - Organization Context Injection                         │  │
│  │  - Rate Limiting                                          │  │
│  │  - Quota Validation                                       │  │
│  │  - API Key Authentication                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓ ↑
┌─────────────────────────────────────────────────────────────────┐
│                       BUSINESS LOGIC LAYER                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Services & Contexts                                      │  │
│  │  - OrganizationService                                    │  │
│  │  - SubscriptionService                                    │  │
│  │  - QuotaService                                           │  │
│  │  - BillingService                                         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓ ↑
┌─────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Supabase (PostgreSQL + Auth + Storage)                  │  │
│  │  - Multi-tenant Tables (organization_id)                  │  │
│  │  - RLS Policies (org-based)                              │  │
│  │  - Indexes (org_id + other fields)                       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓ ↑
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES LAYER                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Stripe     │  │   SendGrid   │  │   Sentry     │         │
│  │  (Payments)  │  │   (Email)    │  │ (Monitoring) │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Esquema de Base de Datos Multi-Tenant

### Nuevas Tablas

#### 1. organizations
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  
  -- Configuración
  country VARCHAR(2) DEFAULT 'PY',
  currency VARCHAR(3) DEFAULT 'PYG',
  locale VARCHAR(10) DEFAULT 'es-PY',
  timezone VARCHAR(50) DEFAULT 'America/Asuncion',
  tax_rate DECIMAL(5,4) DEFAULT 0.10,
  
  -- Metadata
  logo_url TEXT,
  website TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  
  -- Estado
  status VARCHAR(20) DEFAULT 'active', -- active, suspended, deleted
  trial_ends_at TIMESTAMP,
  
  -- Auditoría
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Índices
  CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9-]+$')
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_status ON organizations(status);
```

#### 2. organization_members
```sql
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Rol dentro de la organización
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  -- owner, admin, manager, employee, viewer
  
  -- Estado
  status VARCHAR(20) DEFAULT 'active', -- active, invited, suspended
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMP,
  joined_at TIMESTAMP,
  
  -- Auditoría
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_role ON organization_members(organization_id, role);
```

#### 3. pricing_plans
```sql
CREATE TABLE pricing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  
  -- Precios
  price_monthly DECIMAL(10,2) NOT NULL,
  price_yearly DECIMAL(10,2) NOT NULL,
  
  -- Límites
  limits JSONB NOT NULL DEFAULT '{
    "users": 1,
    "products": 100,
    "sales_per_month": 50,
    "storage_mb": 100,
    "api_requests_per_hour": 1000
  }'::jsonb,
  
  -- Características
  features JSONB NOT NULL DEFAULT '{
    "repairs_module": false,
    "advanced_reports": false,
    "api_access": false,
    "priority_support": false
  }'::jsonb,
  
  -- Metadata
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  
  -- Auditoría
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_pricing_plans_slug ON pricing_plans(slug);
CREATE INDEX idx_pricing_plans_active ON pricing_plans(is_active);
```

#### 4. subscriptions
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES pricing_plans(id),
  
  -- Stripe
  stripe_subscription_id VARCHAR(255) UNIQUE,
  stripe_customer_id VARCHAR(255),
  
  -- Estado
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  -- active, trialing, past_due, canceled, unpaid
  
  -- Fechas
  current_period_start TIMESTAMP NOT NULL,
  current_period_end TIMESTAMP NOT NULL,
  trial_start TIMESTAMP,
  trial_end TIMESTAMP,
  canceled_at TIMESTAMP,
  ended_at TIMESTAMP,
  
  -- Auditoría
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(organization_id, status) WHERE status = 'active'
);

CREATE INDEX idx_subscriptions_org ON subscriptions(organization_id);
CREATE INDEX idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
```

#### 5. usage_tracking
```sql
CREATE TABLE usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Período
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Contadores
  users_count INTEGER DEFAULT 0,
  products_count INTEGER DEFAULT 0,
  sales_count INTEGER DEFAULT 0,
  repairs_count INTEGER DEFAULT 0,
  storage_mb INTEGER DEFAULT 0,
  api_requests INTEGER DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  UNIQUE(organization_id, period_start)
);

CREATE INDEX idx_usage_org_period ON usage_tracking(organization_id, period_start DESC);
```

#### 6. invoices
```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id),
  
  -- Stripe
  stripe_invoice_id VARCHAR(255) UNIQUE,
  
  -- Montos
  subtotal DECIMAL(10,2) NOT NULL,
  tax DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  amount_paid DECIMAL(10,2) DEFAULT 0,
  amount_due DECIMAL(10,2) NOT NULL,
  
  -- Estado
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  -- draft, open, paid, void, uncollectible
  
  -- Fechas
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  paid_at TIMESTAMP,
  
  -- PDF
  pdf_url TEXT,
  
  -- Auditoría
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_invoices_org ON invoices(organization_id);
CREATE INDEX idx_invoices_stripe ON invoices(stripe_invoice_id);
CREATE INDEX idx_invoices_status ON invoices(status);
```

#### 7. api_keys
```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Key
  key_hash VARCHAR(255) UNIQUE NOT NULL,
  key_prefix VARCHAR(20) NOT NULL, -- Para mostrar en UI
  
  -- Metadata
  name VARCHAR(100) NOT NULL,
  description TEXT,
  
  -- Permisos
  scopes JSONB DEFAULT '["read"]'::jsonb,
  
  -- Rate limiting
  rate_limit_per_hour INTEGER DEFAULT 1000,
  
  -- Estado
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP,
  expires_at TIMESTAMP,
  
  -- Auditoría
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_api_keys_org ON api_keys(organization_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
```

### Modificación de Tablas Existentes

Agregar `organization_id` a todas las tablas de datos:

```sql
-- Ejemplo para tabla products
ALTER TABLE products 
ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX idx_products_org ON products(organization_id);

-- Repetir para todas las tablas:
-- customers, sales, sale_items, repairs, repair_photos,
-- cash_registers, cash_movements, cash_closures,
-- kanban_orders, customer_credits, promotions, etc.
```

---

## RLS Policies Multi-Tenant

### Template de Policy

```sql
-- SELECT Policy
CREATE POLICY "Users can view org data"
ON {table_name} FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id 
    FROM organization_members 
    WHERE user_id = auth.uid()
    AND status = 'active'
  )
);

-- INSERT Policy
CREATE POLICY "Users can insert org data"
ON {table_name} FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id 
    FROM organization_members 
    WHERE user_id = auth.uid()
    AND status = 'active'
    AND role IN ('owner', 'admin', 'manager')
  )
);

-- UPDATE Policy
CREATE POLICY "Users can update org data"
ON {table_name} FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id 
    FROM organization_members 
    WHERE user_id = auth.uid()
    AND status = 'active'
    AND role IN ('owner', 'admin', 'manager')
  )
);

-- DELETE Policy
CREATE POLICY "Users can delete org data"
ON {table_name} FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id 
    FROM organization_members 
    WHERE user_id = auth.uid()
    AND status = 'active'
    AND role IN ('owner', 'admin')
  )
);
```

---

## Middleware de Organización

```typescript
// src/middleware/organization.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function organizationMiddleware(request: NextRequest) {
  const supabase = createClient()
  
  // 1. Obtener usuario actual
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect('/login')
  }
  
  // 2. Obtener organización actual del header o cookie
  const orgId = request.headers.get('x-organization-id') || 
                request.cookies.get('current-org-id')?.value
  
  if (!orgId) {
    return NextResponse.redirect('/select-organization')
  }
  
  // 3. Validar que el usuario pertenece a la organización
  const { data: membership } = await supabase
    .from('organization_members')
    .select('role, status')
    .eq('organization_id', orgId)
    .eq('user_id', user.id)
    .single()
  
  if (!membership || membership.status !== 'active') {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 403 }
    )
  }
  
  // 4. Inyectar contexto de organización
  const response = NextResponse.next()
  response.headers.set('x-organization-id', orgId)
  response.headers.set('x-organization-role', membership.role)
  
  return response
}
```

---

## Servicio de Cuotas

```typescript
// src/services/quota-service.ts
import { createClient } from '@/lib/supabase/client'

export class QuotaService {
  private supabase = createClient()
  
  async checkQuota(
    organizationId: string,
    quotaType: 'users' | 'products' | 'sales' | 'storage' | 'api_requests'
  ): Promise<{ allowed: boolean; current: number; limit: number }> {
    // 1. Obtener plan actual
    const { data: subscription } = await this.supabase
      .from('subscriptions')
      .select('plan:pricing_plans(limits)')
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .single()
    
    if (!subscription) {
      throw new Error('No active subscription')
    }
    
    const limit = subscription.plan.limits[quotaType]
    
    // 2. Obtener uso actual
    const current = await this.getCurrentUsage(organizationId, quotaType)
    
    // 3. Validar
    return {
      allowed: current < limit,
      current,
      limit
    }
  }
  
  private async getCurrentUsage(
    organizationId: string,
    quotaType: string
  ): Promise<number> {
    switch (quotaType) {
      case 'users':
        const { count: usersCount } = await this.supabase
          .from('organization_members')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .eq('status', 'active')
        return usersCount || 0
      
      case 'products':
        const { count: productsCount } = await this.supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
        return productsCount || 0
      
      // ... otros casos
      
      default:
        return 0
    }
  }
}
```

---

## Rate Limiting

```typescript
// src/middleware/rate-limit.ts
import { NextRequest } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!
})

export async function rateLimitMiddleware(
  request: NextRequest,
  organizationId: string
) {
  const key = `rate-limit:${organizationId}:${Date.now() / 3600000 | 0}`
  
  // Incrementar contador
  const count = await redis.incr(key)
  
  // Establecer expiración de 1 hora
  if (count === 1) {
    await redis.expire(key, 3600)
  }
  
  // Obtener límite del plan
  const limit = await getOrganizationRateLimit(organizationId)
  
  // Validar
  if (count > limit) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded' }),
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': (Date.now() + 3600000).toString(),
          'Retry-After': '3600'
        }
      }
    )
  }
  
  return null // Permitir request
}
```

---

## Integración con Stripe

```typescript
// src/services/billing-service.ts
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
})

export class BillingService {
  async createSubscription(
    organizationId: string,
    planId: string,
    paymentMethodId: string
  ) {
    // 1. Crear customer en Stripe
    const customer = await stripe.customers.create({
      payment_method: paymentMethodId,
      invoice_settings: {
        default_payment_method: paymentMethodId
      },
      metadata: {
        organization_id: organizationId
      }
    })
    
    // 2. Obtener price_id del plan
    const { data: plan } = await supabase
      .from('pricing_plans')
      .select('stripe_price_id')
      .eq('id', planId)
      .single()
    
    // 3. Crear suscripción
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: plan.stripe_price_id }],
      trial_period_days: 14,
      metadata: {
        organization_id: organizationId
      }
    })
    
    // 4. Guardar en BD
    await supabase.from('subscriptions').insert({
      organization_id: organizationId,
      plan_id: planId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customer.id,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000),
      current_period_end: new Date(subscription.current_period_end * 1000),
      trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
      trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null
    })
    
    return subscription
  }
  
  async handleWebhook(event: Stripe.Event) {
    switch (event.type) {
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object)
        break
      
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object)
        break
      
      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object)
        break
      
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object)
        break
    }
  }
}
```

---

## Próximos Pasos

1. ✅ Revisar y aprobar arquitectura
2. ✅ Crear migraciones SQL
3. ✅ Implementar servicios core
4. ✅ Configurar Stripe
5. ✅ Implementar middleware
6. ✅ Actualizar RLS policies
7. ✅ Testing exhaustivo
8. ✅ Deploy a staging

**Documento creado**: 2025-01-13
**Versión**: 1.0
**Estado**: ✅ Listo para implementación