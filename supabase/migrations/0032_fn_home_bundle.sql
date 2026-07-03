-- Mi Álbum de Figuritas — RPC bundle para el tab Home.
--
-- Reemplaza 3 llamadas separadas al abrir Home:
--   1) useMyOwnedAlbums()                            — owned del caller
--   2) useMyMemberAlbums({ includeHidden: true })    — todos joined (con hidden flag)
--   3) usePublicAlbums()                              — top 20 públicos
--
-- El progress (fn_album_progress) sigue siendo una llamada separada porque
-- su cache invalida distinto (cambia por pastes/loads de figuritas), y con
-- react-query la key incluye los ids — se cachea entre re-renders.
--
-- Output JSONB:
--   {
--     owned:   [ album, ... ]         (no incluye archived ni owner_hidden)
--     joined:  [ album + hidden ]     (incluye hidden=true, el cliente filtra)
--     public:  [ album, ... ]         (top 20 públicos publicados)
--   }
--
-- El shape de cada album es `row_to_json(albums)` → cliente cast a Album.

create or replace function fn_home_bundle()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = 'P0010';
  end if;

  return jsonb_build_object(
    'owned', (
      select coalesce(jsonb_agg(row_to_json(a)::jsonb order by a.created_at desc), '[]'::jsonb)
      from albums a
      where a.owner_id = v_uid
        and a.status <> 'archived'
        and a.owner_hidden = false
    ),
    'joined', (
      -- Traemos TODAS las memberships (incluidas hidden=true) — el cliente
      -- filtra según toggle. Cada álbum trae el flag `hidden` de su membership.
      select coalesce(jsonb_agg(
        row_to_json(a)::jsonb || jsonb_build_object('__hidden', m.hidden)
        order by a.created_at desc
      ), '[]'::jsonb)
      from user_album_membership m
      join albums a on a.id = m.album_id
      where m.user_id = v_uid
        and a.status <> 'archived'
    ),
    'public', (
      select coalesce(jsonb_agg(row_to_json(a)::jsonb), '[]'::jsonb)
      from (
        select * from albums
        where is_public = true and status = 'published'
        order by published_at desc nulls last
        limit 20
      ) a
    )
  );
end;
$$;

grant execute on function fn_home_bundle() to authenticated;
