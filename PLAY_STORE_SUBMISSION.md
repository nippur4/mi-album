# Play Store — Planilla de envío (prueba cerrada)

App: **Mi Álbum de Figuritas** · package `mi.album.figuritas`
Público: **13+ (no dirigido a niños)** · Contacto público: **nuestra.caja.app@gmail.com**
Política de privacidad: **https://mi-album.pages.dev/privacy**

> Marcá cada sección al completarla en Play Console. Los textos están listos para copiar-pegar.

---

## 1. Ficha de Play Store (Store listing)

**Nombre de la app** (máx. 30):
```
Mi Álbum de Figuritas
```

**Descripción corta** (máx. 80):
```
Coleccioná figuritas digitales: abrí sobres, completá álbumes e intercambiá.
```

**Descripción larga** (máx. 4000):
```
Mi Álbum de Figuritas es la forma más divertida de coleccionar, completar e intercambiar álbumes de figuritas… ¡sin papel y sin repetidas que se pierden en un cajón!

Uníte a un álbum con un código, abrí sobres y viví la emoción de descubrir qué figuritas te tocaron, con animaciones y sonidos en cada apertura. Pegá tus figuritas en la grilla, seguí tu progreso y completá la colección.

QUÉ PODÉS HACER
• Abrí sobres con animación y descubrí figuritas comunes, raras, épicas y legendarias.
• Completá tu álbum pegando figuritas en hojas personalizadas.
• Intercambiá repetidas con otros jugadores para completar más rápido.
• Reclamá tu sobre diario y sumá figuritas todos los días.
• Escaneá códigos QR para conseguir sobres especiales.
• Desbloqueá avatares completando figuritas.

CREÁ TUS PROPIOS ÁLBUMES
¿Querés armar tu propio álbum? Subí tus imágenes, definí las figuritas, personalizá las hojas y compartí el código con tus amigos para que jueguen con vos.

INTERCAMBIÁ CON AMIGOS
Encontrá coincidencias entre tus repetidas y las que le faltan a otros jugadores, proponé cambios y completá la colección entre todos.

Descargá Mi Álbum de Figuritas y empezá tu colección hoy.
```

**Categoría de la aplicación:**
- Si la app está registrada como **Aplicación** → categoría **Entretenimiento**.
- Si está registrada como **Juego** → categoría **Casual** (o **Cartas**).
  *(Esto se definió al crear la app; usá la que corresponda.)*

**Etiquetas / Tags:** figuritas, álbum, coleccionar, intercambio, stickers.

**Datos de contacto:**
- Email: `nuestra.caja.app@gmail.com`
- Sitio web (opcional): `https://mi-album.pages.dev`

**Recursos gráficos** (los tenés que crear vos — no puedo generarlos):
- [ ] **Ícono** 512×512 PNG (32-bit, con alfa). Ya tenés el ícono de la app; exportá a 512.
- [ ] **Gráfico destacado (feature graphic)** 1024×500 PNG/JPG — **obligatorio**.
- [ ] **Capturas de teléfono**: mínimo **2**, recomendado 4–8. 16:9 o 9:16, lados entre 320 y 3840 px.
- [ ] Capturas de tablet: opcionales (la app es `supportsTablet: false`, podés omitir).

---

## 2. Seguridad de los datos (Data safety)

**Preguntas iniciales:**
- ¿Recopila o comparte datos de usuario? → **Sí**
- ¿Los datos están cifrados en tránsito? → **Sí**
- ¿Ofrecés forma de solicitar la eliminación de datos? → **Sí** → URL de eliminación de cuenta: `https://mi-album.pages.dev/delete-account`
  *(Página dedicada. Además la app tiene borrado in-app en Perfil → “Eliminar cuenta”.)*

**Tipos de datos a declarar** (todos: Recopilado = Sí, No efímero, Requerido):

| Tipo de dato | ¿Compartido? | Propósito |
|---|---|---|
| Dirección de correo electrónico | No | Gestión de la cuenta, comunicaciones |
| Nombre (nombre para mostrar) | No | Gestión de la cuenta |
| ID de usuario (ID de cuenta interno) | No | Gestión de la cuenta, Funcionalidad |
| Fotos (imágenes de álbum que sube el creador) | No | Funcionalidad de la app |
| Acciones dentro de la app / contenido generado | No | Funcionalidad de la app |
| ID de dispositivo o de otro tipo (ID de publicidad) | **Sí** | **Publicidad o marketing**, Funcionalidad |
| Historial de compras* | No | Funcionalidad, Gestión de la cuenta |

\* *Historial de compras: declararlo recién cuando actives la suscripción Pro. Sin pagos activos, omitilo (el formulario se puede editar cuando quieras).*

