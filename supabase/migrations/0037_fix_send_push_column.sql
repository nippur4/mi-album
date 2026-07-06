-- Mi Álbum de Figuritas — fix crítico de _send_push
--
-- Bug: `select push_token from profiles where user_id = ...` — profiles no
-- tiene columna user_id (su PK es id). plpgsql no valida el SQL al crear la
-- función, así que explotaba EN RUNTIME (42703) y abortaba la transacción
-- del caller. Rotos desde 0027: fn_join_album (unirse a un álbum),
-- fn_create_trade_offer, fn_resolve_trade_offer y el cron del sobre diario.
--
-- Fix triple:
--   1. _send_push: where id = p_user_id (columna correcta).
--   2. _send_push con exception handler: el push es best-effort y NUNCA
--      puede voltear la transacción de negocio que lo dispara.
--   3. fn_register_push_token tenía el MISMO bug (update ... where user_id):
--      ningún token se guardó nunca. Corregido a where id = auth.uid().

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
  select push_token into v_token from profiles where id = p_user_id;
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
exception when others then
  -- Best-effort: si el push falla por lo que sea (columna, pg_net caído,
  -- token inválido), la transacción del caller sigue intacta.
  null;
end;
$$;

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
   where id = v_uid;
end;
$$;

grant execute on function fn_register_push_token(text) to authenticated;
