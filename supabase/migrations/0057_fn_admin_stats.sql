-- Mi Álbum de Figuritas — estadísticas del panel admin
--
-- fn_admin_stats(): un solo round trip con todos los números del dashboard
-- (patrón RPC batch). SECURITY DEFINER + check explícito de is_admin, como
-- el resto de las RPCs de admin.
--
-- "Actividad diaria" sale de auth.audit_log_entries (accesible porque la
-- función corre como postgres):
--   - logins/día:  payload->>'action' = 'login' (magic link + OAuth)
--   - activos/día: actores distintos con 'login' O 'token_refreshed' — el
--     refresh corre ~cada hora con la app abierta, así que es un buen proxy
--     de DAU con sesiones persistentes (el login explícito es raro).
-- Los días se bucketean en hora argentina para que "hoy" coincida con el
-- calendario de Nico, no con UTC.

create or replace function fn_admin_stats()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_is_admin boolean;
  v_tz text := 'America/Argentina/Buenos_Aires';
  v_totals jsonb;
  v_daily jsonb;
begin
  select is_admin into v_is_admin from profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'admin_required' using errcode = 'P0070';
  end if;

  select jsonb_build_object(
    'total_users',        (select count(*) from profiles),
    'new_users_7d',       (select count(*) from profiles where created_at >= now() - interval '7 days'),
    'total_albums',       (select count(*) from albums),
    'published_albums',   (select count(*) from albums where status = 'published'),
    'total_stickers',     (select count(*) from stickers),
    'stickers_owned',     (select coalesce(sum(quantity), 0) from user_collection),
    'stickers_pasted',    (select count(*) from user_collection where pasted),
    'total_memberships',  (select count(*) from user_album_membership),
    -- Jugadores promedio por álbum publicado. NULL si no hay publicados.
    'avg_players_per_album', (
      select round(count(*)::numeric / nullif(
        (select count(*) from albums where status = 'published'), 0), 1)
      from user_album_membership
    ),
    'packs_opened',       (select count(*) from packs where opened_at is not null),
    'packs_pending',      (select count(*) from packs where opened_at is null),
    'trades_accepted',    (select count(*) from trade_offers where status = 'accepted'),
    'trades_pending',     (select count(*) from trade_offers where status = 'pending')
  ) into v_totals;

  with days as (
    select d::date as day
    from generate_series(
      (now() at time zone v_tz)::date - 13,
      (now() at time zone v_tz)::date,
      interval '1 day'
    ) d
  ),
  signups as (
    select (created_at at time zone v_tz)::date as day, count(*) as n
    from profiles
    where created_at >= now() - interval '15 days'
    group by 1
  ),
  logins as (
    select (created_at at time zone v_tz)::date as day, count(*) as n
    from auth.audit_log_entries
    where created_at >= now() - interval '15 days'
      and payload->>'action' = 'login'
    group by 1
  ),
  actives as (
    select (created_at at time zone v_tz)::date as day,
           count(distinct payload->>'actor_id') as n
    from auth.audit_log_entries
    where created_at >= now() - interval '15 days'
      and payload->>'action' in ('login', 'token_refreshed')
    group by 1
  )
  select jsonb_agg(jsonb_build_object(
    'day',     to_char(days.day, 'YYYY-MM-DD'),
    'signups', coalesce(s.n, 0),
    'logins',  coalesce(l.n, 0),
    'active',  coalesce(a.n, 0)
  ) order by days.day)
  into v_daily
  from days
  left join signups s on s.day = days.day
  left join logins  l on l.day = days.day
  left join actives a on a.day = days.day;

  return jsonb_build_object('totals', v_totals, 'daily', coalesce(v_daily, '[]'::jsonb));
end;
$$;

grant execute on function fn_admin_stats() to authenticated;
