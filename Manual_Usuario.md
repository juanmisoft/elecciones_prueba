# Manual de Usuario: Sistema de Escrutinio y Visor Electoral

Este manual detalla de forma sencilla y directa cómo utilizar la aplicación electoral de Rivas-Vaciamadrid. El documento está dividido en tres secciones según el perfil del usuario: la **Vista Pública (Visor)**, el **Portal de Representantes de Colegio** y el **Panel de Administración**.

---

## 1. Parte Visual: Visor Público y Estadísticas
*Esta sección está abierta a cualquier ciudadano o usuario sin registrar. Sirve para consultar los resultados del escrutinio en tiempo real.*

`[Captura de pantalla recomendada: Vista principal de la aplicación, mostrando el mapa interactivo en el centro y la barra lateral de estadísticas a la izquierda]`

### Cómo consultar los resultados generales del municipio
1. Al entrar a la aplicación, se mostrará por defecto la pestaña **Global** en la barra lateral izquierda.
2. Observe las **Métricas Generales** arriba:
   * **Progreso del Escrutinio:** Muestra el porcentaje de mesas cerradas y cuántas quedan pendientes.
   * **Participación:** Indica el porcentaje de votantes del censo que ya han acudido a las urnas.
   * **Censo Total:** Muestra la cantidad total de personas con derecho a voto.
   * **Votos Nulos y Blancos:** Muestra las cantidades absolutas y sus porcentajes correspondientes.
3. Debajo verá el listado de **Resultados Electorales** con los partidos políticos ordenados de mayor a menor número de votos recibidos, indicando su porcentaje y votos totales.

### Cómo consultar los resultados de un Colegio Electoral concreto
`[Captura de pantalla recomendada: Barra lateral con la pestaña "Colegios" abierta y el cuadro de búsqueda activo]`

1. En la barra lateral izquierda, pinche en la pestaña **Colegios**.
2. Escriba el nombre del colegio o la calle en la caja de búsqueda (por ejemplo: "Jarama" o "Almendros") para filtrar la lista.
3. Pinche sobre el nombre del colegio en la lista, o bien pinche directamente sobre el icono de ese colegio en el mapa. Se abrirá una ventana flotante (ficha del colegio).

`[Captura de pantalla recomendada: Ficha de detalle de un colegio con sus datos de censo, participación y los votos que ha recibido cada partido en ese centro]`

4. Dentro de la ficha del colegio podrá consultar:
   * La dirección exacta y un botón de **Cómo llegar** (que abre la ruta en Google Maps).
   * Las secciones censales asociadas.
   * La participación y censo específico de ese colegio.
   * El listado detallado de votos que ha recibido cada partido político en ese centro.
5. Para cerrar la ficha, pinche en el botón **Cerrar Ficha** en la parte inferior de la ventana o en la **X** de la esquina superior derecha.

### Cómo explorar el Mapa Electoral Interactivo
1. Observe las distintas zonas (secciones censales) coloreadas en el mapa: **cada color representa al partido que va ganando** en esa sección específica.
2. En la esquina inferior derecha dispone de la **Leyenda Top 3 Municipio** que le indica los tres partidos más votados del municipio y el color asignado a cada uno.
3. Si una zona aparece de color gris, significa que aún no se han recibido votos en esa sección (o hay un empate).
4. Pinche sobre cualquier zona coloreada del mapa para abrir un pequeño bocadillo informativo con el número de sección censal, la participación en esa sección y el desglose de votos por partido en esa zona.

---

## 2. Parte del Usuario de Colegios: Representantes de Mesa
*Esta sección está destinada exclusivamente a los representantes de la administración en cada colegio electoral para transmitir los avances de participación durante la jornada y los resultados del escrutinio final.*

### Cómo acceder al portal
`[Captura de pantalla recomendada: Botón "Acceso Portal" en la cabecera superior derecha y pantalla de Login de ArcGIS]`

1. Pinche en el botón **Acceso Portal** situado en la esquina superior derecha de la cabecera de la aplicación.
2. Introduzca sus credenciales autorizadas (por ejemplo, el usuario asignado a su colegio como `JaramaEleccionesGenPrueba`).

### Selección de Mesa Electoral
`[Captura de pantalla recomendada: Panel de bienvenida del colegio y el listado de mesas disponibles]`

1. Una vez dentro del portal, verá el nombre de su colegio (por ejemplo: *C.E.I.P. JARAMA*).
2. Pinche sobre la mesa electoral sobre la que vaya a operar (por ejemplo: `Mesa 006A`).
3. En la parte superior dispondrá de **3 botones de fase** para elegir la operación a realizar:
   * **1º Avance (14:00h)**
   * **2º Avance (18:00h)**
   * **Escrutinio (20:00h)**

---

### Opción A: Transmitir 1º Avance de Participación (14:00h)
`[Captura de pantalla recomendada: Formulario del 1º Avance con el campo de votantes y el porcentaje en vivo]`

1. Pinche en el botón **1º Avance (14:00h)**.
2. Consulte la lista de votantes de la mesa y cuente cuántas personas han votado hasta las 14:00 horas.
3. Introduzca ese número en la casilla única **Total de personas que han votado hasta las 14:00h**.
4. El sistema calculará y mostrará automáticamente el porcentaje de participación en tiempo real sobre el censo de la mesa.
5. Pinche en **Transmitir 1º Avance de Participación**. Los datos se enviarán inmediatamente al sistema central.

---

