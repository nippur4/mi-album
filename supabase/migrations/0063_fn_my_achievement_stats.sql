-- Mi Álbum de Figuritas — stats para el sistema de logros
--
-- Los logros son 100% DERIVABLES de datos que ya existen, así que no hay tabla
-- de logros ni tracking de eventos: una sola RPC calcula los números crudos y
-- el CLIENTE decide qué logro está desbloqueado (catálogo estático en
-- lib/achievements.ts con nombres/íconos/umbrales — iterable sin migración).
--
-- Devuelve:
--   packs_opened          sobres abiertos por el caller (packs.opened_at)
--   albums_created        álbumes creados por el caller (owner)
--   albums_completed      álbumes donde pegó TODAS las figuritas
--   completed_special_ids cuáles de los 3 álbumes especiales completó
--
-- Reutiliza _fn_album_completed (migración 0039). Barato: un puñado de COUNT y
-- N subqueries por álbum jugado (N chico). Pensado para la pantalla de perfil,
-- no para hot paths.

create or replace function fn_my_achievement_stats()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_packs_opened int;
  v_albums_created int;
  v_completed_ids uuid[];
  -- Los 3 álbumes especiales curados (espejo de PROTECTED_ALBUM_IDS en cliente,
  -- sin el 4to histórico sin identificar).
  v_special_ids uuid[] := array[
    '29a1fa90-85b3-48fc-b452-2b7f64bd327b'::uuid,  -- avatares
    'ecbf4497-e5d7-4732-88a2-75f7b39a2749'::uuid,  -- 0..1000
    'd1227449-f10c-41e6-8483-5bef42b9fb0a'::uuid   -- dinosaurios
  ];
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = 'P0010';
  end if;

  select count(*)::int into v_packs_opened
    from packs
   where user_id = v_uid and opened_at is not null;

  select count(*)::int into v_albums_created
    from albums
   where owner_id = v_uid;

  -- Álbumes completados (todas las figuritas pegadas) entre los que juega.
  select coalesce(array_agg(a.id), array[]::uuid[]) into v_completed_ids
    from user_album_membership m
    join albums a on a.id = m.album_id
   where m.user_id = v_uid
     and _fn_album_completed(v_uid, a.id, a.total_stickers);

  return jsonb_build_object(
    'packs_opened', v_packs_opened,
    'albums_created', v_albums_created,
    'albums_completed', coalesce(array_length(v_completed_ids, 1), 0),
    'completed_special_ids', to_jsonb(
      array(
        select unnest(v_completed_ids)
        intersect
        select unnest(v_special_ids)
      )
    )
  );
end;
$$;

grant execute on function fn_my_achievement_stats() to authenticated;
