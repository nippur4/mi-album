-- Mi Álbum de Figuritas — dejar de recibir sobres diarios (opt-out + completado)
--
-- Dos maneras de que un álbum deje de ofrecerte sobres diarios:
--   1. Elección del jugador: user_album_membership.daily_muted = true
--      (toggle "Dejar de recibir sobres" en la vista del álbum).
--   2. Automática: álbum COMPLETADO (todas las figuritas pegadas) — no tiene
--      sentido seguir recibiendo/notificando el diario.
--
-- Ambas cortan: el claim (gate server), la fila y el badge del tab Sobres
-- (fn_my_packs_tab_data) y el push del cron. Los sobres YA otorgados sin
-- abrir se conservan y se pueden abrir (dan repes para cambios). El QR sigue
-- funcionando: escanear es un acto deliberado del user.
--
-- Errores nuevos:
--   P0181 daily_muted
--   P0182 album_completed

-- ============================================================================
-- 1. Columna + RPC de toggle
-- ============================================================================

alter table user_album_membership
  add column if not exists daily_muted boolean not null default false;

create or replace function fn_set_daily_muted(p_album_id uuid, p_muted boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = 'P0010';
  end if;

  update user_album_membership
     set daily_muted = coalesce(p_muted, false)
   where user_id = v_uid and album_id = p_album_id;

  if not found then
    raise exception 'not_member' using errcode = 'P0092';
  end if;
end;
$$;

grant execute on function fn_set_daily_muted(uuid, boolean) to authenticated;

-- ============================================================================
-- 2. Helper interno: ¿el user completó el álbum?
-- ============================================================================

create or replace function _fn_album_completed(
  p_user uuid,
  p_album_id uuid,
  p_total int
) returns boolean
language sql stable security definer set search_path = public as $$
  select p_total > 0 and (
    select count(*)
      from user_collection uc
      join stickers s on s.id = uc.sticker_id
     where uc.user_id = p_user
       and s.album_id = p_album_id
       and uc.pasted = true
  ) >= p_total;
$$;

revoke execute on function _fn_album_completed(uuid, uuid, int) from public;

-- ============================================================================
-- 3. fn_claim_daily_pack con los gates nuevos
-- ============================================================================

create or replace function fn_claim_daily_pack(p_album_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_album albums;
  v_member user_album_membership;
  v_daily_enabled boolean;
  v_count int;
  v_cooldown_hours int;
  v_next_available timestamptz;
  v_pack_ids uuid[];
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = 'P0010';
  end if;

  select * into v_album from albums where id = p_album_id;
  if not found then
    raise exception 'album_not_found' using errcode = 'P0002';
  end if;
  if v_album.status <> 'published' then
    raise exception 'album_not_available_%', v_album.status using errcode = 'P0082';
  end if;

  select * into v_member from user_album_membership
    where user_id = v_uid and album_id = p_album_id;
  if not found then
    raise exception 'not_member' using errcode = 'P0092';
  end if;

  if v_member.daily_muted then
    raise exception 'daily_muted' using errcode = 'P0181';
  end if;
  if _fn_album_completed(v_uid, p_album_id, v_album.total_stickers) then
    raise exception 'album_completed' using errcode = 'P0182';
  end if;

  v_daily_enabled  := coalesce((v_album.pack_config #>> '{daily,enabled}')::boolean, false);
  v_count          := coalesce((v_album.pack_config #>> '{daily,count}')::int, 1);
  v_cooldown_hours := coalesce((v_album.pack_config #>> '{daily,cooldown_hours}')::int, 24);

  if not v_daily_enabled then
    raise exception 'daily_not_enabled' using errcode = 'P0090';
  end if;

  if v_member.last_daily_claim_at is not null then
    v_next_available := v_member.last_daily_claim_at + make_interval(hours => v_cooldown_hours);
    if v_next_available > now() then
      raise exception 'daily_on_cooldown_until_%', to_char(v_next_available at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') using errcode = 'P0091';
    end if;
  end if;

  v_pack_ids := fn_grant_packs(v_uid, p_album_id, 'daily', v_count);

  update user_album_membership
    set last_daily_claim_at = now()
    where user_id = v_uid and album_id = p_album_id;

  return jsonb_build_object(
    'packs', v_count,
    'next_available_at', now() + make_interval(hours => v_cooldown_hours)
  );
end;
$$;

grant execute on function fn_claim_daily_pack(uuid) to authenticated;

-- ============================================================================
-- 4. fn_my_packs_tab_data: playable excluye muted y completados
-- ============================================================================

create or replace function fn_my_packs_tab_data()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_pending jsonb;
  v_playable jsonb;
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = 'P0010';
  end if;

  with counts as (
    select album_id, count(*)::int as c
      from packs
     where user_id = v_uid and opened_at is null
     group by album_id
  )
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'album_id', a.id,
      'album_name', a.name,
      'cover_thumb_key', a.cover_thumb_key,
      'pack_thumb_key', a.pack_thumb_key,
      'pending_count', counts.c
    ) order by counts.c desc, a.name asc),
    '[]'::jsonb
  ) into v_pending
  from counts
  join albums a on a.id = counts.album_id;

  -- Membership (incluye owner joineado como player), no oculto, no muteado,
  -- published y NO completado.
  with playable as (
    select a.*, m.last_daily_claim_at
      from user_album_membership m
      join albums a on a.id = m.album_id
     where m.user_id = v_uid
       and m.hidden = false
       and m.daily_muted = false
       and a.status = 'published'
       and not _fn_album_completed(v_uid, a.id, a.total_stickers)
  )
  select coalesce(
    jsonb_agg(jsonb_build_object(
      'album_id', p.id,
      'album_name', p.name,
      'cover_thumb_key', p.cover_thumb_key,
      'pack_thumb_key', p.pack_thumb_key,
      'daily', jsonb_build_object(
        'enabled', coalesce((p.pack_config #>> '{daily,enabled}')::boolean, false),
        'count', coalesce((p.pack_config #>> '{daily,count}')::int, 1),
        'cooldown_hours', coalesce((p.pack_config #>> '{daily,cooldown_hours}')::int, 24),
        'next_available_at', case
          when p.last_daily_claim_at is null then null
          else p.last_daily_claim_at
                 + make_interval(hours => coalesce((p.pack_config #>> '{daily,cooldown_hours}')::int, 24))
        end
      )
    ) order by p.name asc),
    '[]'::jsonb
  ) into v_playable
  from playable p;

  return jsonb_build_object(
    'pending_packs', v_pending,
    'playable_albums', v_playable
  );
end;
$$;

grant execute on function fn_my_packs_tab_data() to authenticated;

-- ============================================================================
-- 5. Cron de notificación: no molestar a muteados ni completados
-- ============================================================================

create or replace function _cron_notify_daily_available()
returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  for r in
    select m.user_id, m.album_id, a.name as album_name
      from user_album_membership m
      join albums a on a.id = m.album_id
     where m.hidden = false
       and m.daily_muted = false
       and m.daily_notified_at is null
       and a.status = 'published'
       and coalesce((a.pack_config #>> '{daily,enabled}')::boolean, false) = true
       and (
         m.last_daily_claim_at is null
         or m.last_daily_claim_at
              + make_interval(hours => coalesce((a.pack_config #>> '{daily,cooldown_hours}')::int, 24))
              <= now()
       )
       and not _fn_album_completed(m.user_id, m.album_id, a.total_stickers)
  loop
    perform _send_push(
      r.user_id,
      'Sobre diario disponible',
      format('Tenés un sobre listo en "%s".', r.album_name),
      jsonb_build_object('kind', 'daily_ready', 'album_id', r.album_id)
    );
    update user_album_membership
       set daily_notified_at = now()
     where user_id = r.user_id and album_id = r.album_id;
  end loop;
end;
$$;

-- ============================================================================
-- 6. fn_player_album_sidedata: exponer daily_muted para el toggle de la UI
-- ============================================================================

create or replace function fn_player_album_sidedata(p_album_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_album albums;
  v_member user_album_membership;
  v_collection jsonb;
  v_packs_available int;
  v_daily_enabled boolean;
  v_daily_count int;
  v_daily_cooldown int;
  v_next timestamptz;
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = 'P0010';
  end if;

  select * into v_album from albums where id = p_album_id;
  if not found then
    raise exception 'album_not_found' using errcode = 'P0002';
  end if;

  select * into v_member from user_album_membership
    where user_id = v_uid and album_id = p_album_id;

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'sticker_id', uc.sticker_id,
      'pasted',     uc.pasted,
      'quantity',   uc.quantity
    )),
    '[]'::jsonb
  )
  into v_collection
  from user_collection uc
  join stickers s on s.id = uc.sticker_id
  where uc.user_id = v_uid
    and s.album_id = p_album_id;

  select count(*) into v_packs_available
    from packs
   where user_id = v_uid
     and album_id = p_album_id
     and opened_at is null;

  v_daily_enabled  := coalesce((v_album.pack_config #>> '{daily,enabled}')::boolean, false);
  v_daily_count    := coalesce((v_album.pack_config #>> '{daily,count}')::int, 1);
  v_daily_cooldown := coalesce((v_album.pack_config #>> '{daily,cooldown_hours}')::int, 24);
  v_next := case
    when v_member.last_daily_claim_at is null then null
    else v_member.last_daily_claim_at + make_interval(hours => v_daily_cooldown)
  end;

  return jsonb_build_object(
    'collection', v_collection,
    'packs_available', v_packs_available,
    'daily_muted', coalesce(v_member.daily_muted, false),
    'daily', jsonb_build_object(
      'enabled', v_daily_enabled,
      'count', v_daily_count,
      'cooldown_hours', v_daily_cooldown,
      'next_available_at', v_next
    )
  );
end;
$$;

grant execute on function fn_player_album_sidedata(uuid) to authenticated;
