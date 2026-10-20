-- Mi Álbum de Figuritas — el owner free elige cuál de sus álbumes queda activo
--
-- CONTEXTO: al vencer el Pro, `fn_enforce_subscription_gates` conserva el
-- álbum publicado MÁS VIEJO y manda el resto a `read_only`. La regla en sí es
-- correcta (bajo free solo se puede tener 1 álbum activo), pero el criterio
-- "el más viejo" lo elige el sistema, de forma asincrónica, por un webhook,
-- cuando el owner ni siquiera está mirando. Para él es inexplicable: sus
-- álbumes se pausaron solos y no eligió cuál.
--
-- Pedido por Nico el 2026-10-20: "lo ideal sería que el dueño elija, porque si
-- no quizás no se entiende qué pasó".
--
-- QUÉ HACE: deja intacta la elección automática (tiene que haber un default,
-- la bajada ocurre sin nadie presente) pero la vuelve REVERSIBLE. El owner
-- free puede mover cuál es su álbum activo cuantas veces quiera.
--
-- REGLAS:
--   - Solo el owner, y solo si NO es Pro. Siendo Pro no hay nada que elegir:
--     todos los álbumes pueden estar activos a la vez.
--   - El destino tiene que tener `retired_at` null. Lo que el owner cerró a
--     mano queda cerrado y se reactiva con fn_unarchive_album_by_owner — misma
--     distinción que arregló la 0080.
--   - Los drafts no se tocan: no son "activos" en el sentido de publicados, y
--     la bajada tampoco los toca.
--
-- DIFERENCIA DELIBERADA CON LA BAJADA: este swap **no cancela las ofertas
-- pending** de los álbumes que pausa, mientras que `fn_enforce_subscription_gates`
-- sí lo hace. La bajada es una transición única hacia un estado restringido y
-- conviene que limpie; el swap es navegación DENTRO de ese estado y es
-- reversible, así que cancelar castigaría al que prueba "a ver cómo queda si
-- activo el otro" borrándole intercambios para siempre. Las ofertas de un
-- álbum pausado quedan inertes igual: aceptar exige status 'published'.

create or replace function fn_set_free_active_album(p_album_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_album albums := fn_assert_owner(p_album_id);
begin
  if fn_is_pro(v_album.owner_id) then
    raise exception 'pro_has_no_album_limit' using errcode = 'P0021';
  end if;

  if v_album.retired_at is not null then
    raise exception 'album_retired' using errcode = 'P0022';
  end if;

  if v_album.status not in ('read_only', 'published') then
    raise exception 'album_not_switchable' using errcode = 'P0023';
  end if;

  -- Pausar los otros activos. Solo los publicados sin retired_at: los que el
  -- owner cerró y los drafts quedan como están.
  update albums
     set status = 'read_only'
   where owner_id = v_album.owner_id
     and id <> v_album.id
     and status = 'published'
     and retired_at is null;

  -- Activar el elegido. No-op si ya estaba publicado (el owner puede tocar el
  -- que ya está activo desde la UI sin que pase nada raro).
  update albums
     set status = 'published'
   where id = v_album.id
     and status = 'read_only';
end;
$$;

grant execute on function fn_set_free_active_album(uuid) to authenticated;
