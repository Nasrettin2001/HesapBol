-- HesapBöl Supabase Database Schema
-- Run this entire script in your Supabase SQL Editor to create all necessary tables and insert dummy users.

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Users Table (Extension of Supabase Auth)
create table if not exists public.users (
  id uuid references auth.users on delete cascade not null primary key,
  email text unique not null,
  name text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Groups Table
create table if not exists public.groups (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  category text check (category in ('Sevgili', 'Ev', 'Gezi', 'Diğer')) default 'Diğer',
  avatar_url text, -- We will store icon emojis or image URLs here
  created_by uuid references public.users(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Group Members (Junction Table)
create table if not exists public.group_members (
  group_id uuid references public.groups(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (group_id, user_id)
);

-- 4. Expenses (Bills/Fatura) Table
create table if not exists public.expenses (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references public.groups(id) on delete cascade not null,
  paid_by uuid references public.users(id) not null,
  description text not null,
  amount decimal(12,2) not null check (amount > 0),
  date timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Expense Splits (Who owes how much)
create table if not exists public.expense_splits (
  id uuid default uuid_generate_v4() primary key,
  expense_id uuid references public.expenses(id) on delete cascade not null,
  user_id uuid references public.users(id) not null,
  amount_owed decimal(12,2) not null check (amount_owed >= 0),
  is_settled boolean default false
);

-- RLS (Row Level Security) Policies
alter table public.users enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;

-- USERS
drop policy if exists "Users can view their own profile" on public.users;
drop policy if exists "Users can update their own profile" on public.users;
drop policy if exists "Anyone can view users for invite" on public.users;
drop policy if exists "Anyone can view users" on public.users;
create policy "Users can view their own profile" on public.users for select using (auth.uid() = id);
create policy "Users can update their own profile" on public.users for update using (auth.uid() = id);

-- GROUPS
drop policy if exists "Users can view groups they are in" on public.groups;
drop policy if exists "Users can create groups" on public.groups;
drop policy if exists "Authenticated users can view groups" on public.groups;
drop policy if exists "Authenticated users can create groups" on public.groups;
drop policy if exists "Authenticated users can update groups" on public.groups;
drop policy if exists "Authenticated users can delete groups" on public.groups;
create policy "Users can view their groups" on public.groups for select to authenticated using (
  id in (select group_id from public.group_members where user_id = auth.uid()) OR created_by = auth.uid()
);
create policy "Authenticated users can create groups" on public.groups for insert to authenticated with check (true);
create policy "Users can update their created groups" on public.groups for update to authenticated using (created_by = auth.uid());
create policy "Users can delete their created groups" on public.groups for delete to authenticated using (created_by = auth.uid());

-- GROUP MEMBERS (Fixing Infinite Recursion)
drop policy if exists "Users can view members of their groups" on public.group_members;
drop policy if exists "Users can add themselves to a group" on public.group_members;
drop policy if exists "Users can add others to a group they are in" on public.group_members;
drop policy if exists "Authenticated users can view group members" on public.group_members;
drop policy if exists "Authenticated users can insert group members" on public.group_members;
drop policy if exists "Authenticated users can delete group members" on public.group_members;
create policy "Users can view members of their own groups" on public.group_members for select to authenticated using (
  group_id in (select group_id from public.group_members where user_id = auth.uid())
);
create policy "Authenticated users can insert group members" on public.group_members for insert to authenticated with check (true);
create policy "Authenticated users can delete group members" on public.group_members for delete to authenticated using (true);

-- EXPENSES
drop policy if exists "Users can view expenses in their groups" on public.expenses;
drop policy if exists "Users can add expenses to their groups" on public.expenses;
drop policy if exists "Authenticated users can view expenses" on public.expenses;
drop policy if exists "Authenticated users can insert expenses" on public.expenses;
drop policy if exists "Authenticated users can update expenses" on public.expenses;
drop policy if exists "Authenticated users can delete expenses" on public.expenses;
create policy "Users can view group expenses" on public.expenses for select to authenticated using (
  group_id in (select group_id from public.group_members where user_id = auth.uid())
);
create policy "Authenticated users can insert expenses" on public.expenses for insert to authenticated with check (true);
create policy "Users can update expenses they paid" on public.expenses for update to authenticated using (paid_by = auth.uid());
create policy "Users can delete expenses they paid" on public.expenses for delete to authenticated using (paid_by = auth.uid());

-- EXPENSE SPLITS
drop policy if exists "Users can view splits for their groups' expenses" on public.expense_splits;
drop policy if exists "Users can insert splits for their groups' expenses" on public.expense_splits;
drop policy if exists "Authenticated users can view splits" on public.expense_splits;
drop policy if exists "Authenticated users can insert splits" on public.expense_splits;
drop policy if exists "Authenticated users can update splits" on public.expense_splits;
drop policy if exists "Authenticated users can delete splits" on public.expense_splits;
create policy "Users can view related splits" on public.expense_splits for select to authenticated using (
  expense_id in (
    select id from public.expenses where group_id in (select group_id from public.group_members where user_id = auth.uid())
  )
);
create policy "Authenticated users can insert splits" on public.expense_splits for insert to authenticated with check (true);
create policy "Users can update splits connected to their expenses" on public.expense_splits for update to authenticated using (
  expense_id in (select id from public.expenses where paid_by = auth.uid())
);
create policy "Users can delete splits connected to their expenses" on public.expense_splits for delete to authenticated using (
  expense_id in (select id from public.expenses where paid_by = auth.uid())
);

-- ==========================================
-- STORAGE BUCKET CONFIGURATION (Fixing Photo Upload)
-- ==========================================
insert into storage.buckets (id, name, public) 
values ('avatars', 'avatars', true) 
on conflict (id) do nothing;

drop policy if exists "Avatar images are publicly accessible." on storage.objects;
drop policy if exists "Anyone can upload an avatar." on storage.objects;
drop policy if exists "Anyone can update an avatar." on storage.objects;

create policy "Avatar images are publicly accessible." on storage.objects for select using ( bucket_id = 'avatars' );
create policy "Anyone can upload an avatar." on storage.objects for insert to authenticated with check ( bucket_id = 'avatars' );
create policy "Anyone can update an avatar." on storage.objects for update to authenticated using ( bucket_id = 'avatars' );

-- Trigger to create a user profile after signing up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, name)
  values (new.id, new.email, new.raw_user_meta_data->>'name');
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists to prevent errors on re-run
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ==========================================
-- DUMMY DATA FOR TESTING
-- ==========================================
-- Insert 4 generic dummy users directly into auth.users (requires bypassing standard auth flow for testing)
-- NOTE: In a real production app you'd sign these up properly. This uses a trick to insert directly for development.

DO $$
DECLARE
  uid1 uuid := uuid_generate_v4();
  uid2 uuid := uuid_generate_v4();
  uid3 uuid := uuid_generate_v4();
  uid4 uuid := uuid_generate_v4();
BEGIN
  -- Insert Fake Users to AUTH table ONLY if they do not exist
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'ahmet@fake.com') THEN
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    VALUES (uid1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ahmet@fake.com', crypt('123456', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"Ahmet Yılmaz"}', now(), now(), '', '', '', '');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'ayse@fake.com') THEN
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    VALUES (uid2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ayse@fake.com', crypt('123456', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"Ayşe Kaya"}', now(), now(), '', '', '', '');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'mehmet@fake.com') THEN
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    VALUES (uid3, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mehmet@fake.com', crypt('123456', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"Mehmet Demir"}', now(), now(), '', '', '', '');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'zeynep@fake.com') THEN
    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    VALUES (uid4, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zeynep@fake.com', crypt('123456', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{"name":"Zeynep Çelik"}', now(), now(), '', '', '', '');
  END IF;
  
  -- Sincronize ALL existing users from auth.users to public.users
  -- This fixes the issue where a user signed up BEFORE the trigger was active,
  -- so their ID exists in auth.users but NOT in public.users, causing a foreign key error on group creation.
  INSERT INTO public.users (id, email, name)
  SELECT id, email, raw_user_meta_data->>'name'
  FROM auth.users
  WHERE NOT EXISTS (
    SELECT 1 FROM public.users WHERE public.users.id = auth.users.id
  );

END $$;
