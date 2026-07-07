-- Mi Álbum de Figuritas — eliminar un álbum definitivamente
--
-- El owner puede borrar su álbum. Es DESTRUCTIVO e irreversible: las FKs en
-- cascade arrastran stickers (y con ellos las colecciones de los jugadores),
-- memberships, sobres y ofertas de intercambio. Las imágenes en R2 quedan
-- huérfanas (no hay proceso de limpieza — aceptado, son keys aisladas).
--
-- Defensa server-side además del doble confirm del cliente: el caller debe
-- mandar su PROPIO email y tiene que coincidir con el del JWT. Un cliente
-- comprometido no puede borrar "por accidente" sin conocer el email.
--
-- Errores:
--   P0200 email_confirmation_mismatch

create or replace function fn_delete_album(
  p_album_id uuid,
  p_confirm_email text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_album albums := fn_assert_owner(p_album_id);
  v_jwt_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_jwt_email = '' or lower(trim(coalesce(p_confirm_email, ''))) <> v_jwt_email then
    raise exception 'email_confirmation_mismatch' using errcode = 'P0200';
  end if;

  delete from albums where id = v_album.id;
end;
$$;

grant execute on function fn_delete_album(uuid, text) to authenticated;
