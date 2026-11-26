-- Additive upgrade; all existing coffee shop records are retained.
begin;
alter table public.shop_profiles drop constraint shop_profiles_role_check;
alter table public.shop_profiles add constraint shop_profiles_role_check check(role in ('admin','cashier','viewer','employee'));
alter table public.shop_profiles add column is_owner boolean not null default false;
alter table public.shop_profiles add column email text;
update public.shop_profiles p set email=u.email from auth.users u where u.id=p.id;
create unique index shop_profile_email on public.shop_profiles(lower(email)) where email is not null;
-- Automatically protect the existing owner only when ownership is unambiguous.
update public.shop_profiles set is_owner=true where active and role='admin' and (select count(*) from public.shop_profiles where active and role='admin')=1;
create unique index shop_one_owner on public.shop_profiles(is_owner) where is_owner;
alter table public.shop_profiles add constraint shop_owner_admin check(not is_owner or (active and role='admin'));
create or replace function public.shop_read_finance() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from shop_profiles where id=auth.uid() and active and role in ('admin','viewer'));
$$;
create policy finance_viewer_read on public.shop_finance for select to authenticated using(public.shop_read_finance());
create function public.shop_manage_account(p_actor uuid,p_target uuid,p_name text,p_role text,p_active boolean,p_email text default null) returns void language plpgsql security definer set search_path=public as $$
declare oldrow shop_profiles;
begin
 lock table shop_profiles in share row exclusive mode;
 if not exists(select 1 from shop_profiles where id=p_actor and active and role='admin' and is_owner) then raise exception 'Only the owner can manage accounts'; end if;
 if p_target=p_actor then raise exception 'Owner account is protected'; end if;
 select * into oldrow from shop_profiles where id=p_target;
 if oldrow.is_owner then raise exception 'Owner account is protected'; end if;
 if p_role not in ('admin','cashier','viewer','employee') or p_active is null or length(trim(p_name)) not between 1 and 150 then raise exception 'Invalid account details'; end if;
 insert into shop_profiles(id,name,role,active,email) values(p_target,trim(p_name),p_role,p_active,p_email)
 on conflict(id) do update set name=excluded.name,role=excluded.role,active=excluded.active;
 if not p_active then delete from shop_attendance_pins where employee_id in(select id from shop_employees where user_id=p_target); end if;
 insert into shop_audit(actor,action,before_data,after_data) values(p_actor,'account:access',to_jsonb(oldrow),jsonb_build_object('id',p_target,'name',p_name,'role',p_role,'active',p_active));
end $$;
revoke all on function public.shop_manage_account(uuid,uuid,text,text,boolean,text) from public,anon,authenticated;
grant execute on function public.shop_manage_account(uuid,uuid,text,text,boolean,text) to service_role;

-- Employee records match invited accounts by email without changing their role.
create function public.shop_link_employee_account() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.user_id is null then select id into new.user_id from shop_profiles where lower(email)=lower(new.email); end if;
 return new;
end $$;
create trigger shop_employee_account before insert or update of email on public.shop_employees for each row execute function public.shop_link_employee_account();
create function public.shop_link_profile_employee() returns trigger language plpgsql security definer set search_path=public as $$
begin
 update shop_employees set user_id=new.id where lower(email)=lower(new.email) and user_id is null;
 return new;
end $$;
create trigger shop_profile_employee after insert on public.shop_profiles for each row execute function public.shop_link_profile_employee();
update public.shop_employees e set user_id=p.id from public.shop_profiles p where e.user_id is null and lower(e.email)=lower(p.email);
revoke all on function public.shop_link_employee_account(),public.shop_link_profile_employee() from public,anon,authenticated;

create table public.shop_pos_receipts(id uuid primary key,actor uuid not null references public.shop_profiles,date date not null,receipt jsonb not null,created_at timestamptz not null default now());
alter table public.shop_pos_receipts enable row level security;
grant all on public.shop_pos_receipts to service_role;
create function public.shop_commit_pos(p_actor uuid,p_revision bigint,p_state jsonb,p_receipt jsonb,p_operation uuid) returns bigint language plpgsql security definer set search_path=public as $$
declare v_revision bigint; v_actor uuid;
begin
 if not exists(select 1 from shop_profiles where id=p_actor and active and role in ('admin','cashier')) then raise exception 'POS access denied'; end if;
 select revision into v_revision from shop_finance where id=true for update;
 select actor into v_actor from shop_pos_receipts where id=p_operation;
 if found then
   if v_actor<>p_actor then raise exception 'Receipt belongs to another cashier'; end if;
   return v_revision;
 end if;
 if v_revision<>p_revision then raise exception 'Revision conflict' using errcode='40001'; end if;
 if p_receipt->>'id'<>p_operation::text or (p_receipt->>'date')::date<>(now() at time zone 'Asia/Manila')::date then raise exception 'Invalid receipt'; end if;
 update shop_finance set state=p_state,revision=revision+1 where id=true returning revision into v_revision;
 insert into shop_pos_receipts(id,actor,date,receipt) values(p_operation,p_actor,(p_receipt->>'date')::date,p_receipt);
 insert into shop_finance_operations(id,revision,actor) values(p_operation,v_revision,p_actor);
 insert into shop_audit(actor,action,after_data) values(p_actor,'pos:paid',jsonb_build_object('receipt',p_operation,'total',p_receipt->'total','revision',v_revision));
 return v_revision;
end $$;
revoke all on function public.shop_commit_pos(uuid,bigint,jsonb,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.shop_commit_pos(uuid,bigint,jsonb,jsonb,uuid) to service_role;

create table public.shop_pos_displays(token_hash text primary key,actor uuid not null references public.shop_profiles,expires_at timestamptz not null,updated_at timestamptz not null default now(),snapshot jsonb);
create index shop_pos_displays_actor on public.shop_pos_displays(actor);
alter table public.shop_pos_displays enable row level security;
grant all on public.shop_pos_displays to service_role;
commit;
