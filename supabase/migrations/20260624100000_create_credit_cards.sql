-- Credit cards and related tables

-- Credit cards (one per card the user owns)
create table if not exists public.finance_credit_cards (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    bank_name text not null,
    card_network text not null default 'Visa', -- Visa, Mastercard, Amex, UnionPay, JCB, Discover
    nickname text,
    credit_limit_lkr numeric(14,2) not null default 0,
    current_balance_lkr numeric(14,2) not null default 0, -- outstanding debt (increases on spend, decreases on repayment)
    color text not null default '#3B82F6', -- card accent colour
    created_at timestamptz not null default now()
);

-- Credit card expense entries (charges against a card — do NOT reduce cash)
create table if not exists public.finance_cc_expenses (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    card_id uuid not null references public.finance_credit_cards(id) on delete cascade,
    period_id uuid references public.finance_periods(id) on delete set null,
    category_name text not null,
    amount_original numeric(14,2) not null,
    currency_original text not null default 'LKR',
    amount_lkr numeric(14,2) not null,
    note text,
    entry_date date not null default current_date,
    created_at timestamptz not null default now()
);

-- Credit card repayments (reduces card balance AND reduces cash)
create table if not exists public.finance_cc_repayments (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    card_id uuid not null references public.finance_credit_cards(id) on delete cascade,
    period_id uuid references public.finance_periods(id) on delete set null,
    amount_lkr numeric(14,2) not null,
    note text,
    entry_date date not null default current_date,
    created_at timestamptz not null default now()
);

-- RLS
alter table public.finance_credit_cards enable row level security;
alter table public.finance_cc_expenses enable row level security;
alter table public.finance_cc_repayments enable row level security;

create policy "owner_credit_cards" on public.finance_credit_cards for all using (user_id = auth.uid());
create policy "owner_cc_expenses" on public.finance_cc_expenses for all using (user_id = auth.uid());
create policy "owner_cc_repayments" on public.finance_cc_repayments for all using (user_id = auth.uid());
