-- Mi Álbum de Figuritas — limpieza del historial de pg_cron
--
-- pg_cron registra CADA corrida en cron.job_run_details y nunca borra nada.
-- Con notify-daily-available cada 15 min + 2 jobs por hora son ~40k filas
-- por año de storage muerto. Job diario que conserva 7 días de historial
-- (suficiente para debuggear un job que falle).
--
-- cron.schedule con el mismo `name` sobrescribe si ya existe (idempotente).

select cron.schedule(
  'cleanup-cron-history',
  '30 3 * * *',
  $$ delete from cron.job_run_details where end_time < now() - interval '7 days' $$
);
