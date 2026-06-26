-- Mi Álbum de Figuritas — default del color de hoja pasa a 'white'
--
-- 0020 dejó 'paper' como default, pero ese color es el mismo cream del body
-- de la app (#FBF3E2), entonces no se distinguía la hoja del fondo. Cambiamos
-- el default a 'white' (blanco, contrasta con el body) y migramos las filas
-- existentes que tenían 'paper' por default (no por elección del owner).

alter table albums
  alter column page_bg_color set default 'white';

-- Las filas que quedaron con 'paper' venían del default anterior, no de una
-- elección consciente: las pisamos a 'white' para que se vea el contraste.
update albums set page_bg_color = 'white' where page_bg_color = 'paper';
