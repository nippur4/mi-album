-- Mi Álbum de Figuritas — fn_enable_album_qr: activar QR con merge server-side
--
-- El cliente (enableQrForAlbum en lib/queries/qr.ts) hacía read-modify-write:
-- leía pack_config, mergeaba qr.enabled=true en JS y llamaba
-- fn_update_album_economy — 2 round trips y una carrera si el owner editaba
-- la economía en paralelo. Ahora el merge es atómico en el server.
--
-- Defaults de count/cooldown si el álbum nunca tuvo sección qr: espejan
-- DEFAULT_PACK_CONFIG.qr del cliente (count=3, cooldown_hours=24).
--
-- Los gates NO se duplican: delega en fn_update_album_economy, que ya valida
-- owner (fn_assert_owner), status draft/published (P0040), pro al habilitar
-- QR (P0020) y genera el qr_secret si falta.

create or replace function fn_enable_album_qr(p_album_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_album albums := fn_assert_owner(p_album_id);
  v_cfg jsonb := coalesce(v_album.pack_config, '{}'::jsonb);
  v_qr jsonb := coalesce(v_cfg -> 'qr', '{}'::jsonb);
begin
  if not v_qr ? 'count' then
    v_qr := v_qr || jsonb_build_object('count', 3);
  end if;
  if not v_qr ? 'cooldown_hours' then
    v_qr := v_qr || jsonb_build_object('cooldown_hours', 24);
  end if;
  v_qr := v_qr || jsonb_build_object('enabled', true);

  perform fn_update_album_economy(p_album_id, v_cfg || jsonb_build_object('qr', v_qr), null);
end;
$$;

grant execute on function fn_enable_album_qr(uuid) to authenticated;
