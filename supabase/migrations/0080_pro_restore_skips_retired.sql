-- Mi Álbum de Figuritas — volver a Pro ya no "desretira" los álbumes cerrados
--
-- BUG: la rama de upgrade de `fn_enforce_subscription_gates` (0007) hacía
--
--     update albums set status = 'published'
--      where owner_id = p_owner_id and status = 'read_only';
--
-- sin distinguir POR QUÉ el álbum está en read_only. Y `read_only` significa
-- dos cosas distintas en el modelo:
--
--   (a) Baja de Pro          → read_only, SIN retired_at   (lo pone 0007 acá abajo)
--   (b) El owner lo cerró    → read_only + owner_hidden + retired_at
--                              (`fn_delete_album` con jugadores adentro: 0046/0047,
--                               0058, y el borrado de cuenta de 0070)
--
-- Solo (a) debe reactivarse al volver a Pro. Con (b) el update reabría un álbum
-- que el dueño había cerrado a propósito: quedaba `published` con `retired_at`
-- todavía seteado y `owner_hidden = true` (estado mitad y mitad), y como todos
-- los gates de join / sobre diario / QR / trades miran `status = 'published'`,
-- los jugadores podían volver a entrar sin que el owner hiciera nada.
--
-- Alcance real: `fn_subscription_upsert` llama a esta función en TODOS los
-- eventos de RevenueCat, incluido RENEWAL — así que le pasaba a cualquier owner
-- Pro con un álbum cerrado, en cada renovación mensual. Hasta hoy quedó latente
-- porque todavía no hay suscriptores reales (los pagos no están activos).
--
-- FIX: filtrar por `retired_at is null`. Es el discriminador exacto — las únicas
-- dos fuentes de read_only en todo el esquema son las dos de arriba, y solo la
-- del owner marca retired_at. Esto es lo que el comentario de 0047 ya daba por
-- hecho cuando hablaba de `_fn_restore_pro_albums`: esa función nunca existió,
-- la lógica siempre vivió inline acá.
--
-- NO se usa `owner_hidden = false` como condición extra: archivar (0025) setea
-- owner_hidden SIN tocar el status, así que un álbum archivado que además cayó
-- en read_only por una baja de Pro sí tiene que volver a published.
--
-- Tampoco se hace backfill de los álbumes retirados en la ventana 0046→0047
-- (0046 no seteaba retired_at). Distinguirlos hoy de un "archivado + baja de
-- Pro" no es posible sin adivinar, y la ventana entre ambas migraciones fue de
-- la misma sesión.
--
-- La rama free (abajo) no necesita cambios: filtra por `status = 'published'` y
-- los retirados ya están en read_only, así que nunca los tocó.
--
-- Firma y tipo de retorno idénticos → `create or replace` alcanza (no hace falta
-- drop + re-grant ni recargar el schema cache de PostgREST: la función está
-- revocada de public y nadie la llama por la API).

create or replace function fn_enforce_subscription_gates(p_owner_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_is_pro boolean;
  v_first_published uuid;
begin
  v_is_pro := fn_is_pro(p_owner_id);

  if v_is_pro then
    -- Pro restaurado: vuelven a published SOLO los que quedaron read_only por la
    -- baja de la suscripción. Los que el owner cerró (retired_at) se respetan —
    -- esos se reactivan a mano con fn_unarchive_album_by_owner (0047).
    update albums
      set status = 'published'
      where owner_id = p_owner_id
        and status = 'read_only'
        and retired_at is null;
    return;
  end if;

  -- Free: conservar el published más viejo.
  select id into v_first_published
    from albums
    where owner_id = p_owner_id and status = 'published'
    order by published_at asc nulls last, created_at asc
    limit 1;

  if v_first_published is null then
    return; -- no hay published, nada que pausar
  end if;

  -- Cancelar trades pending de los álbumes que están por entrar en read_only.
  -- (Importante: este UPDATE corre ANTES del UPDATE de albums; sino el filtro
  -- por status='published' no los encontraría.)
  update trade_offers
    set status = 'cancelled', resolved_at = now()
    where status = 'pending'
      and album_id in (
        select id from albums
        where owner_id = p_owner_id
          and status = 'published'
          and id <> v_first_published
      );

  update albums
    set status = 'read_only'
    where owner_id = p_owner_id
      and status = 'published'
      and id <> v_first_published;
end;
$$;

-- `create or replace` conserva los privilegios, así que el revoke de 0007 sigue
-- en pie; lo repetimos igual para que la intención quede explícita.
revoke execute on function fn_enforce_subscription_gates(uuid) from public;
