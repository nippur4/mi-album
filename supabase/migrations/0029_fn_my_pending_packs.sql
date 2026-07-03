-- Mi Álbum de Figuritas — RPC batch para sobres pendientes por álbum
--
-- Reemplaza las 2 queries que hacía useMyOpenPacksByAlbum en el cliente:
--   1) select album_id from packs where user_id = ? and opened_at is null
--   2) select * from albums where id in (...)
-- + agregación por álbum en JS.
--
-- Con esta RPC el cliente hace 1 sola llamada. Devuelve solo las columnas
-- que la UI usa para renderizar la lista (nombre + thumbs + count).

create or replace function fn_my_pending_packs()
returns table (
  album_id uuid,
  album_name text,
  cover_thumb_key text,
  pack_thumb_key text,
  pending_count bigint
)
language sql security definer set search_path = public as $$
  select
    a.id            as album_id,
    a.name          as album_name,
    a.cover_thumb_key,
    a.pack_thumb_key,
    count(p.id)     as pending_count
    from packs p
    join albums a on a.id = p.album_id
   where p.user_id = auth.uid()
     and p.opened_at is null
   group by a.id, a.name, a.cover_thumb_key, a.pack_thumb_key
   order by pending_count desc, a.name asc;
$$;

grant execute on function fn_my_pending_packs() to authenticated;
