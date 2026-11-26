-- Dedicated coffee-shop database. No Gardens tables or live sample data.
create table public.shop_profiles (
 id uuid primary key references auth.users(id), name text not null,
 role text not null check(role in ('admin','employee')), active boolean not null default true
);
create table public.shop_finance (id boolean primary key default true check(id), revision bigint not null default 0, state jsonb not null);
insert into public.shop_finance(state) values ('{"settings":{"name":"Spoiled Brats","targetMargin":65,"categories":["Rent","Utilities","Wages","Transport","Repairs","Payment fees","Other"]},"items":[],"products":[],"recipes":[],"purchases":[],"sales":[],"expenses":[],"adjustments":[],"cash":[],"reconciliations":[]}');
create table public.shop_finance_operations (id uuid primary key, revision bigint not null, actor uuid not null references public.shop_profiles, created_at timestamptz not null default now());
create table public.shop_audit (id bigint generated always as identity primary key, actor uuid references public.shop_profiles, action text not null, before_data jsonb, after_data jsonb, created_at timestamptz not null default now());
create table public.shop_employees (
 id uuid primary key default gen_random_uuid(), user_id uuid unique references public.shop_profiles,
 name text not null check(length(name) between 1 and 150), email text not null unique,
 code text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
 active boolean not null default true, start_date date not null,
 schedule_start time not null, schedule_end time not null, workdays integer[] not null,
 check(schedule_start <> schedule_end), check(workdays <@ array[0,1,2,3,4,5,6])
);
create table public.shop_employee_schedule_history (
 id bigint generated always as identity primary key, employee_id uuid not null references public.shop_employees,
 effective date not null, schedule_start time not null, schedule_end time not null, workdays integer[] not null,
 unique(employee_id,effective), check(schedule_start <> schedule_end)
);
create table public.shop_attendance (
 id uuid primary key default gen_random_uuid(), employee_id uuid not null references public.shop_employees,
 clock_in timestamptz not null, clock_out timestamptz, break_minutes integer not null default 0 check(break_minutes>=0),
 reason text not null default '', voided boolean not null default false,
 check(clock_out is null or clock_out>=clock_in),
 check(clock_out is null or break_minutes <= extract(epoch from (clock_out-clock_in))/60)
);
create unique index shop_one_open_shift on public.shop_attendance(employee_id) where clock_out is null and not voided;
create unique index shop_one_shift_day on public.shop_attendance(employee_id,((clock_in at time zone 'Asia/Manila')::date)) where not voided;
create table public.shop_clock_config (id boolean primary key default true check(id), qr uuid not null default gen_random_uuid());
insert into public.shop_clock_config default values;
create table public.shop_attendance_pins (employee_id uuid primary key references public.shop_employees, salt text not null, hash text not null, version uuid not null default gen_random_uuid());
create table public.shop_clock_operations (id uuid primary key, employee_id uuid not null references public.shop_employees, action text not null, attendance_id uuid not null references public.shop_attendance, official_time timestamptz not null);
create table public.shop_pin_attempts (id uuid primary key default gen_random_uuid(), code_key text not null, ip_key text not null, successful boolean not null default false, created_at timestamptz not null default now());
create index shop_pin_code_time on public.shop_pin_attempts(code_key,created_at);
create index shop_pin_ip_time on public.shop_pin_attempts(ip_key,created_at);

create function public.shop_is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from shop_profiles where id=auth.uid() and active and role='admin') $$;
create function public.shop_is_active() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from shop_profiles where id=auth.uid() and active) $$;
alter table public.shop_profiles enable row level security;
create policy shop_profile_read on public.shop_profiles for select to authenticated using (id=auth.uid() or shop_is_admin());
alter table public.shop_finance enable row level security;
create policy shop_finance_read on public.shop_finance for select to authenticated using (shop_is_admin());
alter table public.shop_finance_operations enable row level security;
alter table public.shop_audit enable row level security;
create policy shop_audit_read on public.shop_audit for select to authenticated using (shop_is_admin());
alter table public.shop_employees enable row level security;
create policy shop_employee_read on public.shop_employees for select to authenticated using (shop_is_admin() or (user_id=auth.uid() and shop_is_active()));
alter table public.shop_employee_schedule_history enable row level security;
alter table public.shop_attendance enable row level security;
create policy shop_attendance_read on public.shop_attendance for select to authenticated using (shop_is_admin() or exists(select 1 from shop_employees e where e.id=employee_id and e.user_id=auth.uid() and shop_is_active()));
alter table public.shop_clock_config enable row level security;
alter table public.shop_attendance_pins enable row level security;
alter table public.shop_clock_operations enable row level security;
alter table public.shop_pin_attempts enable row level security;
grant select on public.shop_profiles, public.shop_finance, public.shop_audit, public.shop_employees, public.shop_attendance to authenticated;
grant all on all tables in schema public to service_role;
grant usage,select on all sequences in schema public to service_role;

