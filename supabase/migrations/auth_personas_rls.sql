begin;

-- Alinea el catálogo de roles con el modelo aprobado.
alter table public.roles rename column nombre_rol to nombre;
alter table public.roles add column descripcion text;

update public.roles
set descripcion = case nombre
    when 'Administrador' then 'Gestiona usuarios, roles y auditoría del sistema.'
    when 'Jefe' then 'Supervisa asistencias y permisos de su equipo.'
    when 'Empleado' then 'Registra asistencias y solicita permisos.'
end;

-- Conserva los UUID de negocio existentes y agrega el vínculo uno a uno con Auth.
alter table public.personas
    add column auth_user_id uuid unique references auth.users(id) on delete set null;

update public.personas p
set auth_user_id = u.id
from auth.users u
where p.id = u.id
  and p.auth_user_id is null;

alter table public.personas alter column cedula type varchar(10) using cedula::varchar(10);
alter table public.personas alter column rol_id set not null;
alter table public.personas alter column activo set not null;
alter table public.personas drop column password;

alter table public.personas
    add constraint personas_cedula_formato check (cedula ~ '^\d{10}$');

create unique index personas_email_lower_key on public.personas (lower(email));
create index personas_rol_id_idx on public.personas (rol_id);
create index personas_jefe_id_idx on public.personas (jefe_id);
create index asistencias_empleado_id_idx on public.asistencias (empleado_id);
create index asistencias_fecha_hora_idx on public.asistencias (fecha_hora desc);
create index permisos_empleado_id_idx on public.permisos (empleado_id);
create index permisos_jefe_id_idx on public.permisos (jefe_id);
create index permisos_fecha_idx on public.permisos (fecha desc);
create index auditoria_usuario_id_idx on public.auditoria (usuario_id);
create index auditoria_fecha_hora_idx on public.auditoria (fecha_hora desc);

create schema if not exists private;
revoke all on schema private from public, anon;

create or replace function private.current_persona_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
    select p.id
    from public.personas p
    where p.auth_user_id = (select auth.uid())
      and p.activo = true
    limit 1
$$;

create or replace function private.current_role_name()
returns text
language sql
stable
security definer
set search_path = ''
as $$
    select r.nombre
    from public.personas p
    join public.roles r on r.id = p.rol_id
    where p.auth_user_id = (select auth.uid())
      and p.activo = true
    limit 1
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select coalesce((select private.current_role_name()) = 'Administrador', false)
$$;

create or replace function private.current_jefe_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
    select p.jefe_id
    from public.personas p
    where p.id = (select private.current_persona_id())
$$;

