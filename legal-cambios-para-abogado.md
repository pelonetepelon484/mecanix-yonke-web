# Cambios legales propuestos — flujo de solicitud de piezas (taller → yonkes)

**Fecha de este borrador:** 7 de octubre de 2026
**Estado:** borrador para tu revisión. Todavía no se ha publicado ni se ha mostrado a ningún usuario. El flujo que describe (pedido de piezas) tampoco está construido todavía; estos textos se redactan por adelantado para que la parte legal esté lista cuando se construya.

## El flujo nuevo, en una frase

El taller indica los datos de un vehículo y la pieza que busca. Mecanix avisa a los yonkes que podrían tenerla (por WhatsApp u otros medios). El primer yonke que confirma que la tiene queda asignado a esa solicitud. La entrega y el pago se acuerdan directamente entre el taller y ese yonke; Mecanix no interviene.

## Resumen de cada cambio, en español sencillo

1. **Nueva cláusula 1.9 en "Términos para Talleres"** (dentro de `/terminos`, sección de talleres): explica el flujo completo desde el lado del taller — qué datos se comparten con los yonkes (nombre del taller, WhatsApp, ciudad, y los datos del vehículo/pieza), que **nunca se comparten los datos del cliente final del taller**, que Mecanix es solo un intermediario tecnológico, que no garantiza que algún yonke tenga la pieza ni su precio/estado/disponibilidad, y que la entrega, el pago y la garantía se acuerdan entre taller y yonke.

2. **Ajuste a la cláusula 1.2** (quién es responsable de los datos del taller): antes decía que esos datos no se comparten con yonkes "salvo con proveedores técnicos o por obligación legal". Le agregamos una tercera excepción: cuando el propio taller pide una pieza a los yonkes (remite a la 1.9), aclarando que eso nunca incluye datos del cliente del taller.

3. **Nueva cláusula 2.6 en el Aviso de Privacidad para talleres** (dentro de `/privacidad`, sección de talleres): la misma idea, desde el lado de protección de datos — qué se comparte con los yonkes, para qué, y que nunca incluye datos personales del cliente del taller.

4. **Ajuste a la cláusula 2.3** (con quién se comparten los datos de las cotizaciones): antes decía "no se comparten con yonkes, con otros talleres ni con terceros" de forma absoluta. Le agregamos la salvedad de la 2.6, para que no contradiga el punto anterior.

5. **Nueva sección general 21 en `/terminos`** ("Solicitudes de piezas de talleres"), dirigida esta vez a los **yonkes**: les avisa que pueden recibir estas solicitudes, que solo pueden usar esos datos para atender la solicitud, y que ellos son responsables de que su respuesta (confirmar que tienen la pieza) sea verdadera. Esto corrió un lugar las dos secciones que seguían: "Términos para Talleres" pasó de ser la sección 21 a la 22, y "Contacto" de la 22 a la 23.

6. **Nueva sección general 12 en `/privacidad`** ("Solicitudes de piezas de talleres"), con el mismo contenido para privacidad. "Talleres y cotizaciones" pasó de la sección 12 a la 13, y "Contacto" de la 13 a la 14.

7. **Menciones menores agregadas** para que el texto general no ignore a los talleres:
   - Sección 2 de `/terminos` ("Descripción del servicio"): ahora dice que la plataforma también permite a talleres solicitar piezas a los yonkes.
   - Sección 15 de `/terminos` ("Contenido prohibido"): ahora también prohíbe registrar negocios que no sean yonkes **o talleres**, y agrega que no se pueden enviar solicitudes de piezas falsas o sin intención real de contratar.
   - Sección 1 de `/privacidad` ("Responsable del tratamiento"): misma mención de que la plataforma permite a talleres solicitar piezas a los yonkes.
   - Sección 5 de `/privacidad` ("Con quién compartimos tus datos"): una frase que remite a la nueva sección 12, para que quede claro que ese flujo también está ahí documentado.

8. **Versión y fecha:**
   - `textosLegalesTalleres.json` sube de versión `talleres-2026-10-1` (6 de octubre) a `talleres-2026-10-2` (7 de octubre de 2026).
   - La fecha de "Última actualización" de `/terminos` y `/privacidad`, y la variable interna `VERSION_LEGAL`, se mueven del 26 de septiembre al 7 de octubre de 2026.
   - El texto del aviso de cambios que verá un taller al volver a aceptar ("resumenCambios") se actualizó para mencionar también este flujo nuevo, además de lo que ya mencionaba (quién es responsable de los datos del cliente, los 90 días, el aviso de privacidad que debe entregar).

**Nada de lo ya aprobado se tocó:** la retención de 90 días de las cotizaciones, que el taller es responsable de los datos de sus clientes y atiende las solicitudes ARCO, el mecanismo de aviso de cambios con reaceptación obligatoria para talleres, y la plantilla de aviso de privacidad que el taller entrega a sus propios clientes (esa plantilla no cambia: como no se comparten datos del cliente con los yonkes, no hay nada que agregarle).

---

## Texto completo y exacto de cada bloque nuevo o modificado

