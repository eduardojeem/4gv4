
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })
dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function seedCredits() {
  console.log('Seeding credits data...')

  // 1. Get a customer
  const { data: customers, error: customerError } = await supabase
    .from('customers')
    .select('id, first_name, last_name')
    .limit(1)

  if (customerError) {
    console.error('Error fetching customers:', customerError)
    return
  }

  let customerId: string

  if (!customers || customers.length === 0) {
    console.log('No customers found. Creating a test customer...')
    const { data: newCustomer, error: createError } = await supabase
      .from('customers')
      .insert({
        first_name: 'Juan',
        last_name: 'Pérez',
        email: 'juan.perez@example.com',
        phone: '555-0123',
        status: 'active'
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating customer:', createError)
      return
    }
    customerId = newCustomer.id
    console.log('Created customer:', customerId)
  } else {
    customerId = customers[0].id
    console.log('Using existing customer:', customerId)
  }

  // 2. Create a credit
  const creditData = {
    customer_id: customerId,
    principal: 1000000,
    interest_rate: 10,
    term_months: 12,
    start_date: new Date().toISOString(),
    status: 'active'
  }

  const { data: credit, error: creditError } = await supabase
    .from('customer_credits')
    .insert(creditData)
    .select()
    .single()

  if (creditError) {
    console.error('Error creating credit:', creditError)
    return
  }

  console.log('Created credit:', credit.id)

  // 3. Create installments
  const installments = []
  const startDate = new Date()
  const amountPerInstallment = Math.round(1000000 / 12)

  for (let i = 1; i <= 12; i++) {
    const dueDate = new Date(startDate)
    dueDate.setMonth(startDate.getMonth() + i)
    
    installments.push({
      credit_id: credit.id,
      installment_number: i,
      due_date: dueDate.toISOString(),
      amount: amountPerInstallment,
      status: 'pending'
    })
  }

  const { error: installmentsError } = await supabase
    .from('credit_installments')
    .insert(installments)

  if (installmentsError) {
    console.error('Error creating installments:', installmentsError)
    return
  }

  console.log('Created 12 installments for credit', credit.id)
  console.log('Seeding completed successfully!')
}

seedCredits()
