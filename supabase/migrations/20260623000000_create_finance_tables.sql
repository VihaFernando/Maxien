-- Finance module tables

-- Income types (user-configurable, e.g. "Salary", "Freelance", "Rental")
create table if not exists public.finance_income_types (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    created_at timestamptz not null default now()
);

-- Expense categories (user-configurable, e.g. "Food", "Rent", "Transport")
create table if not exists public.finance_expense_categories (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    budget_lkr numeric(14,2),
    created_at timestamptz not null default now()
);

-- Financial periods (one active at a time per user)
create table if not exists public.finance_periods (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    label text not null,
    start_date date not null,
    end_date date not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now()
);

-- Income entries
create table if not exists public.finance_income_entries (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    period_id uuid references public.finance_periods(id) on delete set null,
    income_type_id uuid references public.finance_income_types(id) on delete set null,
    income_type_name text not null,
    amount_lkr numeric(14,2) not null,
    note text,
    entry_date date not null default current_date,
    created_at timestamptz not null default now()
);

-- Expense entries
create table if not exists public.finance_expense_entries (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    period_id uuid references public.finance_periods(id) on delete set null,
    category_id uuid references public.finance_expense_categories(id) on delete set null,
    category_name text not null,
    amount_original numeric(14,2) not null,
    currency_original text not null default 'LKR',
    amount_lkr numeric(14,2) not null,
    note text,
    entry_date date not null default current_date,
    is_from_subscription boolean not null default false,
    subscription_id uuid,
    created_at timestamptz not null default now()
);

-- RLS
alter table public.finance_income_types enable row level security;
alter table public.finance_expense_categories enable row level security;
alter table public.finance_periods enable row level security;
alter table public.finance_income_entries enable row level security;
alter table public.finance_expense_entries enable row level security;

create policy "owner_income_types" on public.finance_income_types for all using (user_id = auth.uid());
create policy "owner_expense_categories" on public.finance_expense_categories for all using (user_id = auth.uid());
create policy "owner_finance_periods" on public.finance_periods for all using (user_id = auth.uid());
create policy "owner_income_entries" on public.finance_income_entries for all using (user_id = auth.uid());
create policy "owner_expense_entries" on public.finance_expense_entries for all using (user_id = auth.uid());