### 1.9 — Términos para Talleres (`/terminos#talleres`)

> **1.9 Solicitudes de piezas a yonkes**
>
> El Taller puede solicitar en la Plataforma una pieza, indicando los datos del vehículo (marca, modelo y año) y la pieza buscada. Mecanix notifica la solicitud a los yonkes registrados que podrían tenerla, por WhatsApp u otros medios, compartiendo con ellos los datos del Taller (nombre, WhatsApp y ciudad) y los datos del vehículo y la pieza solicitados, sin incluir datos personales del Cliente del Taller. El primer yonke que confirme a Mecanix que tiene la pieza queda asignado a esa solicitud.
>
> Respecto de esta función, Mecanix actúa únicamente como intermediario tecnológico: no vende piezas, no interviene en la negociación y no garantiza que algún yonke tenga la pieza, su estado, su precio ni su disponibilidad. La entrega, el pago y cualquier garantía de la pieza se acuerdan directamente entre el Taller y el yonke asignado; Mecanix no es parte de ese acuerdo ni responde por su cumplimiento.

### 1.2 — Términos para Talleres, texto completo con el cambio (la parte nueva está en cursiva aquí, en el sitio va corrido igual que el resto)

> El Taller es el responsable del tratamiento de los datos personales de sus Clientes que capture en la Plataforma, y decide para qué y cómo se usan. Mecanix actúa únicamente como proveedor del servicio de almacenamiento de esos datos, por petición e instrucción del Taller. Mecanix no usa esos datos para fines propios y no los comparte con yonkes, con otros talleres ni con terceros, salvo con los proveedores de infraestructura tecnológica necesarios para prestar el servicio, cuando una obligación legal lo exija, *o cuando el propio Taller solicita una pieza a los yonkes conforme a la cláusula 1.9, sin incluir en ese caso datos personales del Cliente del Taller.*

### 2.6 — Aviso de Privacidad para Talleres (`/privacidad#talleres`)

> **2.6 Solicitudes de piezas a yonkes**
>
> Cuando el Taller solicita una pieza, Mecanix comparte con los yonkes que reciben la solicitud los datos del Taller (nombre, WhatsApp y ciudad) y los datos del vehículo y la pieza solicitados, con la única finalidad de que puedan confirmar si la tienen y atender la solicitud. Mecanix no comparte con esos yonkes datos personales del Cliente del Taller.

### 2.3 — Aviso de Privacidad para Talleres, texto completo con el cambio

> Los datos de las cotizaciones solo son visibles para el Taller que los capturó y para el administrador de Mecanix. No se comparten con yonkes, con otros talleres ni con terceros, *salvo cuando el Taller solicita una pieza a los yonkes, conforme a la sección 2.6.* Mecanix utiliza proveedores de infraestructura (Google LLC, mediante Firebase / Google Cloud, y Vercel Inc.) para almacenar y alojar la Plataforma, y no es responsable de actividades de esos proveedores que no le competan. El uso de estos proveedores constituye una remisión de datos y no una transferencia.

### 21 — Términos y Condiciones generales, nueva sección para yonkes (`/terminos`)

> **21. Solicitudes de piezas de talleres**
>
> Los talleres registrados en la Plataforma pueden solicitar una pieza indicando los datos de un vehículo. Mecanix notifica esa solicitud a los yonkes que podrían tenerla, por WhatsApp u otros medios, compartiendo con ellos los datos del taller y los datos del vehículo y la pieza solicitados. El primer yonke que confirme a Mecanix que tiene la pieza queda asignado a esa solicitud.
>
> El yonke solo puede usar los datos de una solicitud para atender esa solicitud, y es el único responsable de la veracidad de su respuesta al confirmar que tiene la pieza. La entrega, el pago y cualquier garantía de la pieza se acuerdan directamente entre el taller y el yonke asignado; Mecanix no es parte de ese acuerdo ni garantiza la disponibilidad, el estado o el precio de la pieza.
>
> Esta sección aplica a los yonkes. Los talleres se rigen, además, por la sección 22.

### 12 — Aviso de Privacidad general, nueva sección para yonkes (`/privacidad`)

> **12. Solicitudes de piezas de talleres**
>
> Cuando un taller registrado solicita una pieza, Mecanix comparte con los yonkes que reciben la solicitud los datos del taller (nombre, WhatsApp y ciudad) y los datos del vehículo y la pieza solicitados, con la única finalidad de que puedan confirmar si la tienen y atender la solicitud. No se comparten datos personales del cliente final del taller.
>
> El yonke que recibe una solicitud solo puede usar esos datos para atender esa solicitud, y es responsable, bajo su propia cuenta, de la veracidad de su respuesta al confirmar que tiene la pieza.
>
> Esta sección aplica a los yonkes. Los talleres se rigen, además, por la sección 13.

### Menciones menores (textos completos con el cambio)

**`/terminos`, sección 2** ("Descripción del servicio y alcance geográfico"), primer párrafo:

