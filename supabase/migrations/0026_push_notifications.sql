-- Mi Álbum de Figuritas — infraestructura de push notifications
--
-- Flujo general:
--   1. Cliente pide permisos de notif y obtiene un ExpoPushToken (String
--      empezando con "ExponentPushToken[...]"). Lo persiste vía la RPC
--      `fn_register_push_token` en `profiles.push_token`.
--
--   2. Cuando ocurre un evento notificable (nuevo trade, respuesta, join,
--      sobre diario listo), el backend llama al helper interno `_send_push`
--      con el user_id destinatario + título/cuerpo/data.
--
--   3. `_send_push` lee el push_token de profiles y hace POST async a la
--      API de Expo (https://exp.host/--/api/v2/push/send) vía `pg_net`.
--      Es fire-and-forget: no bloquea la transacción del caller. Si el user
--      no tiene push_token, no hace nada (silencioso).
--
--   4. Expo Push Service enrutan la notif a APNs/FCM y llega al device.
--
-- Nota: pg_net es una extensión de Supabase Cloud. Habilitarla es
-- requisito operativo (Dashboard → Database → Extensions → habilitar pg_net).

-- =========================================================================
-- 1) Habilitar pg_net (si aún no lo está)
-- =========================================================================

create extension if not exists pg_net with schema extensions;

-- =========================================================================
-- 2) Tracking de "ya notifiqué del sobre diario" por membership
-- =========================================================================

alter table user_album_membership
  add column if not exists daily_notified_at timestamptz;

-- Al claim, resetear la marca para que la próxima ventana pueda notificar.
-- Lo hacemos en un trigger en vez de tocar fn_claim_daily_pack para no
-- acoplar el sistema de notifs a la RPC principal.
create or replace function _tg_reset_daily_notified()
returns trigger language plpgsql as $$
begin
  if new.last_daily_claim_at is distinct from old.last_daily_claim_at then
    new.daily_notified_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists tg_reset_daily_notified on user_album_membership;
create trigger tg_reset_daily_notified
  before update on user_album_membership
  for each row execute function _tg_reset_daily_notified();

-- =========================================================================
-- 3) RPC pública para que el cliente registre / actualice su token
-- =========================================================================

-- Idempotente: guarda el token del user actual. Si el token cambió (device
-- reinstalado, etc.), sobrescribe. Si el user borra permisos, el cliente
-- puede llamar con p_token=NULL para limpiar.
create or replace function fn_register_push_token(p_token text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = 'P0010';
  end if;

  update profiles
     set push_token = p_token
   where user_id = v_uid;
end;
$$;

grant execute on function fn_register_push_token(text) to authenticated;

-- =========================================================================
-- 4) Helper interno: enviar push a un user por su ID
-- =========================================================================

-- Fire-and-forget. Si el user no tiene push_token, silenciosamente no hace
-- nada — así los callers pueden invocar sin preocuparse por membership.
-- `p_data` sirve para deep-linking desde el tap: ej. {"kind":"trade","offer_id":"..."}.
create or replace function _send_push(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_data jsonb default '{}'::jsonb
) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_token text;
begin
  select push_token into v_token from profiles where user_id = p_user_id;
  if v_token is null or v_token = '' then
    return;
  end if;

  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := jsonb_build_object(
      'to', v_token,
      'title', p_title,
      'body', p_body,
      'sound', 'default',
      'data', coalesce(p_data, '{}'::jsonb)
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Accept', 'application/json'
    )
  );
end;
$$;
