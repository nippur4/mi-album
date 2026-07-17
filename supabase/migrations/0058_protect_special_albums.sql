-- Mi Álbum de Figuritas — blindar los 3 álbumes especiales contra borrado
--
-- La lista de protegidos de fn_delete_album (0046/0047) tenía solo 2 ids y NO
-- incluía al álbum 0..1000 ni al de dinosaurios. Los 3 especiales confirmados:
--   29a1fa90-85b3-48fc-b452-2b7f64bd327b  álbum de avatares
--   ecbf4497-e5d7-4732-88a2-75f7b39a2749  álbum 0..1000 (number_start=0)
--   d1227449-f10c-41e6-8483-5bef42b9fb0a  álbum de dinosaurios (SFX temáticos)
-- 55fce726-… queda protegido como estaba (id histórico, sin identificar).
--
-- Recreada desde la definición VIVA (0047, con retired_at) — solo cambia la
-- lista de ids. Espejo client-side: PROTECTED_ALBUM_IDS en lib/queries/albums.ts.

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
    '29a1fa90-85b3-48fc-b452-2b7f64bd327b',
    'ecbf4497-e5d7-4732-88a2-75f7b39a2749',
    'd1227449-f10c-41e6-8483-5bef42b9fb0a'
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