### Opción B: Transmitir 2º Avance de Participación (18:00h)
`[Captura de pantalla recomendada: Formulario del 2º Avance con la referencia del 1º avance y la casilla de votantes acumulados]`

1. Pinche en el botón **2º Avance (18:00h)**.
2. Verá una tarjeta informativa con el dato transmitido en el 1º Avance como referencia.
3. Introduzca el número total acumulado de personas que han votado hasta las 18:00 horas.
4. Pinche en **Transmitir 2º Avance de Participación**.

---

### Opción C: Escrutinio Final y Cierre de Mesa (20:00h)
`[Captura de pantalla recomendada: Formulario de Escrutinio con los campos de miembros de mesa, reparto de votos por partido y botón de cierre]`

1. Tras el cierre del colegio y la apertura de las urnas, pinche en el botón **Escrutinio (20:00h)**.
2. **Paso 1 - Miembros de la Mesa:** Escriba el nombre y apellidos del Presidente/a, Primer Vocal y Segundo Vocal.
3. **Paso 2 - Introducción de Votos:** Introduzca el número de votos obtenido por cada candidatura política, así como los Votos en Blanco y Votos Nulos.
4. Revise el indicador de validación inferior:
   * Si la suma de votos no supera el censo, aparecerá en verde **Votos válidos**.
   * Si hay alguna discrepancia o se supera el censo, revise los números introducidos.
5. **Paso 3 - Cierre:** Pinche en **Cerrar Mesa y Transmitir Escrutinio**. La mesa quedará formalmente cerrada y los resultados definitivos se integrarán en el visor público y las estadísticas municipales.

---

## 3. Parte del Administrador: Panel de Control General
*Esta sección está reservada a los administradores del sistema electoral para supervisar el proceso, descargar informes y gestionar las mesas.*

### Cómo acceder como Administrador
1. Pinche en **Acceso Portal** en la esquina superior derecha.
2. Pinche en **Conectar con ArcGIS Portal** e inicie sesión con la cuenta de administrador (`AdminEleccionesGenPrueba`).

### Cómo supervisar el estado de la elección
`[Captura de pantalla recomendada: Vista del Panel de Administración, con el listado general de mesas a la izquierda y el bloque "Estado de la Elección" con gráficos y métricas a la derecha]`

1. En la columna derecha, dentro del cuadro **Estado de la Elección**, puede ver en tiempo real:
   * El porcentaje de mesas escrutadas en todo el municipio.
   * El número total de votos válidos acumulados.
   * La participación media en el municipio.
2. En la columna izquierda, en el apartado **Resumen de Escrutinio por Colegio**, puede ver una tarjeta por cada colegio con su progreso de mesas (ej. *2 de 3 mesas escrutadas*).

### Cómo consultar y descargar un Acta Firmada
`[Captura de pantalla recomendada: Modal del Acta de Escrutinio oficial mostrando los resultados numéricos y las tres firmas digitales en la parte inferior]`

1. En la tabla central **Listado General de Mesas**, busque la mesa que desea consultar.
2. Si el estado de la mesa indica **Escrutada** (color verde), se activará un botón para visualizar el acta.
3. Pinche en el botón de la lupa/ojo para abrir el acta digital.
4. Verá una plantilla oficial con todos los votos de la mesa y las firmas digitales de los tres miembros.
5. Pinche en **Imprimir / Guardar PDF** para imprimir el documento físicamente o guardarlo en formato PDF en su ordenador.

### Cómo Exportar los Datos
`[Captura de pantalla recomendada: Parte superior derecha del Panel de Administración con los botones "Exportar CSV" e "Imprimir PDF" resaltados]`

* **Descargar Excel (CSV):** Pinche en el botón **Exportar CSV** en la parte superior derecha. Se descargará automáticamente un archivo compatible con Excel con el detalle de votos de todas las mesas.
* **Imprimir Informe General:** Pinche en el botón **Imprimir PDF**. Se generará un informe estructurado listo para enviar a la impresora o guardar como archivo digital.

### Cómo añadir Mesas Electorales (Alta)
`[Captura de pantalla recomendada: Formulario modal para Registrar Nueva Mesa]`

1. Pinche en el botón azul **Añadir Mesa** en la parte superior derecha.
2. Seleccione el **Colegio Electoral** de la lista desplegable.
3. Seleccione la **Sección Censal** (el sistema filtrará las secciones válidas para ese colegio).
4. Escriba la **Letra de la Mesa** (ej: *A*, *B* o *U*).
5. Introduzca el **Censo Electoral** (número estimado de votantes de esa mesa).
6. Pinche en **Registrar Mesa** para guardarla.

### Herramientas de Prueba (Simulador y Reinicio)
`[Captura de pantalla recomendada: Cuadro de "Entorno de Pruebas" en la barra lateral derecha con los botones de simular, eliminar y reiniciar]`

* **Simular votaciones:** Pinche en el botón naranja **Simular Todo el Municipio** para rellenar de forma automática e instantánea las 198 mesas con votos y firmas aleatorias proporcionales al censo de 2023. Esto permite comprobar cómo se comporta el mapa y las estadísticas con datos reales simulados.
* **Reiniciar a cero:** Pinche en **Reiniciar Escrutinio a Cero** si desea vaciar todos los votos y firmas introducidas para empezar un escrutinio limpio.
* **Eliminar mesas creadas:** Pinche en **Eliminar Todas las Mesas Generadas** si desea limpiar las mesas de prueba simuladas y dejar solo las iniciales.