**NO marcar:** ubicación (precisa o aproximada), contactos, mensajes, calendario, datos de salud/estado físico, información financiera (más allá de compras), archivos/documentos.

---

## 3. Clasificación de contenido (Content rating — cuestionario IARC)

Email de contacto: `nuestra.caja.app@gmail.com`.
Categoría del cuestionario: **“El resto de los tipos de app”** (producto de entretenimiento; NO "Juego" — evita preguntas de azar/loot boxes que no aplican; NO "Social o de comunicación"). Respuestas de contenido:

- Violencia (realista o de fantasía): **No**
- Contenido sexual / desnudez: **No**
- Lenguaje soez / vulgar: **No**
- Sustancias controladas (drogas, alcohol, tabaco): **No**
- Juegos de azar (simulado o con dinero real): **No**
- Miedo / terror: **No**
- **¿Los usuarios pueden interactuar o intercambiar contenido / comunicarse entre sí?** → **Sí**
  *(hay intercambios y álbumes compartidos; se comparte nombre para mostrar y avatar. No hay chat de texto libre.)*
- ¿La app comparte la ubicación física del usuario con otros? → **No**
- ¿Permite comprar bienes digitales? → **Sí** (por la suscripción Pro; si aún no está activa, respondé según el estado real).
- ¿Es un navegador web o buscador? → **No**

Resultado esperado: apta para todo público / adolescentes, sin restricciones.

---

## 4. Contenido de la app (App content)

- [ ] **Política de privacidad**: `https://mi-album.pages.dev/privacy`
- [ ] **Anuncios**: **Sí, la app contiene anuncios** (AdMob).
- [ ] **Público objetivo y contenido**: seleccioná grupos de edad **13-15, 16-17, y 18 y más**. NO incluyas “menores de 13” (evita la Política para Familias).
  - ¿La app atrae a niños? → **No**.
- [ ] **Acceso a la app (App access)**: ⚠️ ver nota abajo.
- [ ] **App gratuita/de pago**: Gratuita (con compras dentro de la app cuando esté Pro).
- [ ] Declaraciones que van en **No**: apps gubernamentales, funciones financieras, salud, contenido para adultos, préstamos, COVID-19, seguimiento familiar.
- [ ] **Data safety**: (ver sección 2).

### Acceso para el revisor (App access) — respuesta: **Sí, está restringida**
La opción "No" no aplica (la app requiere cuenta). Elegí **Sí**. Los detalles van **en inglés**.

**Cuenta demo = Yahoo + magic link** (NO usar la cuenta owner de Play). Cuenta: `miapp.beta@yahoo.com`.

- **Nombre:** `General access`
- **Usuario/email:** `miapp.beta@yahoo.com`
- **Contraseña:** la contraseña de la cuenta de Yahoo (para que el revisor entre al inbox y saque el link).
- **Instrucciones — campo "cualquier otra información" (máx. 500, pegar en inglés):**
```
This app uses passwordless email sign-in (magic link).

1. On the login screen, enter miapp.beta@yahoo.com and tap "Enviarme el link".
2. Open https://mail.yahoo.com and sign in with the username and password above.
3. Open the email from "Mi Álbum de Figuritas" and tap the sign-in link. It opens the app and logs you in.

Do NOT use "Continuar con Google". If the email is missing, check the Spam folder.
```

**Preparación antes de guardar:**
1. Desactivar **verificación en 2 pasos** en la cuenta de Yahoo (si no, el revisor no entra al webmail).
2. **Probar el flujo completo** con el build 1.2.0: email en la app → mail.yahoo.com → clic al link → abre la app y loguea.
3. Marcar el mail como "no es spam" en Yahoo si cae ahí.

---

## 5. Release en la pista de prueba cerrada

- [ ] Subí el `.aab`: `client/builds/mi-album-1.2.0-e18c7657.aab` (versión 1.2.0, versionCode 7).
- [ ] Notas de la versión (release notes), ej:
```
- Podés eliminar tu cuenta desde Perfil.
- Enlace a la Política de Privacidad.
- Mejoras y correcciones.
```
- [ ] Confirmá la lista de testers / Google Group.

---

## Checklist rápido

- [ ] Ficha completa (textos + ícono 512 + feature graphic 1024×500 + 2+ capturas)
- [ ] Data safety enviado
- [ ] Clasificación de contenido enviada
- [ ] App content: privacidad, anuncios, público objetivo, (App access queda para producción)
- [ ] `.aab` 1.2.0 subido a la pista cerrada
- [ ] Probar borrado de cuenta con mail de descarte