create function public.shop_commit_finance(p_actor uuid,p_revision bigint,p_state jsonb,p_operation uuid,p_action text) returns bigint language plpgsql security definer set search_path=public as $$
declare v shop_finance; v_existing bigint;
begin
 if not exists(select 1 from shop_profiles where id=p_actor and active and role='admin') then raise exception 'Access denied' using errcode='42501'; end if;
 select * into v from shop_finance where id for update;
 select revision into v_existing from shop_finance_operations where id=p_operation;
 if found then return v_existing; end if;
 if v.revision<>p_revision then raise exception 'Revision conflict' using errcode='40001'; end if;
 if jsonb_typeof(p_state)<>'object' then raise exception 'Invalid state'; end if;
 update shop_finance set state=p_state,revision=v.revision+1 where id;
 insert into shop_finance_operations(id,revision,actor) values(p_operation,v.revision+1,p_actor);
 insert into shop_audit(actor,action,before_data,after_data) values(p_actor,'finance:'||p_action,v.state,p_state);
 return v.revision+1;
end $$;

create function public.shop_reserve_pin(p_code text,p_ip text) returns uuid language plpgsql security definer set search_path=public as $$
declare v uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended('ip:'||p_ip,0));
 perform pg_advisory_xact_lock(hashtextextended('code:'||p_code,0));
 if (select count(*) from shop_pin_attempts where code_key=p_code and not successful and created_at>now()-interval '15 minutes')>=5 or
    (select count(*) from shop_pin_attempts where ip_key=p_ip and not successful and created_at>now()-interval '15 minutes')>=20 then return null; end if;
 delete from shop_pin_attempts where created_at<now()-interval '1 day';
 insert into shop_pin_attempts(code_key,ip_key) values(p_code,p_ip) returning id into v; return v;
end $$;

