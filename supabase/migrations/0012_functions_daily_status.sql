-- fn_my_daily_status: para una lista de álbumes, devuelve el estado del sobre
-- diario del caller (enabled, next_available_at, count, cooldown_hours).
-- Reemplaza el N+1 de N llamadas por álbum en el cliente.

create or replace function fn_my_daily_status(p_album_ids uuid[])
returns table (
  album_id uuid,
  enabled boolean,
  next_available_at timestamptz,
  count int,
  cooldown_hours int
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = 'P0010';
  end if;
  return query
  select
    a.id as album_id,
    coalesce((a.pack_config #>> '{daily,enabled}')::boolean, false) as enabled,
    case
      when uam.last_daily_claim_at is null then null
      else uam.last_daily_claim_at
           + make_interval(hours => coalesce((a.pack_config #>> '{daily,cooldown_hours}')::int, 24))
    end as next_available_at,
    coalesce((a.pack_config #>> '{daily,count}')::int, 1) as count,
    coalesce((a.pack_config #>> '{daily,cooldown_hours}')::int, 24) as cooldown_hours
  from albums a
  left join user_album_membership uam
    on uam.album_id = a.id and uam.user_id = v_uid
  where a.id = any(p_album_ids);
end;
$$;

grant execute on function fn_my_daily_status(uuid[]) to authenticated;
