-- Mi Álbum de Figuritas — margen de 1h en el cooldown del sobre diario
--
-- Un cooldown exacto de 24h castiga al user que entra "a la misma hora de
-- ayer": siempre le falta un ratito. El valor guardado en pack_config sigue
-- siendo el nominal (24 diario / 168 semanal — la UI no cambia), pero el
-- cooldown EFECTIVO es nominal - 1h (23h / 167h). Un solo helper para que
-- las 4 funciones que lo calculan no puedan divergir.
--
-- El QR mantiene su cooldown exacto (no lo pidió nadie y es otro flujo).

-- ============================================================================
-- 1. Helper único del intervalo efectivo
-- ============================================================================

create or replace function _fn_daily_interval(p_cooldown_hours int)
returns interval
language sql immutable as $$
  select make_interval(hours => greatest(coalesce(p_cooldown_hours, 24) - 1, 1));
$$;

revoke execute on function _fn_daily_interval(int) from public;

-- ============================================================================
-- 2. fn_claim_daily_pack
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
    v_next_available := v_member.last_daily_claim_at + _fn_daily_interval(v_cooldown_hours);
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
    'next_available_at', now() + _fn_daily_interval(v_cooldown_hours)
  );
end;
$$;

grant execute on function fn_claim_daily_pack(uuid) to authenticated;

-- ============================================================================
-- 3. fn_my_packs_tab_data
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
                 + _fn_daily_interval((p.pack_config #>> '{daily,cooldown_hours}')::int)
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
-- 4. Cron de notificación
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
              + _fn_daily_interval((a.pack_config #>> '{daily,cooldown_hours}')::int)
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
-- 5. fn_player_album_sidedata
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
    else v_member.last_daily_claim_at + _fn_daily_interval(v_daily_cooldown)
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
