-- Mi Álbum de Figuritas — performance: índice de membership + cap en matches
--
-- 1) Índice en user_album_membership(album_id).
--    La PK es (user_id, album_id), que solo sirve para búsquedas por user.
--    Los caminos que arrancan por álbum hacían seq scan:
--      - v_user_album_inventory filtrada por album_id (their_inv en
--        fn_album_matches: "todos los miembros de este álbum")
--      - member_count en fn_admin_list_albums
--
-- 2) fn_album_matches: cap de pares por contraparte.
--    El join they_give × i_give generaba el producto cartesiano por usuario
--    (50 faltantes × 50 repes = 2.500 filas por contraparte) antes del
--    order by + limit global. Con row_number() cortamos a MAX_PAIRS_PER_USER
--    pares por contraparte ANTES de joinear profiles/stickers y ordenar.
--    Efecto visible: un mismo usuario ya no puede llenar la lista con todas
--    sus combinaciones — aparecen más contrapartes distintas. Los pares que
--    quedan son los de mejor rareza (mismo criterio de orden que el global).

-- ============================================================================
-- 1. ÍNDICE
-- ============================================================================

create index if not exists idx_membership_album
  on user_album_membership(album_id);

-- ============================================================================
-- 2. fn_album_matches CON CAP POR CONTRAPARTE
-- ============================================================================

create or replace function fn_album_matches(
  p_album_id uuid,
  p_limit int default 50
) returns table (
  other_user_id uuid,
  other_user_name text,
  other_user_avatar_url text,
  they_give_sticker_id uuid,
  they_give_sticker_number int,
  they_give_sticker_name text,
  they_give_sticker_rarity sticker_rarity,
  they_give_sticker_thumb_key text,
  i_give_sticker_id uuid,
  i_give_sticker_number int,
  i_give_sticker_name text,
  i_give_sticker_rarity sticker_rarity,
  i_give_sticker_thumb_key text
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = 'P0010';
  end if;
  if not exists (
    select 1 from user_album_membership
    where user_id = v_uid and album_id = p_album_id
  ) then
    raise exception 'not_member' using errcode = 'P0092';
  end if;

  return query
  with my_inv as (
    select i.* from v_user_album_inventory i
    where i.user_id = v_uid and i.album_id = p_album_id
  ),
  their_inv as (
    select i.* from v_user_album_inventory i
    where i.album_id = p_album_id and i.user_id <> v_uid
  ),
  they_give as (
    -- ellos pueden darme: yo missing, ellos tradable
    select ti.user_id as other_uid, ti.sticker_id, ti.sticker_number, ti.rarity
    from my_inv mi
    join their_inv ti on ti.sticker_id = mi.sticker_id
    where mi.missing = true and ti.tradable_stock > 0
  ),
  i_give as (
    -- yo puedo darles: ellos missing, yo tradable
    select ti.user_id as other_uid, ti.sticker_id, ti.sticker_number, ti.rarity
    from my_inv mi
    join their_inv ti on ti.sticker_id = mi.sticker_id
    where mi.tradable_stock > 0 and ti.missing = true
  ),
  pairs as (
    -- Producto por contraparte, pero numerado con el mismo criterio de orden
    -- que el resultado final. Después cortamos a 5 pares por contraparte.
    select
      tg.other_uid,
      tg.sticker_id     as tg_sticker_id,
      tg.sticker_number as tg_sticker_number,
      tg.rarity         as tg_rarity,
      ig.sticker_id     as ig_sticker_id,
      ig.sticker_number as ig_sticker_number,
      ig.rarity         as ig_rarity,
      row_number() over (
        partition by tg.other_uid
        order by
          case tg.rarity
            when 'legendary' then 1 when 'epic' then 2 when 'rare' then 3 else 4
          end,
          tg.sticker_number,
          ig.sticker_number
      ) as rn
    from they_give tg
    join i_give ig on ig.other_uid = tg.other_uid
  )
  select
    pr.other_uid,
    p.display_name,
    p.avatar_url,
    pr.tg_sticker_id, pr.tg_sticker_number, s_tg.name, pr.tg_rarity, s_tg.thumb_key,
    pr.ig_sticker_id, pr.ig_sticker_number, s_ig.name, pr.ig_rarity, s_ig.thumb_key
  from pairs pr
  join profiles p on p.id = pr.other_uid
  join stickers s_tg on s_tg.id = pr.tg_sticker_id
  join stickers s_ig on s_ig.id = pr.ig_sticker_id
  where pr.rn <= 5
  order by
    case pr.tg_rarity
      when 'legendary' then 1 when 'epic' then 2 when 'rare' then 3 else 4
    end,
    pr.tg_sticker_number
  limit p_limit;
end;
$$;

grant execute on function fn_album_matches(uuid, int) to authenticated;
