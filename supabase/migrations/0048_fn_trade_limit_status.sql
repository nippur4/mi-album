-- Mi Álbum de Figuritas — estado del límite de intercambio para el jugador
--
-- El jugador no tenía forma de conocer las reglas de trade del álbum
-- (enabled + trade_config.limit): las descubría al chocar con P0115/P0113.
-- Esta RPC expone, para el caller, todo lo necesario para mostrar las reglas
-- de forma proactiva y "cuántos cambios te quedan" en la ventana.
--
-- La ventana y el conteo espejan exactamente fn_trade_limit_reached (trades
-- 'accepted' donde el caller es parte, dentro de day/week/month). El límite se
-- chequea AL ACEPTAR, así que `remaining` = cuántos cambios más podés concretar.
--
-- Devuelve jsonb:
--   { enabled, unlimited: true }                              (sin tope)
--   { enabled, unlimited: false, count, period, used, remaining }

create or replace function fn_trade_limit_status(p_album_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_album albums;
  v_cfg jsonb;
  v_enabled boolean;
  v_limit jsonb;
  v_count int;
  v_period text;
  v_interval interval;
  v_used int;
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = 'P0010';
  end if;

  select * into v_album from albums where id = p_album_id;
  if not found then
    raise exception 'album_not_found' using errcode = 'P0002';
  end if;

  v_cfg := coalesce(v_album.trade_config, '{}'::jsonb);
  v_enabled := coalesce((v_cfg ->> 'enabled')::boolean, true);
  v_limit := v_cfg -> 'limit';

  if v_limit is null or v_limit = 'null'::jsonb then
    return jsonb_build_object('enabled', v_enabled, 'unlimited', true);
  end if;

  v_count := (v_limit ->> 'count')::int;
  v_period := v_limit ->> 'period';
  v_interval := case v_period
    when 'day'   then interval '1 day'
    when 'week'  then interval '7 days'
    when 'month' then interval '30 days'
    else interval '1 day'
  end;

  select count(*) into v_used
  from trade_offers
  where album_id = p_album_id
    and (from_user = v_uid or to_user = v_uid)
    and status = 'accepted'
    and resolved_at > now() - v_interval;

  return jsonb_build_object(
    'enabled', v_enabled,
    'unlimited', false,
    'count', v_count,
    'period', v_period,
    'used', v_used,
    'remaining', greatest(0, v_count - v_used)
  );
end;
$$;

grant execute on function fn_trade_limit_status(uuid) to authenticated;
