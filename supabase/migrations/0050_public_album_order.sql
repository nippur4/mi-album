-- Mi Álbum de Figuritas — orden configurable de los álbumes públicos
--
-- El carrusel de públicos del Home (fn_home_bundle) se ordenaba solo por
-- published_at desc. Ahora el admin puede fijar un "rank": mayor rank aparece
-- antes; los no rankeados (rank=0) empatan y caen por published_at (recientes
-- primero, comportamiento anterior).

alter table albums add column if not exists public_rank int not null default 0;

-- ============================================================================
-- fn_set_album_public_rank — admin fija el orden de un álbum público
-- ============================================================================

create or replace function fn_set_album_public_rank(p_album_id uuid, p_rank int)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_is_admin boolean;
begin
  select is_admin into v_is_admin from profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'admin_required' using errcode = 'P0070';
  end if;
  update albums set public_rank = greatest(0, coalesce(p_rank, 0)) where id = p_album_id;
end;
$$;

grant execute on function fn_set_album_public_rank(uuid, int) to authenticated;

-- ============================================================================
-- fn_admin_list_albums — agregar public_rank al listado (RETURNS TABLE cambia
-- de firma → hay que DROP antes)
-- ============================================================================

drop function if exists fn_admin_list_albums();

create or replace function fn_admin_list_albums()
returns table(
  id uuid, name text, owner_id uuid, owner_name text, status album_status,
  is_public boolean, total_stickers integer, published_at timestamptz,
  created_at timestamptz, member_count integer, public_rank integer
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_is_admin boolean;
begin
  select p.is_admin into v_is_admin from profiles p where p.id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'admin_required' using errcode = 'P0070';
  end if;
  return query
  select
    a.id, a.name, a.owner_id, p.display_name as owner_name, a.status,
    a.is_public, a.total_stickers, a.published_at, a.created_at,
    (select count(*)::int from user_album_membership where album_id = a.id) as member_count,
    a.public_rank
  from albums a
  join profiles p on p.id = a.owner_id
  where a.status <> 'archived'
  order by
    case a.status
      when 'published' then 1
      when 'read_only' then 2
      when 'draft' then 3
      else 4
    end,
    a.public_rank desc,
    a.created_at desc;
end;
$$;

grant execute on function fn_admin_list_albums() to authenticated;

-- ============================================================================
-- fn_home_bundle — ordenar los públicos por public_rank (recrea 0032 con el
-- order nuevo; el resto queda idéntico)
-- ============================================================================

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
      select coalesce(
        jsonb_agg(row_to_json(a)::jsonb order by a.public_rank desc, a.published_at desc nulls last),
        '[]'::jsonb
      )
      from (
        select * from albums
        where is_public = true and status = 'published'
        order by public_rank desc, published_at desc nulls last
        limit 20
      ) a
    )
  );
end;
$$;

grant execute on function fn_home_bundle() to authenticated;
