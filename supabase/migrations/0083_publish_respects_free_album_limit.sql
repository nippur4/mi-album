-- Mi Álbum de Figuritas — publicar también respeta el límite de álbumes del free
--
-- HUECO: el gate de "free = 1 álbum activo" vivía SOLO en `fn_create_album`
-- (`fn_count_active_albums(uid) >= 1` → P0020). `fn_publish_album` no contaba
-- álbumes, así que un owner free con varios borradores —los típicos que quedan
-- de una etapa Pro, porque la bajada de suscripción deja los drafts intactos a
-- propósito— podía publicarlos todos y terminar con N álbumes publicados
-- estando en free.
--
-- Detectado por Nico el 2026-10-20 revisando qué restringe realmente el free.
--
-- FIX: mismo gate que al crear, pero excluyendo el álbum que se está publicando
-- (si no, el propio draft se contaría a sí mismo y el free nunca podría
-- publicar su único álbum). Mismo errcode P0020 → el cliente ya lo mapea a
-- "pro_required" y abre el paywall, sin tocar nada del lado de la app.
--
-- `fn_count_active_albums` cuenta todo lo que no esté `archived`: drafts,
-- published y read_only. Es deliberado — bajo free solo podés tener UNO, sin
-- importar en qué estado esté.
--
-- Recreada desde su definición VIVA (0049, con el rango por `number_start`)
-- para no pisar ese fix. El único cambio es el bloque nuevo del gate.

create or replace function fn_publish_album(p_album_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_album albums := fn_assert_owner(p_album_id);
  v_loaded int;
  v_missing int;
  v_others int;
begin
  if v_album.status <> 'draft' then
    raise exception 'album_not_draft' using errcode = 'P0030';
  end if;

  -- Gate de free: no podés tener un segundo álbum activo. Excluye el que se
  -- está publicando, que ya existe como draft y se contaría a sí mismo.
  if not fn_is_pro(v_album.owner_id) then
    select count(*)::int into v_others
      from albums
      where owner_id = v_album.owner_id
        and status <> 'archived'
        and id <> v_album.id;
    if v_others >= 1 then
      raise exception 'pro_required' using errcode = 'P0020';
    end if;
  end if;

  if v_album.cover_thumb_key is null or v_album.cover_large_key is null then
    raise exception 'album_cover_required' using errcode = 'P0060';
  end if;
  if v_album.pack_thumb_key is null or v_album.pack_large_key is null then
    raise exception 'album_pack_image_required' using errcode = 'P0061';
  end if;

  select count(*) into v_loaded from stickers where album_id = v_album.id;
  if v_loaded <> v_album.total_stickers then
    raise exception 'stickers_count_mismatch_%_of_%', v_loaded, v_album.total_stickers
      using errcode = 'P0062';
  end if;

  -- Rango real de números según number_start (0..total-1 para el especial,
  -- 1..total para el resto).
  select min(g.n) into v_missing
  from generate_series(
    v_album.number_start,
    v_album.number_start + v_album.total_stickers - 1
  ) g(n)
  where not exists (select 1 from stickers s where s.album_id = v_album.id and s.number = g.n);
  if v_missing is not null then
    raise exception 'sticker_number_missing_%', v_missing using errcode = 'P0063';
  end if;

  update albums
    set status = 'published', published_at = now()
    where id = v_album.id;
end;
$$;

grant execute on function fn_publish_album(uuid) to authenticated;
