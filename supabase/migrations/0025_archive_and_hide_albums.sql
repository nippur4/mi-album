-- Mi Álbum de Figuritas — archivar (owner) y ocultar (player) álbumes
--
-- Dos comportamientos distintos según el rol:
--
--   1) OWNER archiva: setea albums.owner_hidden = true.
--      - El owner ya no ve el álbum en Home ni en "Gestionar" (a menos que
--        active el toggle "mostrar archivados").
--      - Los jugadores lo SIGUEN VIENDO y jugando exactamente igual:
--        pueden abrir sobres, pegar, escanear QR, intercambiar. La experiencia
--        del jugador no cambia. Esto es distinto de status='read_only' (que
--        bloquea sobres nuevos) o status='archived' (que bloquea todo).
--
--   2) PLAYER oculta: setea user_album_membership.hidden = true.
--      - Solo desaparece de la UI de ese player (Home, tab Sobres, etc.).
--      - Otros jugadores lo siguen viendo. El álbum sigue funcionando normal.
--
-- Ambas acciones son reversibles con las RPCs "unhide"/"unarchive".

-- =========================================================================
-- 1) Columnas nuevas
-- =========================================================================

alter table albums
  add column owner_hidden boolean not null default false;

alter table user_album_membership
  add column hidden boolean not null default false;

-- =========================================================================
-- 2) Owner archivar / des-archivar
-- =========================================================================

create or replace function fn_archive_album_by_owner(p_album_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_album albums := fn_assert_owner(p_album_id);
begin
  update albums set owner_hidden = true where id = v_album.id;
end;
$$;

create or replace function fn_unarchive_album_by_owner(p_album_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_album albums := fn_assert_owner(p_album_id);
begin
  update albums set owner_hidden = false where id = v_album.id;
end;
$$;

grant execute on function fn_archive_album_by_owner(uuid) to authenticated;
grant execute on function fn_unarchive_album_by_owner(uuid) to authenticated;

-- =========================================================================
-- 3) Player ocultar / des-ocultar
-- =========================================================================

create or replace function fn_hide_album_by_player(p_album_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = 'P0010';
  end if;

  update user_album_membership
    set hidden = true
    where user_id = v_uid and album_id = p_album_id;

  if not found then
    raise exception 'not_member' using errcode = 'P0092';
  end if;
end;
$$;

create or replace function fn_unhide_album_by_player(p_album_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = 'P0010';
  end if;

  update user_album_membership
    set hidden = false
    where user_id = v_uid and album_id = p_album_id;

  if not found then
    raise exception 'not_member' using errcode = 'P0092';
  end if;
end;
$$;

grant execute on function fn_hide_album_by_player(uuid) to authenticated;
grant execute on function fn_unhide_album_by_player(uuid) to authenticated;
