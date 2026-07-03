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
*Esta sección está destinada exclusivamente a los representantes de la administración en cada colegio electoral para introducir los datos del escrutinio.*

### Cómo acceder al portal
`[Captura de pantalla recomendada: Botón "Acceso Portal" en la cabecera superior derecha y pantalla de Login de ArcGIS]`

1. Pinche en el botón **Acceso Portal** situado en la esquina superior derecha de la cabecera de la aplicación.
2. Pinche en el botón azul **Conectar con ArcGIS Portal**.
3. Introduzca sus credenciales autorizadas en la ventana que aparece (por ejemplo, el usuario asignado a su colegio como `JaramaEleccionesGenPrueba`).

### Paso 1: Seleccionar la Mesa Electoral
`[Captura de pantalla recomendada: Panel de bienvenida del colegio y el listado de mesas disponibles para seleccionar en el Paso 1]`

1. Una vez dentro del portal, verá el nombre de su colegio (por ejemplo: *C.E.I.P. JARAMA*).
2. En el **Paso 1**, pinche sobre la mesa electoral que vaya a escrutar (por ejemplo: `Mesa 006A`). Las mesas que ya han sido cerradas no se mostrarán en esta lista para evitar errores.

### Paso 2: Identificar a los Miembros de la Mesa
`[Captura de pantalla recomendada: Formulario del Paso 2 con los campos para rellenar los nombres de los miembros de la mesa]`

1. En el formulario del **Paso 2**, escriba el nombre y apellidos completos de las personas que componen la mesa electoral:
   * **Presidente/a de la Mesa**
   * **Primer Vocal**
   * **Segundo Vocal**

### Paso 3: Introducir Votos del Escrutinio
`[Captura de pantalla recomendada: Sección del Paso 3 con los campos de entrada de votos para los partidos, votos en blanco, nulos y la banda verde de validación exitosa]`

1. En el **Paso 3**, introduzca el número de votos exacto que ha obtenido cada candidatura en las casillas correspondientes.
2. Introduzca también el total de **Votos en Blanco** y **Votos Nulos**.
3. Revise la tarjeta de resumen inferior:
   * Si el total de votos introducidos no supera el censo electoral, se mostrará una banda verde indicando **Votos válidos**.
   * Si hay alguna incoherencia o se supera el censo, revise los números introducidos.

### Paso 4: Firma del Acta por los Miembros de la Mesa
`[Captura de pantalla recomendada: Tres recuadros de firma con trazos simulados y el botón de "Borrar" disponible debajo de cada uno]`

1. En el **Paso 4**, pida a los miembros de la mesa que firmen directamente en la pantalla de su dispositivo (puede usar el ratón si es un ordenador, o el dedo/lápiz táctil si es una tablet o móvil):
   * Firma del **Presidente/a** (primer recuadro).
   * Firma del **Primer Vocal** (segundo recuadro).
   * Firma del **Segundo Vocal** (tercer recuadro).
2. Si alguna firma no queda bien, pinche en el botón **Borrar** que aparece justo debajo de ese recuadro de firma para limpiarlo y volver a firmar.

### Paso 5: Cerrar la Mesa y Enviar los Datos
`[Captura de pantalla recomendada: Botón "Cerrar Mesa y Transmitir Acta" en la parte inferior del portal]`

1. Asegúrese de que todos los datos y firmas son correctos.
2. Pinche en el botón azul **Cerrar Mesa y Transmitir Acta**.
3. El sistema transmitirá los datos y bloqueará la mesa. Recibirá una confirmación en pantalla y volverá a la lista de mesas para seleccionar otra si fuera necesario.

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