> Mecanix Yonke Virtual es una plataforma digital, con sede en Tijuana, Baja California, México, que actúa como intermediario entre clientes que buscan autopartes usadas y yonkes (deshuesaderos) registrados, *y que además permite a talleres registrados solicitar piezas a esos yonkes (ver sección 21).* La Plataforma opera en varios estados de México: cada yonke elige su estado al registrarse, y la cobertura puede crecer o cambiar con el tiempo. La cobertura vigente puede consultarse en la propia Plataforma.

**`/terminos`, sección 15** ("Contenido prohibido"):

> Está prohibido usar la Plataforma para publicar información falsa o engañosa; registrar negocios inexistentes o que no sean yonkes *o talleres*; realizar actividades ilegales; intentar acceder sin autorización a cuentas o datos de otros usuarios; extraer información de la Plataforma de forma automatizada o masiva sin autorización; publicar piezas de procedencia ilícita o robada; *o enviar solicitudes de piezas falsas o sin intención real de contratar.*

**`/privacidad`, sección 1** ("Responsable del tratamiento de tus datos"), primer párrafo:

> Mecanix Yonke Virtual ("la Plataforma", "nosotros") es un servicio con sede en Tijuana, Baja California, México, que conecta a clientes que buscan autopartes usadas con yonkes (deshuesaderos) registrados en varios estados de México, *y que además permite a talleres registrados solicitar piezas a esos yonkes (ver sección 12).* El responsable del tratamiento de tus datos personales es una persona física:

**`/privacidad`, sección 5** ("Con quién compartimos tus datos"), frase añadida al final:

> *Cuando un taller solicita una pieza a los yonkes, compartimos los datos de esa solicitud conforme a la sección 12.*

### Texto del aviso de cambios ("resumenCambios"), completo

> Actualizamos los Términos y Condiciones y el Aviso de Privacidad para incluir las herramientas de taller y el nuevo flujo de solicitud de piezas a yonkes. Tu taller es el responsable de los datos de sus clientes y Mecanix los almacena por tu petición; las cotizaciones se eliminan a los 90 días; y debes entregar un aviso de privacidad a tus clientes. Además, cuando solicites una pieza a los yonkes, Mecanix compartirá con ellos los datos de tu taller y del vehículo solicitado, pero nunca los datos personales de tu cliente. Para seguir creando cotizaciones o solicitando piezas, lee y acepta la nueva versión. Mientras tanto puedes consultar tus cotizaciones anteriores y quitar datos de tus clientes.

---

## Puntos que debería decidir el abogado

1. **¿El yonke necesita su propio texto de aceptación/reaceptación?** Hoy solo el taller tiene un mecanismo de "aceptar la versión vigente" antes de seguir usando la función de cotizaciones. El yonke, en cambio, nunca vuelve a aceptar nada después de registrarse (ver más abajo). Con este cambio, el yonke puede empezar a recibir datos de un taller (nombre, WhatsApp, ciudad) y de un vehículo/pieza sin haber aceptado expresamente una versión que lo menciona. Hay que decidir si eso es correcto tal cual, o si conviene mostrarle al yonke un aviso de cambios equivalente al del taller.
2. **"El primer yonke que confirma, queda asignado."** No hay todavía una regla escrita sobre qué pasa si dos yonkes responden casi al mismo tiempo, si el taller puede rechazar al yonke asignado, o qué pasa si el yonke asignado luego dice que ya no la tiene. El texto deja esto abierto a resolverse "directamente entre el Taller y el yonke"; conviene confirmar que ese nivel de generalidad es aceptable o si se prefiere describir el mecanismo con más detalle.
3. **Plazo de conservación de los datos de la solicitud.** El texto no fija un plazo distinto para los datos de una solicitud de pieza (nombre/WhatsApp/ciudad del taller, datos del vehículo) que se envían al yonke. Hay que decidir si aplican los mismos 90 días de las cotizaciones, o si conviene fijar un plazo propio.
4. **Indemnidad.** La cláusula 1.8 de indemnidad del taller (frente a Mecanix) está escrita en términos de la relación taller-cliente; no contempla expresamente reclamaciones derivadas de una solicitud de pieza mal atendida por un yonke, o de que un yonke responda que tiene una pieza sin tenerla. Conviene revisar si esa cláusula, o alguna nueva, debe cubrir también esa relación taller-yonke.
5. **Límite de responsabilidad (1.8.2).** Ese tope económico está pensado para la relación Mecanix-Taller. Si el abogado considera que el flujo de solicitud de piezas crea un riesgo distinto (por ejemplo, frente al yonke, o frente al taller si un yonke no entrega lo prometido), puede valer la pena revisar si el mismo tope aplica o si falta aclarar algo ahí.

---

## Qué NO cambió en este borrador

- No se modificó `src/lib/borrarTallerCompleto.mjs`, ni las reglas de permisos del taller sobre sus cotizaciones (`firestore.rules`): esta actualización es únicamente de los textos legales.
- No se encendió la bandera `NEXT_PUBLIC_TALLERES_HABILITADOS`, no se tocó Firestore de producción ni se creó `config/cotizaciones`.
- No hubo deploy ni push. Los cambios están solo en el árbol de trabajo local, en la rama `feature/textos-legales-talleres`.
