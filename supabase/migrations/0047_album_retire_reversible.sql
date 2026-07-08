-- Mi Álbum de Figuritas — hacer reversible el "retiro" de un álbum con jugadores
--
-- La 0046 hace que fn_delete_album, cuando el álbum tiene jugadores, lo RETIRE
-- (status='read_only' + owner_hidden=true) en vez de borrarlo. Pero
-- fn_unarchive_album_by_owner solo flipeaba owner_hidden, así que desarchivar
-- dejaba el álbum en 'read_only' (pausado) para siempre, sin forma de reanudar
-- la emisión de sobres. Esto lo arregla:
--
--   - albums.retired_at marca los álbumes retirados POR EL OWNER, distinguiéndolos
--     de los 'read_only' por baja de Pro (esos no se tocan acá: los reactiva
--     _fn_restore_pro_albums al re-suscribirse). El pro-downgrade NO setea
--     owner_hidden ni retired_at.
--   - Al desarchivar un álbum con retired_at seteado → vuelve a 'published' y se
--     limpia retired_at. Reactivación completa: se reanudan join/diario/QR/trades.

alter table albums add column if not exists retired_at timestamptz;

-- ============================================================================
-- fn_delete_album: el branch de retirar ahora marca retired_at.
-- (Mismo comportamiento que 0046 salvo el retired_at; misma firma/retorno text.)
-- ============================================================================

create or replace function fn_delete_album(
  p_album_id uuid,
  p_confirm_email text
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_album albums := fn_assert_owner(p_album_id);
  v_jwt_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_players int;
begin
  if p_album_id in (
    '55fce726-d398-491f-9a92-06ee2e6c8d96',
    '29a1fa90-85b3-48fc-b452-2b7f64bd327b'
  ) then
    raise exception 'album_protected' using errcode = 'P0201';
  end if;

  select count(*) into v_players
    from user_album_membership
   where album_id = p_album_id and user_id <> v_album.owner_id;

  if v_players > 0 then
    -- RETIRAR (reversible vía desarchivar): frena emisión, conserva todo.
    update trade_offers
       set status = 'cancelled'
     where album_id = p_album_id and status = 'pending';
    update albums
       set status = 'read_only', owner_hidden = true, retired_at = now()
     where id = p_album_id;
    return 'retired';
  end if;

  -- HARD DELETE: borrador o sin jugadores. Doble defensa con el email del JWT.
  if v_jwt_email = '' or lower(trim(coalesce(p_confirm_email, ''))) <> v_jwt_email then
    raise exception 'email_confirmation_mismatch' using errcode = 'P0200';
  end if;

  delete from albums where id = p_album_id;
  return 'deleted';
end;
$$;

grant execute on function fn_delete_album(uuid, text) to authenticated;

-- ============================================================================
-- fn_unarchive_album_by_owner: si el álbum estaba RETIRADO por el owner, al
-- desarchivar se reactiva por completo (vuelve a 'published').
-- ============================================================================

create or replace function fn_unarchive_album_by_owner(p_album_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_album albums := fn_assert_owner(p_album_id);
begin
  update albums
     set owner_hidden = false,
         -- Solo los retirados por el owner (retired_at set) vuelven a published.
         -- Los read_only por baja de Pro no tienen retired_at → no se tocan.
         status = case when retired_at is not null then 'published'::album_status else status end,
         retired_at = null
   where id = v_album.id;
end;
$$;

grant execute on function fn_unarchive_album_by_owner(uuid) to authenticated;
