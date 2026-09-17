-- Mi Álbum de Figuritas — borrado de cuenta (cumplimiento Google Play / GDPR).
--
-- fn_delete_account() limpia todo lo que el caller posee ANTES de que la Edge
-- Function delete_account borre el row de auth.users (con service role, vía
-- auth.admin.deleteUser). Respeta la regla del mundo físico que ya usa
-- fn_delete_album (0046/0047): los álbumes que YA juegan otros usuarios NO se
-- destruyen — sus colecciones sobreviven.
--
--   - Álbum propio CON otros jugadores → se RETIRA (status='read_only',
--     owner_hidden=true, retired_at=now(), trades pending cancelados). Igual
--     que "retirar" desde la app. Al borrarse el usuario, owner_id pasa a NULL
--     (FK ON DELETE SET NULL) → el álbum queda "sin dueño" (creador eliminado),
--     read-only, sin emisión nueva, pero los jugadores conservan membership y
--     colección y siguen pudiendo pegar lo que ya tienen.
--   - Álbum propio SIN otros jugadores (o borrador) → hard delete (cascade a
--     stickers/colecciones/packs/trades/qr_secret).
--   - Álbumes especiales protegidos → no se tocan (no aplica a users normales).
--
-- Cuando la Edge Function borra auth.users → cascade a profiles → cascade a
-- membership/collection/packs/trades/subscriptions/profile_push_tokens del
-- caller, y SET NULL en albums.owner_id de los álbumes retirados que sobreviven.
--
-- Para que el borrado del profile NO quede bloqueado, hay que soltar los dos
-- FKs que hoy lo restringen (albums.owner_id RESTRICT y preset_images.created_by
-- NO ACTION) y volverlos nullable + SET NULL.

-- ============================================================================
-- 1) FKs que bloqueaban el borrado del profile → nullable + ON DELETE SET NULL.
-- ============================================================================

-- albums.owner_id: NOT NULL + RESTRICT → nullable + SET NULL.
alter table albums alter column owner_id drop not null;
alter table albums drop constraint albums_owner_id_fkey;
alter table albums add constraint albums_owner_id_fkey
  foreign key (owner_id) references profiles(id) on delete set null;

-- preset_images.created_by: NOT NULL + NO ACTION → nullable + SET NULL.
-- (Solo lo escriben admins, pero así el borrado de cuenta es a prueba de balas.)
alter table preset_images alter column created_by drop not null;
alter table preset_images drop constraint preset_images_created_by_fkey;
alter table preset_images add constraint preset_images_created_by_fkey
  foreign key (created_by) references profiles(id) on delete set null;

-- ============================================================================
-- 2) fn_delete_account: limpieza server-side previa al borrado de auth.users.
-- ============================================================================

create or replace function fn_delete_account() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_album record;
  v_players int;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = 'P0100';
  end if;

  for v_album in select id from albums where owner_id = v_uid loop
    -- Especiales protegidos: nunca se retiran ni borran.
    if v_album.id in (
      '55fce726-d398-491f-9a92-06ee2e6c8d96',
      '29a1fa90-85b3-48fc-b452-2b7f64bd327b'
    ) then
      continue;
    end if;

    select count(*) into v_players
      from user_album_membership
     where album_id = v_album.id and user_id <> v_uid;

    if v_players > 0 then
      -- RETIRAR: conserva las colecciones de los jugadores.
      update trade_offers
         set status = 'cancelled'
       where album_id = v_album.id and status = 'pending';
      update albums
         set status = 'read_only', owner_hidden = true, retired_at = now()
       where id = v_album.id;
      -- owner_id se limpia solo al borrar el profile (FK SET NULL).
    else
      -- HARD DELETE: borrador o sin otros jugadores. Cascade hace el resto.
      delete from albums where id = v_album.id;
    end if;
  end loop;
end;
$$;

grant execute on function fn_delete_account() to authenticated;
