-- Mi Álbum de Figuritas — el margen del cooldown del sobre diario pasa de 2h a 3h
--
-- El sobre diario sigue siendo un cooldown RODANTE desde el último claim (la
-- alternativa de ventana fija se evaluó y se descartó en 0077). Lo único que
-- cambia acá es el margen: el cooldown EFECTIVO pasa de nominal − 2h a
-- nominal − 3h.
--
--   diario   24h nominales → 21h efectivas  (antes 22h)
--   semanal 168h nominales → 165h efectivas (antes 166h)
--
-- Motivo: más aire todavía para el jugador que entra "a la misma hora de ayer".
-- Los valores GUARDADOS en pack_config siguen siendo los nominales (24 / 168)
-- — la UI del owner no cambia.
--
-- Como en 0077: `_fn_daily_interval` es el helper único que usan las 4 funciones
-- que calculan disponibilidad (`fn_claim_daily_pack`, `fn_my_packs_tab_data`,
-- `fn_player_album_sidedata` y `_cron_notify_daily_available`). Lo llaman por
-- nombre, así que redefinirlo alcanza — no hay que tocar ninguna de las cuatro.
--
-- El `greatest(..., 1)` mantiene el piso de 1h: si algún día se configurara un
-- nominal de 1, 2 o 3 horas, el efectivo no puede quedar en 0 ni negativo (un
-- intervalo 0 haría que el sobre esté siempre disponible).
--
-- El QR mantiene su cooldown exacto, sin margen (es otro flujo).

create or replace function _fn_daily_interval(p_cooldown_hours int)
returns interval
language sql immutable as $$
  select make_interval(hours => greatest(coalesce(p_cooldown_hours, 24) - 3, 1));
$$;

-- `create or replace` conserva los privilegios, así que el revoke de 0040/0077
-- sigue en pie; lo repetimos igual para que la intención quede explícita.
revoke execute on function _fn_daily_interval(int) from public;
