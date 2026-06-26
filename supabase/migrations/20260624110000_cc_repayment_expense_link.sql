-- Flag expense entries that were auto-created from a CC repayment
alter table public.finance_expense_entries
    add column if not exists is_cc_repayment boolean not null default false;

-- Link credit card repayments to their auto-created expense entries
alter table public.finance_cc_repayments
    add column if not exists linked_expense_id uuid references public.finance_expense_entries(id) on delete set null;
