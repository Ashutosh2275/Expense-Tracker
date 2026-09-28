-- Supabase Migration: 20260917000000_init_schema.sql
-- Personal Expense & Pending Payment Tracker
-- Free Tier Optimized with Row Level Security

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. PEOPLE TABLE (Friends / Contacts tracked by user)
CREATE TABLE IF NOT EXISTS public.people (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. EXPENSES TABLE
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount > 0),
    currency TEXT DEFAULT 'INR' NOT NULL,
    paid_by UUID NULL, -- NULL indicates owner ('You'), or references a person_id in public.people
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. EXPENSE PARTICIPANTS TABLE
CREATE TABLE IF NOT EXISTS public.expense_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
    person_id UUID NULL, -- NULL represents owner ('You'), or references a person_id in public.people
    share_amount NUMERIC(12,2) NOT NULL CHECK (share_amount >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    expense_id UUID NULL REFERENCES public.expenses(id) ON DELETE SET NULL,
    from_person_id UUID NULL, -- NULL indicates owner ('You'), or a person_id in public.people
    to_person_id UUID NULL,   -- NULL indicates owner ('You'), or a person_id in public.people
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL DEFAULT 'UPI' CHECK (payment_method IN ('UPI', 'Cash', 'Bank Transfer', 'Other')),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. INDEXES FOR HIGH EFFICIENCY
CREATE INDEX IF NOT EXISTS idx_people_owner_id ON public.people(owner_id);
CREATE INDEX IF NOT EXISTS idx_expenses_owner_id ON public.expenses(owner_id);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON public.expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_participants_expense_id ON public.expense_participants(expense_id);
CREATE INDEX IF NOT EXISTS idx_participants_person_id ON public.expense_participants(person_id);
CREATE INDEX IF NOT EXISTS idx_payments_owner_id ON public.payments(owner_id);
CREATE INDEX IF NOT EXISTS idx_payments_from_person ON public.payments(from_person_id);
CREATE INDEX IF NOT EXISTS idx_payments_to_person ON public.payments(to_person_id);

-- 7. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- People Policies
CREATE POLICY "Users can view their own people"
    ON public.people FOR SELECT
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can create their own people"
    ON public.people FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own people"
    ON public.people FOR UPDATE
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own people"
    ON public.people FOR DELETE
    USING (auth.uid() = owner_id);

-- Expenses Policies
CREATE POLICY "Users can view their own expenses"
    ON public.expenses FOR SELECT
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can create their own expenses"
    ON public.expenses FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own expenses"
    ON public.expenses FOR UPDATE
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own expenses"
    ON public.expenses FOR DELETE
    USING (auth.uid() = owner_id);

-- Expense Participants Policies (Scoped via expense ownership)
CREATE POLICY "Users can view participants of their expenses"
    ON public.expense_participants FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.expenses
            WHERE expenses.id = expense_participants.expense_id
            AND expenses.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert participants for their expenses"
    ON public.expense_participants FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.expenses
            WHERE expenses.id = expense_participants.expense_id
            AND expenses.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can update participants for their expenses"
    ON public.expense_participants FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.expenses
            WHERE expenses.id = expense_participants.expense_id
            AND expenses.owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete participants for their expenses"
    ON public.expense_participants FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.expenses
            WHERE expenses.id = expense_participants.expense_id
            AND expenses.owner_id = auth.uid()
        )
    );

-- Payments Policies
CREATE POLICY "Users can view their own payments"
    ON public.payments FOR SELECT
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can create their own payments"
    ON public.payments FOR INSERT
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own payments"
    ON public.payments FOR UPDATE
    USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own payments"
    ON public.payments FOR DELETE
    USING (auth.uid() = owner_id);

-- 8. AUTOMATIC PROFILE CREATION TRIGGER ON AUTH SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, name, email, avatar_url)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
        new.email,
        new.raw_user_meta_data->>'avatar_url'
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
