-- Mi Álbum de Figuritas — tab Sobres: incluir álbumes propios jugados como player
--
-- fn_my_packs_tab_data excluía álbumes donde el caller es owner
-- (`a.owner_id <> v_uid`), un criterio anterior a la Fase 10 (owner puede
-- joinearse como jugador a su propio álbum). Resultado: si jugás tus propios
-- álbumes, sus dailies (listos o en countdown) no aparecían en el tab Sobres.
--
-- El signal correcto es la MEMBERSHIP: solo existe si alguien se unió como
-- jugador — owner sin joinear no tiene fila y sigue sin aparecer.

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

  -- Sobres pendientes por álbum (group by en Postgres, no en JS).
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

  -- Álbumes jugables con status del daily.
  --
  -- Criterios:
  --   - El caller tiene membership (incluye owner joineado como player).
  --   - NO ocultó el álbum.
  --   - Álbum published.
  with playable as (
    select a.*, m.last_daily_claim_at
      from user_album_membership m
      join albums a on a.id = m.album_id
     where m.user_id = v_uid
       and m.hidden = false
       and a.status = 'published'
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
