-- Mi Álbum de Figuritas — sobre extra por publicidad (rewarded ad)
--
-- Solo en los 3 álbumes especiales, con tope de 2 por día POR USUARIO
-- (global entre los 3, no por álbum). El cliente Android muestra el rewarded
-- ad y al completarse llama fn_claim_ad_pack — pero tope y elegibilidad se
-- validan ACÁ: llamar la RPC sin mirar el ad otorga como máximo los mismos
-- 2 sobres/día que mirándolo, así que no hay economía que romper.
--
-- El "día" corre en hora argentina (mismo criterio que fn_admin_stats).
-- Errores nuevos: P0210 ad_limit_reached · P0211 ad_not_available.

alter type pack_source add value if not exists 'ad';

-- Los 3 especiales (avatares, 0..1000, dinosaurios). Hardcodeados como en
-- fn_delete_album (excepciones administradas).
--   29a1fa90-85b3-48fc-b452-2b7f64bd327b  avatares
--   ecbf4497-e5d7-4732-88a2-75f7b39a2749  0..1000
--   d1227449-f10c-41e6-8483-5bef42b9fb0a  dinosaurios

create or replace function _fn_ad_albums()
returns uuid[]
language sql immutable as $$
  select array[
    '29a1fa90-85b3-48fc-b452-2b7f64bd327b',
    'ecbf4497-e5d7-4732-88a2-75f7b39a2749',
    'd1227449-f10c-41e6-8483-5bef42b9fb0a'
  ]::uuid[];
$$;

-- Cuántos sobres por ad reclamó el user HOY (hora argentina), global.
-- source::text (no ::pack_source): el valor 'ad' se agrega en ESTA transacción
-- y Postgres prohíbe referenciar un valor de enum nuevo antes del commit — la
-- validación del body de una función SQL lo haría explotar.
create or replace function _fn_ad_packs_today(p_user_id uuid)
returns int
language sql stable as $$
  select count(*)::int
    from packs
   where user_id = p_user_id
     and source::text = 'ad'
     and granted_at >= (date_trunc('day', now() at time zone 'America/Argentina/Buenos_Aires')
                        at time zone 'America/Argentina/Buenos_Aires');
$$;

create or replace function fn_ad_pack_status(p_album_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_used int;
begin
  if p_album_id <> all (_fn_ad_albums())
     or not exists (
       select 1 from user_album_membership
        where user_id = v_uid and album_id = p_album_id
     ) then
    return jsonb_build_object('enabled', false, 'used', 0, 'remaining', 0, 'limit', 2);
  end if;

  v_used := _fn_ad_packs_today(v_uid);
  return jsonb_build_object(
    'enabled', true,
    'used', v_used,
    'remaining', greatest(0, 2 - v_used),
    'limit', 2
  );
end;
$$;

create or replace function fn_claim_ad_pack(p_album_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_status album_status;
  v_used int;
begin
  if p_album_id <> all (_fn_ad_albums()) then
    raise exception 'ad_not_available' using errcode = 'P0211';
  end if;

  select status into v_status from albums where id = p_album_id;
  if v_status is distinct from 'published' then
    raise exception 'album_not_published' using errcode = 'P0082';
  end if;

  if not exists (
    select 1 from user_album_membership
     where user_id = v_uid and album_id = p_album_id
  ) then
    raise exception 'not_member' using errcode = 'P0092';
  end if;

  v_used := _fn_ad_packs_today(v_uid);
  if v_used >= 2 then
    raise exception 'ad_limit_reached' using errcode = 'P0210';
  end if;

  insert into packs (user_id, album_id, source)
  values (v_uid, p_album_id, 'ad');

  return jsonb_build_object('used', v_used + 1, 'remaining', 1 - v_used);
end;
$$;

grant execute on function fn_ad_pack_status(uuid) to authenticated;
grant execute on function fn_claim_ad_pack(uuid) to authenticated;
