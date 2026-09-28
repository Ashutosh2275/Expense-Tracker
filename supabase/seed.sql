-- Supabase Seed Data: seed.sql
-- For development/testing (DO NOT auto-apply to production users)

-- Mock demo user profile ID: 'd0000000-0000-0000-0000-000000000001'
-- If running in Supabase SQL editor with an existing user, replace with your user's auth.uid()

DO $$
DECLARE
    v_user_id UUID := 'd0000000-0000-0000-0000-000000000001';
    v_priya_id UUID := 'd0000000-0000-0000-0000-000000000002';
    v_swayam_id UUID := 'd0000000-0000-0000-0000-000000000003';
    v_anurag_id UUID := 'd0000000-0000-0000-0000-000000000004';
    v_exp_dinner UUID := 'e0000000-0000-0000-0000-000000000001';
    v_exp_cab UUID := 'e0000000-0000-0000-0000-000000000002';
BEGIN
    -- Check if user profile exists or create dummy
    INSERT INTO public.profiles (id, name, email)
    VALUES (v_user_id, 'Ashutosh', 'ashutosh@example.com')
    ON CONFLICT (id) DO NOTHING;

    -- Insert People
    INSERT INTO public.people (id, owner_id, name, email, phone, note)
    VALUES 
        (v_priya_id, v_user_id, 'Priya', 'priya@example.com', '+91 9876543210', 'College friend'),
        (v_swayam_id, v_user_id, 'Swayam', 'swayam@example.com', '+91 9876543211', 'Flatmate'),
        (v_anurag_id, v_user_id, 'Anurag', 'anurag@example.com', '+91 9876543212', 'Office colleague')
    ON CONFLICT (id) DO NOTHING;

    -- Expense 1: Dinner ₹600 (Ashutosh paid, split equal between Ashutosh, Priya, Swayam)
    INSERT INTO public.expenses (id, owner_id, description, total_amount, currency, paid_by, expense_date)
    VALUES (v_exp_dinner, v_user_id, 'Dinner at Cafe', 600.00, 'INR', NULL, CURRENT_DATE - INTERVAL '2 days')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.expense_participants (expense_id, person_id, share_amount)
    VALUES
        (v_exp_dinner, NULL, 200.00),         -- You
        (v_exp_dinner, v_priya_id, 200.00),   -- Priya
        (v_exp_dinner, v_swayam_id, 200.00)   -- Swayam
    ON CONFLICT DO NOTHING;

    -- Expense 2: Cab ₹350 (Anurag paid, split between Anurag and Ashutosh)
    INSERT INTO public.expenses (id, owner_id, description, total_amount, currency, paid_by, expense_date)
    VALUES (v_exp_cab, v_user_id, 'Airport Cab', 350.00, 'INR', v_anurag_id, CURRENT_DATE - INTERVAL '1 day')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.expense_participants (expense_id, person_id, share_amount)
    VALUES
        (v_exp_cab, NULL, 175.00),            -- You owe 175
        (v_exp_cab, v_anurag_id, 175.00)      -- Anurag's share
    ON CONFLICT DO NOTHING;

    -- Payment: Priya paid ₹100 via UPI
    INSERT INTO public.payments (owner_id, expense_id, from_person_id, to_person_id, amount, payment_method, payment_date, note)
    VALUES (v_user_id, v_exp_dinner, v_priya_id, NULL, 100.00, 'UPI', CURRENT_DATE - INTERVAL '1 day', 'First partial payment')
    ON CONFLICT DO NOTHING;
END $$;
