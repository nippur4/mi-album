-- Mi Álbum de Figuritas — el margen del cooldown del sobre diario pasa de 1h a 2h
--
-- El sobre diario sigue siendo un cooldown RODANTE desde el último claim (la
-- alternativa de ventana fija se evaluó y se descartó). Lo único que cambia
-- acá es el margen: el cooldown EFECTIVO pasa de nominal − 1h a nominal − 2h.
--
--   diario   24h nominales → 22h efectivas  (antes 23h)
--   semanal 168h nominales → 166h efectivas (antes 167h)
--
-- Motivo: con 23h el jugador que entra "a la misma hora de ayer" igual podía
-- quedar corto por un rato (el claim de ayer fue 1h más tarde que el de
-- anteayer, y así se corre). Con 2h hay más aire y el sobre está listo cuando
-- vuelve. Los valores GUARDADOS en pack_config siguen siendo los nominales
-- (24 / 168) — la UI del owner no cambia.
--
-- Una sola función: `_fn_daily_interval` es el helper único que usan las 4
-- funciones que calculan disponibilidad (`fn_claim_daily_pack`,
-- `fn_my_packs_tab_data`, `fn_player_album_sidedata` y
-- `_cron_notify_daily_available`). Lo llaman por nombre, así que redefinirlo
-- alcanza — no hay que tocar ninguna de las cuatro. Ese era justamente el
-- punto de haberlo extraído en 0040.
--
-- El `greatest(..., 1)` mantiene el piso de 1h: si algún día se configurara un
-- nominal de 1 o 2 horas, el efectivo no puede quedar en 0 ni negativo (un
-- intervalo 0 haría que el sobre esté siempre disponible).
--
-- El QR mantiene su cooldown exacto, sin margen (es otro flujo).

create or replace function _fn_daily_interval(p_cooldown_hours int)
returns interval
language sql immutable as $$
  select make_interval(hours => greatest(coalesce(p_cooldown_hours, 24) - 2, 1));
$$;

-- `create or replace` conserva los privilegios, así que el revoke de 0040 sigue
-- en pie; lo repetimos igual para que la intención quede explícita en el archivo.
revoke execute on function _fn_daily_interval(int) from public;

-- ============================================================================
-- Limpieza: fn_my_daily_status (0012) — muerta y desincronizada
-- ============================================================================
--
-- Quedó sin callers cuando los bundles (`fn_my_packs_tab_data` y
-- `fn_player_album_sidedata`) absorbieron el estado del daily; hoy solo aparece
-- en los tipos generados del cliente.
--
-- Peor que muerta: calcula el próximo sobre con el nominal CRUDO
-- (`make_interval(hours => cooldown_hours)`), sin pasar por `_fn_daily_interval`
-- — nunca se le aplicó el margen de 0040. Está granteada a `authenticated`, así
-- que es llamable desde la API pública y devolvería un horario que no es el que
-- el server realmente usa para habilitar el claim. Dos verdades sobre lo mismo.
drop function if exists fn_my_daily_status(uuid[]);
