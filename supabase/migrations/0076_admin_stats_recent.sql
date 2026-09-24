-- Mi Álbum de Figuritas — stats del admin: sección "recent" (ventanas móviles).
--
-- Recrea fn_admin_stats (0057) sumando un objeto `recent` con métricas de
-- actividad de las últimas 24h / 7d (sobres abiertos, nuevos usuarios/jugadores,
-- álbumes creados, cambios aceptados). Usa los timestamps existentes:
-- packs.opened_at/granted_at, profiles.created_at, albums.created_at,
-- user_album_membership.joined_at, trade_offers.resolved_at.

create or replace function fn_admin_stats()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_is_admin boolean;
  v_tz text := 'America/Argentina/Buenos_Aires';
  v_totals jsonb;
  v_recent jsonb;
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

  -- Actividad reciente (ventanas móviles desde ahora, no calendario).
  select jsonb_build_object(
    'packs_opened_24h',    (select count(*) from packs where opened_at >= now() - interval '24 hours'),
    'packs_opened_7d',     (select count(*) from packs where opened_at >= now() - interval '7 days'),
    'packs_granted_24h',   (select count(*) from packs where granted_at >= now() - interval '24 hours'),
    'new_users_24h',       (select count(*) from profiles where created_at >= now() - interval '24 hours'),
    'new_members_24h',     (select count(*) from user_album_membership where joined_at >= now() - interval '24 hours'),
    'albums_created_24h',  (select count(*) from albums where created_at >= now() - interval '24 hours'),
    'trades_accepted_24h', (select count(*) from trade_offers
                              where status = 'accepted' and resolved_at >= now() - interval '24 hours')
  ) into v_recent;

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

  return jsonb_build_object(
    'totals', v_totals,
    'recent', v_recent,
    'daily', coalesce(v_daily, '[]'::jsonb)
  );
end;
$$;

grant execute on function fn_admin_stats() to authenticated;