create or replace function private.can_view_persona(target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select coalesce(
        (select private.is_admin())
        or target_id = (select private.current_persona_id())
        or exists (
            select 1
            from public.personas target
            where target.id = target_id
              and target.jefe_id = (select private.current_persona_id())
        ),
        false
    )
$$;

revoke all on all functions in schema private from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.current_persona_id() to authenticated;
grant execute on function private.current_role_name() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.current_jefe_id() to authenticated;
grant execute on function private.can_view_persona(uuid) to authenticated;

-- Un registro previo en personas es obligatorio para activar una cuenta.
create or replace function private.link_persona_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    update public.personas
    set auth_user_id = new.id
    where lower(email) = lower(new.email)
      and auth_user_id is null;

    if not found then
        raise exception 'No existe un perfil disponible para este correo';
    end if;

    return new;
end;
$$;

revoke all on function private.link_persona_from_auth() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function private.link_persona_from_auth();

-- Impide que un usuario cambie sus atributos administrativos.
create or replace function private.guard_persona_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    if auth.uid() is null then
        return new;
    end if;

    if (select private.is_admin()) then
        if new.id is distinct from old.id
            or new.auth_user_id is distinct from old.auth_user_id
            or new.created_at is distinct from old.created_at then
            raise exception 'No se puede modificar la identidad del perfil';
        end if;
        return new;
    end if;

    if old.auth_user_id is distinct from (select auth.uid()) then
        raise exception 'No se puede modificar otro perfil';
    end if;

    if row(new.id, new.nombre, new.apellido, new.cedula, new.email, new.cargo,
           new.remuneracion, new.rol_id, new.jefe_id, new.activo,
           new.auth_user_id, new.created_at)
       is distinct from
       row(old.id, old.nombre, old.apellido, old.cedula, old.email, old.cargo,
           old.remuneracion, old.rol_id, old.jefe_id, old.activo,
           old.auth_user_id, old.created_at) then
        raise exception 'Solo puedes actualizar tu teléfono y dirección';
    end if;

    return new;
end;
$$;

revoke all on function private.guard_persona_update() from public, anon, authenticated;
drop trigger if exists personas_guard_update on public.personas;
create trigger personas_guard_update
    before update on public.personas
    for each row execute function private.guard_persona_update();

create or replace function private.guard_permiso_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    if auth.uid() is null or (select private.is_admin()) then
        return new;
    end if;

    if old.jefe_id is distinct from (select private.current_persona_id()) then
        raise exception 'No puedes gestionar este permiso';
    end if;

    if row(new.id, new.empleado_id, new.fecha, new.hora_desde, new.hora_hasta,
           new.total_horas, new.jefe_id)
       is distinct from
       row(old.id, old.empleado_id, old.fecha, old.hora_desde, old.hora_hasta,
           old.total_horas, old.jefe_id) then
        raise exception 'Solo puedes actualizar el estado del permiso';
    end if;

    if new.estado not in ('Aprobado', 'Rechazado') then
        raise exception 'Estado de permiso no permitido';
    end if;

    return new;
end;
$$;

revoke all on function private.guard_permiso_update() from public, anon, authenticated;
drop trigger if exists permisos_guard_update on public.permisos;
create trigger permisos_guard_update
    before update on public.permisos
    for each row execute function private.guard_permiso_update();

-- La auditoría se genera en la base de datos, no desde el navegador.
drop function if exists public.funcion_auditoria();

create or replace function private.audit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    actor_id uuid;
    payload jsonb;
begin
    actor_id := (select private.current_persona_id());

    if tg_op = 'UPDATE' then
        payload := jsonb_build_object('anterior', to_jsonb(old), 'nuevo', to_jsonb(new));
    elsif tg_op = 'DELETE' then
        payload := to_jsonb(old);
    else
        payload := to_jsonb(new);
    end if;

    insert into public.auditoria (usuario_id, tabla_afectada, accion, detalles)
    values (actor_id, tg_table_name, tg_op, payload);

    return coalesce(new, old);
end;
$$;

revoke all on function private.audit_change() from public, anon, authenticated;

drop trigger if exists personas_audit on public.personas;
create trigger personas_audit
    after insert or update or delete on public.personas
    for each row execute function private.audit_change();

drop trigger if exists asistencias_audit on public.asistencias;
create trigger asistencias_audit
    after insert or update or delete on public.asistencias
    for each row execute function private.audit_change();

drop trigger if exists permisos_audit on public.permisos;
create trigger permisos_audit
    after insert or update or delete on public.permisos
    for each row execute function private.audit_change();

-- Sustituye las políticas abiertas por reglas vinculadas a la sesión Auth.
do $$
declare
    policy_record record;
begin
    for policy_record in
        select schemaname, tablename, policyname
        from pg_policies
        where schemaname = 'public'
          and tablename in ('roles', 'personas', 'asistencias', 'permisos', 'auditoria')
    loop
        execute format('drop policy %I on %I.%I',
            policy_record.policyname, policy_record.schemaname, policy_record.tablename);
    end loop;
end;
$$;

alter table public.roles enable row level security;
alter table public.personas enable row level security;
alter table public.asistencias enable row level security;
alter table public.permisos enable row level security;
alter table public.auditoria enable row level security;

revoke all on table public.roles, public.personas, public.asistencias,
    public.permisos, public.auditoria from anon, authenticated;

grant select on table public.roles to authenticated;
grant select, insert, update on table public.personas to authenticated;
grant select, insert on table public.asistencias to authenticated;
grant select, insert, update on table public.permisos to authenticated;
grant select on table public.auditoria to authenticated;
grant usage, select on sequence public.asistencias_id_seq to authenticated;
grant usage, select on sequence public.permisos_id_seq to authenticated;

create policy roles_select_authenticated
on public.roles for select
to authenticated
using ((select private.current_persona_id()) is not null);

create policy personas_select_authorized
on public.personas for select
to authenticated
using ((select private.can_view_persona(id)));

create policy personas_insert_admin
on public.personas for insert
to authenticated
with check ((select private.is_admin()));

create policy personas_update_own_or_admin
on public.personas for update
to authenticated
using (auth_user_id = (select auth.uid()) or (select private.is_admin()))
with check (auth_user_id = (select auth.uid()) or (select private.is_admin()));

create policy asistencias_select_authorized
on public.asistencias for select
to authenticated
using ((select private.can_view_persona(empleado_id)));

create policy asistencias_insert_own
on public.asistencias for insert
to authenticated
with check (empleado_id = (select private.current_persona_id()));

create policy permisos_select_authorized
on public.permisos for select
to authenticated
using (
    empleado_id = (select private.current_persona_id())
    or jefe_id = (select private.current_persona_id())
    or (select private.is_admin())
);

create policy permisos_insert_own
on public.permisos for insert
to authenticated
with check (
    empleado_id = (select private.current_persona_id())
    and jefe_id = (select private.current_jefe_id())
    and estado = 'Pendiente'
);

create policy permisos_update_manager
on public.permisos for update
to authenticated
using (jefe_id = (select private.current_persona_id()) or (select private.is_admin()))
with check (jefe_id = (select private.current_persona_id()) or (select private.is_admin()));

create policy auditoria_select_admin
on public.auditoria for select
to authenticated
using ((select private.is_admin()));

commit;
