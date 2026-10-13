-- Mi Álbum de Figuritas — en las ofertas, saber si la figurita que RECIBÍS ya la tenés
--
-- Problema de UX: en el tab Cambios la card de oferta muestra "RECIBÍS / DAS"
-- sin decir si esa figurita ya está en tu colección. Pasa seguido:
--   * con `accept_owned = true` (membership) el server PERMITE ofrecerte algo
--     que ya tenés — el gate P0184 de `fn_create_trade_offer` queda abierto;
--   * y en cualquier caso una oferta pending envejece: la conseguiste por un
--     sobre o por otro cambio DESPUÉS de que te la ofrecieran.
-- En Enviadas sirve igual: te avisa que tu propia oferta quedó al vacío (ya
-- tenés lo que pediste) y conviene cancelarla.
--
-- Decisión: va en `fn_my_offer_flags()` y NO en una query nueva del cliente.
-- `useMyOffers` ya la llama en el mismo `Promise.all` que las ofertas, así que
-- esto suma CERO round trips. Alternativa descartada: un `.in(sticker_id)` a
-- `user_collection` desde el cliente (una query más por refetch, cada 15s de
-- staleTime, para datos que el server ya tiene a mano).
--
-- `incoming_qty` = copias que el caller tiene de la figurita que recibiría
-- (0 = le falta). `user_collection` nunca guarda quantity=0 (invariante #3 de
-- 0001) → el `left join` + `coalesce` alcanza, ausencia de fila = no la tiene.
-- Cuál es "la que recibe" depende del lado: si el caller es `to_user` recibe la
-- `offered`; si es `from_user`, la `requested`.
--
-- El scope se mantiene en las PENDING (como ya hacía la función): en una
-- aceptada el flag es obvio (la acabás de recibir) y en una rechazada/cancelada
-- es ruido.
--
-- security definer: ya lo era por `fn_trade_limit_reached` (revocada de public).
-- El join a `user_collection` bypasea RLS, pero está anclado a `auth.uid()`, así
-- que nadie ve colección ajena.

-- El tipo de retorno cambia (columna nueva) y eso `create or replace` no lo
-- permite → drop + create. Es la ÚNICA caller-facing: solo la usa useMyOffers.
drop function if exists fn_my_offer_flags();

create function fn_my_offer_flags()
returns table (offer_id uuid, sender_blocked boolean, incoming_qty int)
language sql stable security definer set search_path = public as $$
  select o.id,
         fn_trade_limit_reached(o.album_id, o.from_user, a.trade_config),
         coalesce(uc.quantity, 0)::int
    from trade_offers o
    join albums a on a.id = o.album_id
    left join user_collection uc
           on uc.user_id = auth.uid()
          and uc.sticker_id = case
                when o.to_user = auth.uid() then o.offered_sticker_id
                else o.requested_sticker_id
              end
   where o.status = 'pending'
     and (o.from_user = auth.uid() or o.to_user = auth.uid());
$$;

grant execute on function fn_my_offer_flags() to authenticated;

-- El drop+create cambia la firma que PostgREST tiene cacheada: sin reload, el
-- `rpc('fn_my_offer_flags')` puede seguir devolviendo el shape viejo (sin la
-- columna) hasta que el cache rote solo. Lección de 0066/0067: 'reload schema',
-- NO 'reload config'.
notify pgrst, 'reload schema';
