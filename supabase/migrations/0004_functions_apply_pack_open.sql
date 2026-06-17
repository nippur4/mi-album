-- Mi Álbum de Figuritas — aplicación transaccional de apertura de sobre
--
-- Esta RPC NO sortea; recibe el array de sticker_ids ya elegidos por la
-- Edge Function `open_pack` (ver supabase/functions/open_pack/index.ts) y
-- aplica el efecto sobre el estado en una sola transacción atómica.
--
-- La separación es a propósito:
--   - La aleatoriedad ponderada y los pesos de rareza viven en TS para que
--     sean fáciles de versionar y cambiar.
--   - La persistencia vive en PL/pgSQL para garantizar la transacción.

-- ============================================================================
-- APPLY PACK OPEN
-- ============================================================================

-- Recibe un pack_id y la lista de sticker_ids que ya fueron sorteados.
-- Marca el pack como abierto, hace upsert en user_collection y devuelve un
-- array (en el mismo orden que p_sticker_ids) con { sticker_id, was_new }.
--
-- "was_new" es true si era la primera copia que el user obtenía de ese sticker.
-- Si el mismo sticker_id aparece dos veces en el array, la primera aparición
-- queda con was_new=true (si era nuevo) y la segunda con was_new=false (la
-- primera ya creó la fila).
create or replace function fn_apply_pack_open(
  p_pack_id uuid,
  p_sticker_ids uuid[]
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_pack packs;
  v_result jsonb := '[]'::jsonb;
  v_sticker_id uuid;
  v_was_new boolean;
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = 'P0010';
  end if;
  if p_sticker_ids is null or array_length(p_sticker_ids, 1) is null then
    raise exception 'no_stickers' using errcode = 'P0100';
  end if;

  -- FOR UPDATE serializa requests concurrentes sobre el mismo pack
  select * into v_pack from packs where id = p_pack_id for update;
  if not found then
    raise exception 'pack_not_found' using errcode = 'P0101';
  end if;
  if v_pack.user_id <> v_uid then
    raise exception 'not_pack_owner' using errcode = 'P0102';
  end if;
  if v_pack.opened_at is not null then
    raise exception 'pack_already_opened' using errcode = 'P0103';
  end if;

  update packs
    set opened_at = now(),
        contents = to_jsonb(p_sticker_ids)
    where id = p_pack_id;

  foreach v_sticker_id in array p_sticker_ids loop
    -- xmax = 0 → la fila fue INSERT (no había antes). Es el patrón estándar
    -- para distinguir insert vs update dentro de un upsert.
    insert into user_collection (user_id, sticker_id, quantity)
    values (v_uid, v_sticker_id, 1)
    on conflict (user_id, sticker_id) do update
      set quantity = user_collection.quantity + 1,
          last_obtained_at = now()
    returning (xmax = 0) into v_was_new;

    v_result := v_result || jsonb_build_object(
      'sticker_id', v_sticker_id,
      'was_new', v_was_new
    );
  end loop;

  return v_result;
end;
$$;

grant execute on function fn_apply_pack_open(uuid, uuid[]) to authenticated;
