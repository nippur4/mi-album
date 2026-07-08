-- Mi Álbum de Figuritas — eliminar álbum: retirar vs borrar + proteger especiales
--
-- Cambio de semántica de fn_delete_album:
--   - Si el álbum YA lo juegan otros usuarios → NO se borra. Se RETIRA:
--     status='read_only' + owner_hidden=true. Eso frena toda emisión nueva
--     (join, claim diario, QR redeem y trades chequean status='published' →
--     P0082), pero los jugadores conservan su membership y colección, y
--     siguen pudiendo pegar lo que ya tienen (fn_paste_sticker no mira status).
--     Reversible: el owner desarchiva cuando quiera.
--   - Si es borrador o no tiene otros jugadores → hard delete con cascade
--     (comportamiento anterior), exigiendo email == JWT.
--
-- Además: dos álbumes especiales NO se pueden eliminar NUNCA (ni retirar ni
-- borrar): el especial 0..1000 de avatares y el otro curado. Se bloquean por id.
--
-- Errores:
--   P0200 email_confirmation_mismatch
--   P0201 album_protected  (nuevo)

-- Los dos ids intocables. Hardcodeados a propósito (excepciones administradas).
--   55fce726-d398-491f-9a92-06ee2e6c8d96
--   29a1fa90-85b3-48fc-b452-2b7f64bd327b

-- La 0042 la creó como `returns void`; cambiar el tipo de retorno exige DROP.
drop function if exists fn_delete_album(uuid, text);

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

  -- ¿Lo juegan OTROS? La membership del propio owner-as-player no cuenta.
  select count(*) into v_players
    from user_album_membership
   where album_id = p_album_id and user_id <> v_album.owner_id;

  if v_players > 0 then
    -- RETIRAR (reversible): frena emisión, conserva todo lo de los jugadores.
    update trade_offers
       set status = 'cancelled'
     where album_id = p_album_id and status = 'pending';
    update albums
       set status = 'read_only', owner_hidden = true
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
-- Conteo de jugadores (owner-only) para que el cliente muestre el copy correcto
-- ANTES de actuar (retirar vs borrar). El branch real lo decide el server.
-- ============================================================================

create or replace function fn_album_player_count(p_album_id uuid) returns int
language plpgsql stable security definer set search_path = public as $$
declare
  v_album albums := fn_assert_owner(p_album_id);
begin
  return (
    select count(*)::int
      from user_album_membership
     where album_id = p_album_id and user_id <> v_album.owner_id
  );
end;
$$;

grant execute on function fn_album_player_count(uuid) to authenticated;
