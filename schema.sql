-- Supabase SQL Editor'da bu dosyanın tamamını çalıştırın.
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null,
 phone text unique,
 role text not null default 'employee' check (role in ('manager','employee')),
 daily_rate numeric(12,2) not null default 0 check (daily_rate >= 0),
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.workdays (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 work_date date not null,
 note text,
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 daily_rate numeric(12,2),
 approved_by uuid references public.profiles(id),
 created_at timestamptz not null default now(),
 unique(user_id,work_date)
);
create table if not exists public.advances (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 amount numeric(12,2) not null check (amount > 0),
 advance_date date not null default current_date,
 note text,
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now()
);
-- Her kısmi/tam maaş ödemesi ayrı kayıt olarak tutulur.
create table if not exists public.salary_payments (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 amount numeric(12,2) not null check (amount > 0),
 payment_date date not null default current_date,
 note text,
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now()
);
create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='manager' and active=true); $$;
alter table public.profiles enable row level security;
alter table public.workdays enable row level security;
alter table public.advances enable row level security;
alter table public.salary_payments enable row level security;
create policy "profiles read self or manager" on public.profiles for select using (id=auth.uid() or public.is_manager());
create policy "manager manages profiles" on public.profiles for all using (public.is_manager()) with check (public.is_manager());
create policy "workdays read self or manager" on public.workdays for select using (user_id=auth.uid() or public.is_manager());
create policy "employees submit own pending workday" on public.workdays for insert with check (user_id=auth.uid() and status='pending');
create policy "manager updates workdays" on public.workdays for update using (public.is_manager()) with check (public.is_manager());
create policy "advances read self or manager" on public.advances for select using (user_id=auth.uid() or public.is_manager());
create policy "manager inserts advances" on public.advances for insert with check (public.is_manager() and created_by=auth.uid());
create policy "manager updates advances" on public.advances for update using (public.is_manager()) with check (public.is_manager());
create policy "salary payments read self or manager" on public.salary_payments for select using (user_id=auth.uid() or public.is_manager());
create policy "manager records salary payments" on public.salary_payments for insert with check (public.is_manager() and created_by=auth.uid());
-- Onay sırasında o günün ücretini profile'dan sabitlemek için:
create or replace function public.set_workday_rate()
returns trigger language plpgsql security definer set search_path=public
as $$ begin
 if new.status='approved' and old.status is distinct from 'approved' then
   select daily_rate into new.daily_rate from public.profiles where id=new.user_id;
   new.approved_by := auth.uid();
 end if;
 return new;
end; $$;
drop trigger if exists workday_rate_on_approval on public.workdays;
create trigger workday_rate_on_approval before update on public.workdays for each row execute function public.set_workday_rate();
-- İlk yönetici profilini, Auth > Users bölümünde telefon+şifre ile oluşturulan
-- kullanıcının UUID'sini kullanarak aşağıdaki gibi ekleyin:
-- insert into public.profiles(id,full_name,phone,role,daily_rate)
-- values('AUTH_USER_UUID','Yönetici Ad Soyad','+905XXXXXXXXX','manager',0);
