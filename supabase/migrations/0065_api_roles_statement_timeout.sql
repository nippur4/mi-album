-- Mi Álbum de Figuritas — statement_timeout por rol de API (defensa DoS)
--
-- La anon key es PÚBLICA (va en el bundle de la app). RLS protege la
-- confidencialidad e integridad de los datos, pero NO el consumo de recursos:
-- cualquiera puede martillar la Data API con lecturas/RPCs. Un statement_timeout
-- por rol impide que una query armada a mano (o un bug) acapare una conexión
-- del pooler indefinidamente — corta sola pasado el límite.
--
-- Método oficial de Supabase (aplica a PostgREST, que asume estos roles):
--   alter role <rol> set statement_timeout = '<n>s'; + notify pgrst reload.
--
-- Valores:
--   anon (sin login): solo lee álbumes públicos + profiles → 5s de sobra.
--   authenticated: la lectura legítima más pesada es la grilla de 1001
--     figuritas (indexada, <1s). 12s deja margen para RPCs admin
--     (fn_admin_stats escanea audit_log) sin volverlas frágiles.
--
-- OJO: si el proyecto ya tuviera defaults MÁS estrictos que estos (Supabase a
-- veces setea anon=3s / authenticated=8s), conservá los más bajos — este
-- archivo documenta el piso de protección deseado, no busca aflojarlo.

alter role anon set statement_timeout = '5s';
alter role authenticated set statement_timeout = '12s';

notify pgrst, 'reload config';
