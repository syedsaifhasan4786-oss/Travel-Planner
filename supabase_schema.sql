-- Create Users Table (extends Supabase auth.users)
create table if not exists public.users (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  name text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Trips Table
create table if not exists public.trips (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  destination text not null,
  start_date date not null,
  end_date date not null,
  cover_photo text,
  invite_code text unique default substr(md5(random()::text), 1, 8) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Trip Members Junction Table
create table if not exists public.trip_members (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid references public.trips on delete cascade not null,
  user_id uuid references public.users on delete cascade not null,
  role text default 'collaborator' check (role in ('owner', 'collaborator')) not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(trip_id, user_id)
);

-- Create Itinerary Items Table
create table if not exists public.itinerary_items (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid references public.trips on delete cascade not null,
  title text not null,
  time text,
  notes text,
  category text default 'activity' check (category in ('activity', 'food', 'lodging', 'flight', 'other')) not null,
  date date not null,
  lat double precision,
  lng double precision,
  position_index integer not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS (Row Level Security)
alter table public.users enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.itinerary_items enable row level security;

-- Setup RLS Policies

-- Users: anyone can read user profiles, but only the user can modify theirs
create policy "Users are viewable by everyone" on public.users for select using (true);
create policy "Users can update own profile" on public.users for update using (auth.uid() = id);

-- Trips: only trip members can select/insert/update/delete trips
create policy "Members can view trips" on public.trips for select
  using (exists (select 1 from public.trip_members where trip_id = id and user_id = auth.uid()));

create policy "Members can update trips" on public.trips for update
  using (exists (select 1 from public.trip_members where trip_id = id and user_id = auth.uid()));

-- Trip Members: only members of a trip can view other members
create policy "Members can view trip members" on public.trip_members for select
  using (exists (select 1 from public.trip_members m where m.trip_id = trip_id and m.user_id = auth.uid()));

create policy "Members can invite/join trips" on public.trip_members for insert
  with check (true); -- Allow joining using code or invite

-- Itinerary Items: only members can view/modify items
create policy "Members can view itinerary items" on public.itinerary_items for select
  using (exists (select 1 from public.trip_members where trip_id = public.itinerary_items.trip_id and user_id = auth.uid()));

create policy "Members can insert itinerary items" on public.itinerary_items for insert
  with check (exists (select 1 from public.trip_members where trip_id = public.itinerary_items.trip_id and user_id = auth.uid()));

create policy "Members can update itinerary items" on public.itinerary_items for update
  using (exists (select 1 from public.trip_members where trip_id = public.itinerary_items.trip_id and user_id = auth.uid()));

create policy "Members can delete itinerary items" on public.itinerary_items for delete
  using (exists (select 1 from public.trip_members where trip_id = public.itinerary_items.trip_id and user_id = auth.uid()));

-- Trigger to automatically create a user profile in public.users on auth signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- Feature: Group Expense Splitting
-- ============================================================

-- Expenses Table: one record per group expense
create table if not exists public.expenses (
  id uuid default gen_random_uuid() primary key,
  trip_id uuid references public.trips on delete cascade not null,
  paid_by uuid references public.users on delete cascade not null,
  amount numeric(10, 2) not null check (amount > 0),
  description text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Expense Splits Table: one row per person who shares an expense
create table if not exists public.expense_splits (
  id uuid default gen_random_uuid() primary key,
  expense_id uuid references public.expenses on delete cascade not null,
  user_id uuid references public.users on delete cascade not null,
  share_amount numeric(10, 2) not null,
  unique(expense_id, user_id)
);

-- Enable RLS
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;

-- RLS Policies for expenses: only trip members can read/write
create policy "Members can view expenses" on public.expenses for select
  using (exists (
    select 1 from public.trip_members
    where trip_id = public.expenses.trip_id and user_id = auth.uid()
  ));

create policy "Members can insert expenses" on public.expenses for insert
  with check (exists (
    select 1 from public.trip_members
    where trip_id = public.expenses.trip_id and user_id = auth.uid()
  ));

create policy "Members can delete expenses" on public.expenses for delete
  using (exists (
    select 1 from public.trip_members
    where trip_id = public.expenses.trip_id and user_id = auth.uid()
  ));

-- RLS Policies for expense_splits: access through parent expense's trip membership
create policy "Members can view splits" on public.expense_splits for select
  using (exists (
    select 1 from public.expenses e
    join public.trip_members tm on tm.trip_id = e.trip_id
    where e.id = public.expense_splits.expense_id and tm.user_id = auth.uid()
  ));

create policy "Members can insert splits" on public.expense_splits for insert
  with check (exists (
    select 1 from public.expenses e
    join public.trip_members tm on tm.trip_id = e.trip_id
    where e.id = public.expense_splits.expense_id and tm.user_id = auth.uid()
  ));

create policy "Members can delete splits" on public.expense_splits for delete
  using (exists (
    select 1 from public.expenses e
    join public.trip_members tm on tm.trip_id = e.trip_id
    where e.id = public.expense_splits.expense_id and tm.user_id = auth.uid()
  ));
