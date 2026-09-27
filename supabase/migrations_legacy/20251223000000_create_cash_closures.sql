-- Create cash_closures table for Z closures
CREATE TABLE IF NOT EXISTS cash_closures (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    type TEXT NOT NULL, -- 'z'
    register_id TEXT NOT NULL, -- Can be 'principal' or UUID
    date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    opening_balance DECIMAL(12,2) DEFAULT 0,
    closing_balance DECIMAL(12,2) DEFAULT 0,
    income_total DECIMAL(12,2) DEFAULT 0,
    expense_total DECIMAL(12,2) DEFAULT 0,
    sales_total_cash DECIMAL(12,2) DEFAULT 0,
    sales_total_card DECIMAL(12,2) DEFAULT 0,
    sales_total_transfer DECIMAL(12,2) DEFAULT 0,
    sales_total_mixed DECIMAL(12,2) DEFAULT 0,
    movements_count INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_cash_closures_date ON cash_closures(date);
CREATE INDEX IF NOT EXISTS idx_cash_closures_register ON cash_closures(register_id);

-- Enable RLS
ALTER TABLE cash_closures ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view closures" ON cash_closures
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create closures" ON cash_closures
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Trigger for updated_at
CREATE TRIGGER update_cash_closures_updated_at BEFORE UPDATE ON cash_closures
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