create function public.shop_punch(p_employee uuid,p_action text,p_nonce uuid,p_qr uuid,p_version uuid default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare e shop_employees; a shop_attendance; op shop_clock_operations; stamp timestamptz:=clock_timestamp();
begin
 select * into e from shop_employees where id=p_employee for update;
 if not found or not e.active or e.start_date>(stamp at time zone 'Asia/Manila')::date then raise exception 'Clock access is unavailable'; end if;
 if e.user_id is not null and not exists(select 1 from shop_profiles where id=e.user_id and active) then raise exception 'Clock access is unavailable'; end if;
 if not exists(select 1 from shop_clock_config where qr=p_qr) then raise exception 'This QR has been replaced. Scan the current kiosk QR.'; end if;
 if p_version is not null and not exists(select 1 from shop_attendance_pins where employee_id=e.id and version=p_version) then raise exception 'PIN changed. Retry with your current PIN.'; end if;
 select * into op from shop_clock_operations where id=p_nonce;
 if found then
   if op.employee_id<>p_employee or op.action<>p_action then raise exception 'Invalid retry'; end if;
   return jsonb_build_object('name',e.name,'action',op.action,'time',op.official_time);
 end if;
 select * into a from shop_attendance where employee_id=e.id and clock_out is null and not voided for update;
 if p_action='clock_in' then
   if found then raise exception 'Already clocked in. Time out before starting another shift.'; end if;
   if exists(select 1 from shop_attendance where employee_id=e.id and not voided and (clock_in at time zone 'Asia/Manila')::date=(stamp at time zone 'Asia/Manila')::date) then raise exception 'Attendance already exists for today. Ask an admin to correct it.'; end if;
   insert into shop_attendance(employee_id,clock_in) values(e.id,stamp) returning * into a;
 elsif p_action='clock_out' then
   if not found then raise exception 'No open shift. Time in first.'; end if;
   update shop_attendance set clock_out=stamp where id=a.id returning * into a;
 else raise exception 'Choose Time In or Time Out'; end if;
 insert into shop_clock_operations(id,employee_id,action,attendance_id,official_time) values(p_nonce,e.id,p_action,a.id,stamp);
 insert into shop_audit(actor,action,after_data) values(e.user_id,'attendance:'||p_action,to_jsonb(a));
 return jsonb_build_object('name',e.name,'action',p_action,'time',stamp);
end $$;

create function public.shop_save_employee(p_actor uuid,p_employee jsonb,p_effective date) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid:=(p_employee->>'id')::uuid; old shop_employees; saved shop_employees;
begin
 if not exists(select 1 from shop_profiles where id=p_actor and active and role='admin') then raise exception 'Access denied'; end if;
 select * into old from shop_employees where id=v_id for update;
 if p_effective<(now() at time zone 'Asia/Manila')::date and old.id is not null then raise exception 'Schedule changes must start today or later'; end if;
 insert into shop_employees(id,name,email,active,start_date,schedule_start,schedule_end,workdays)
 values(v_id,p_employee->>'name',lower(p_employee->>'email'),(p_employee->>'active')::boolean,(p_employee->>'start_date')::date,(p_employee->>'schedule_start')::time,(p_employee->>'schedule_end')::time,array(select jsonb_array_elements_text(p_employee->'workdays')::integer))
 on conflict(id) do update set name=excluded.name,email=excluded.email,active=excluded.active,start_date=excluded.start_date,schedule_start=excluded.schedule_start,schedule_end=excluded.schedule_end,workdays=excluded.workdays returning * into saved;
 if old.id is null or old.schedule_start<>saved.schedule_start or old.schedule_end<>saved.schedule_end or old.workdays<>saved.workdays then
 insert into shop_employee_schedule_history(employee_id,effective,schedule_start,schedule_end,workdays) values(v_id,p_effective,saved.schedule_start,saved.schedule_end,saved.workdays)
 on conflict(employee_id,effective) do update set schedule_start=excluded.schedule_start,schedule_end=excluded.schedule_end,workdays=excluded.workdays;
 end if;
 insert into shop_audit(actor,action,before_data,after_data) values(p_actor,'employee:save',to_jsonb(old),to_jsonb(saved));
 return v_id;
end $$;

create function public.shop_correct_attendance(p_actor uuid,p_record jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare old shop_attendance; saved shop_attendance; v_id uuid:=(p_record->>'id')::uuid; v_employee uuid:=(p_record->>'employee_id')::uuid;
begin
 if not exists(select 1 from shop_profiles where id=p_actor and active and role='admin') then raise exception 'Access denied'; end if;
 if length(trim(coalesce(p_record->>'reason','')))=0 then raise exception 'A correction reason is required'; end if;
 perform 1 from shop_employees where id=v_employee for update;
 select * into old from shop_attendance where id=v_id;
 if old.id is not null and old.employee_id<>v_employee then raise exception 'Cannot change attendance employee'; end if;
 if (p_record->>'clock_in')::timestamptz>now() or (p_record->>'clock_out')::timestamptz>now() then raise exception 'Attendance cannot be in the future'; end if;
 if exists(select 1 from shop_attendance where employee_id=v_employee and id<>v_id and not voided and not (p_record->>'voided')::boolean and clock_in<coalesce((p_record->>'clock_out')::timestamptz,'infinity') and coalesce(clock_out,'infinity')>(p_record->>'clock_in')::timestamptz) then raise exception 'Attendance overlaps another shift'; end if;
 insert into shop_attendance(id,employee_id,clock_in,clock_out,break_minutes,reason,voided) values(v_id,v_employee,(p_record->>'clock_in')::timestamptz,(p_record->>'clock_out')::timestamptz,(p_record->>'break_minutes')::integer,p_record->>'reason',(p_record->>'voided')::boolean)
 on conflict(id) do update set clock_in=excluded.clock_in,clock_out=excluded.clock_out,break_minutes=excluded.break_minutes,reason=excluded.reason,voided=excluded.voided returning * into saved;
 insert into shop_audit(actor,action,before_data,after_data) values(p_actor,'attendance:correction',to_jsonb(old),to_jsonb(saved)); return v_id;
end $$;

revoke all on function public.shop_commit_finance(uuid,bigint,jsonb,uuid,text),public.shop_reserve_pin(text,text),public.shop_punch(uuid,text,uuid,uuid,uuid),public.shop_save_employee(uuid,jsonb,date),public.shop_correct_attendance(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.shop_commit_finance(uuid,bigint,jsonb,uuid,text),public.shop_reserve_pin(text,text),public.shop_punch(uuid,text,uuid,uuid,uuid),public.shop_save_employee(uuid,jsonb,date),public.shop_correct_attendance(uuid,jsonb) to service_role;
