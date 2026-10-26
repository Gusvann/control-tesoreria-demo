# Control de Tesorería — Demo y proyección interactiva

Dashboard demostrativo para consultar la posición diaria de caja y crear una proyección propia desde cero.

> La vista de ejemplo utiliza datos completamente simulados. La información capturada por cada visitante se guarda únicamente en su navegador mediante `localStorage`; no se envía a servidores, bases de datos, Google Sheets ni APIs.

## Flujo de uso

### 1. Ver ejemplo

La página abre con un escenario demostrativo para explicar cómo leer:

- saldo disponible;
- cobros y pagos del periodo;
- saldo proyectado;
- saldo mínimo;
- movimientos confirmados y por confirmar;
- evolución de la liquidez a 7, 14, 30, 60 o 90 días.

Las opciones **2 meses** y **3 meses** corresponden a **60 y 90 días**, respectivamente, contados desde la fecha actual. El horizonte conserva su límite inclusivo.

### 2. Crear mi proyección

El CTA **Crear mi proyección** cambia a un escenario personal que comienza en cero. La persona puede:

- agregar bancos y revisar el impacto antes de retirarlos;
- nombrar cada banco;
- capturar el saldo inicial por banco;
- registrar cobros, pagos y traspasos programados;
- asignar fecha, concepto, importe y estatus;
- especificar opcionalmente el banco de cada pago;
- clasificar opcionalmente los pagos por categoría;
- incluir o excluir movimientos por confirmar;
- revisar el forecast desde la fecha actual;
- exportar los movimientos a Excel;
- importar Excel o pegar una tabla con revisión previa;
- duplicar un movimiento como borrador editable;
- guardar y comparar escenarios independientes;
- vaciar el escenario activo y comenzar de nuevo.

## Criterios del proyecto

- La fecha inicial siempre corresponde al día en que se abre la aplicación.
- La captura y la duplicación no admiten fechas anteriores al día actual. La importación permite históricos únicamente al activar esa opción; no entran en la proyección que comienza hoy.
- El saldo inicial total se calcula a partir de la suma de los saldos bancarios.
- La proyección es completamente client-side.
- No requiere usuarios, contraseñas ni instalación.

## Selección, filtros y edición de movimientos

En **Próximos movimientos** puedes buscar por concepto y filtrar por tipo, estatus, banco, categoría y rango de fechas. **Mostrar → Todos los movimientos** permite recuperar movimientos históricos, fuera del horizonte o por confirmar que no están incluidos en la proyección. Los filtros afectan la tabla, la agrupación de pagos y la exportación de resultados filtrados; los indicadores y la gráfica conservan la proyección actual.

El filtro de un banco incluye sus pagos asignados y los traspasos donde participa como origen o destino. También puedes elegir **Pagos sin banco** o **Banco no disponible**. El filtro **Sin categoría** muestra los pagos pendientes de clasificar.

- Marca las casillas de las filas; la casilla de cabecera selecciona todos los resultados visibles.
- Revisa los totales de cobros, pagos, traspasos y neto de la selección. Cada traspaso se cuenta una sola vez en su apartado y aporta cero al neto.
- Usa **Editar seleccionados** para aplicar una nueva fecha, un nuevo estatus o ambos. En lote, marca únicamente los campos que quieras cambiar.
- Haz doble clic sobre una fila o usa **Editar** para cambiar un movimiento individual. También hay un botón Editar en la lista de captura. En el editor individual puedes corregir el concepto y el importe; estos dos campos no se modifican en lote.
- Revisa el número de movimientos que se actualizarán y pulsa **Guardar cambios**. **Cancelar** y Escape descartan el borrador.
- Al cambiar filtros, horizonte o vista se limpia la selección. Seleccionar no cambia el estatus de un movimiento.
- Una nueva fecha debe ser válida y no anterior a hoy. Puedes cambiar solo el estatus de un movimiento histórico sin modificar su fecha.

El nombre del campo es **estatus del movimiento**: **Confirmado** o **Por confirmar**. La proyección personal conserva sus cambios en este navegador. En **Ver ejemplo**, la edición es temporal y se restablece al recargar.

### Importes en formato contable

Los importes y saldos usan MXN, separador de miles y dos decimales: `$1,234.50`. Los negativos calculados y las salidas en las filas de movimientos se muestran entre paréntesis, como `($1,234.50)`; el cero monetario aparece como `$—`. Los indicadores principales también conservan centavos. Solo el eje de la gráfica abrevia cifras de millones para mantener legibles sus etiquetas.

En captura, edición, duplicación y saldos bancarios, el símbolo `$` queda a la izquierda y las cifras a la derecha. Puedes escribir el número sin separadores; al salir se aplica el formato, sin reescribir el texto al enfocar o durante cada pulsación. Puedes pegar `1234.5`, `1,234.50`, `$1,234.50` o `MXN 1,234.50`. Una entrada vacía no equivale a cero: texto inválido, separadores incorrectos y milésimas se conservan para corregirlos y no se guardan como otro importe.

Los saldos bancarios se guardan al salir del campo. La captura y la edición de movimientos se guardan únicamente con sus respectivos botones. Mostrar el formato no cambia los números almacenados; los pagos siguen siendo importes positivos identificados por su tipo. Una edición de otro campo tampoco redondea importes anteriores intactos.

El Excel exportado utiliza el formato Contabilidad de cuatro secciones y mantiene los importes como celdas numéricas. Fechas, porcentajes, conteos y números de fila conservan su formato habitual.

### Enter durante la captura

Enter en los campos de captura **conserva lo escrito y no registra el movimiento**. Para guardarlo, utiliza **Agregar movimiento**; el botón también puede activarse con el teclado. Un error de validación o almacenamiento conserva el borrador. Después de un registro explícito correcto, el formulario vuelve a estar listo para el siguiente movimiento.

### Banco opcional en cada pago

Al elegir **Tipo → Pago**, aparece **Banco (opcional)** con los bancos de tu proyección. Puedes dejar **Sin banco asignado** y guardar normalmente. El nombre del banco se muestra en la lista de captura y debajo del concepto en Próximos movimientos.

En el modal de un pago puedes asignar, cambiar o quitar el banco. Para hacerlo en lote, selecciona únicamente pagos y activa **Cambiar banco**; los demás campos conservan sus valores si no los activas. Elegir **Sin banco asignado** elimina la asignación.

La relación usa el ID del banco: si lo renombras, los pagos muestran su nuevo nombre. Al retirar explícitamente un banco, sus pagos se conservan como **Banco no disponible** hasta que cambies o quites esa asignación. La información bancaria del pago no modifica los saldos iniciales ni el cálculo agregado de la proyección. Los pagos anteriores sin banco siguen siendo válidos.

### Categorías opcionales de los pagos

Cada pago puede clasificarse como **Costos**, **Gastos**, **Nómina**, **Financieros**, **Impuestos** u **Otros**, o permanecer **Sin categoría**. La categoría se puede asignar, cambiar o quitar en captura y edición; en lote, selecciona únicamente pagos y activa **Cambiar categoría**. Los cobros y traspasos no reciben categorías de pago.

Debajo de la tabla, **Pagos por categoría** agrupa los pagos que cumplen los filtros y muestra su cantidad, importe total y detalle desplegable. **Sin categoría** permanece al final, incluidos los pagos anteriores que todavía no tienen clasificación.

### Traspasos programados entre cuentas

Elige **Tipo → Traspaso** y captura fecha, concepto, importe, estatus, **Cuenta de origen** y **Cuenta de destino**. Las cuentas deben existir y ser distintas. Un traspaso se guarda como un solo movimiento; puede corregirse individualmente, incluyendo concepto, importe y cuentas.

Al entrar en el horizonte de proyección, el traspaso resta al origen y suma al destino. Su efecto en el efectivo total es cero: no aumenta los cobros ni los pagos y no modifica los saldos iniciales capturados. Su estatus respeta el mismo interruptor de movimientos por confirmar que los demás registros.

La tabla bancaria muestra **Traspasos netos** y **Saldo tras traspasos**. Esta última columna equivale al saldo inicial más las entradas menos las salidas por traspasos incluidos en el período. Ajusta únicamente los traspasos: los cobros y pagos se consideran en la proyección general.

### Agregar y retirar bancos

Usa **Agregar banco** para crear una cuenta y capturar su nombre y saldo. **Número de bancos** muestra la cantidad actual y es de solo lectura.

La acción **Retirar banco** de cada cuenta abre una revisión de su saldo inicial, cantidad e importe de traspasos vinculados y pagos asignados. No se puede retirar el último banco ni uno que todavía tenga traspasos vinculados, incluso si están fuera del horizonte actual. Reasigna las cuentas de esos traspasos o elimina sus movimientos antes de retirar el banco. Los pagos se conservan y pueden reasignarse posteriormente. **Cancelar** y Escape cierran la revisión sin retirar nada.

### Exportar a Excel

Selecciona el alcance junto a **Exportar Excel**:

- **Resultados filtrados:** los movimientos visibles con los filtros actuales.
- **Seleccionados:** las filas marcadas.
- **Todos:** todos los movimientos de la vista activa, incluidos los que quedan fuera del horizonte.

La descarga genera un archivo `.xlsx` con una fila por movimiento y campos de fecha, concepto, tipo, estatus, importe, banco, categoría y cuentas de origen/destino cuando corresponden. Los traspasos aparecen una sola vez. Las fechas e importes conservan tipos adecuados para Excel; el texto capturado se exporta como texto. El archivo se genera en el navegador, sin enviar movimientos a un servidor.

Excel es un reporte de movimientos. El respaldo y la restauración de toda la proyección no forman parte de esta función.

### Importar Excel o pegar una tabla

En la proyección personal, usa **Importar movimientos**. La carga tiene tres pasos y añade registros al escenario activo:

1. **Origen:** selecciona un archivo `.xlsx`, `.csv` o `.tsv`, o pega las celdas copiadas de Excel. Los archivos de texto deben estar en UTF-8.
2. **Columnas:** elige la hoja, la fila de encabezados (0 si no hay), relaciona las columnas y revisa el orden de fechas y el formato del importe. Fecha, concepto e importe son obligatorios. Tipo y estatus admiten los valores predeterminados visibles. Banco y categoría son opcionales para pagos; los traspasos necesitan dos cuentas existentes y distintas.
3. **Revisión:** consulta los errores, avisos y posibles duplicados. Las filas válidas sin coincidencias se seleccionan inicialmente. Los posibles duplicados comienzan desmarcados y puedes seleccionarlos explícitamente. Solo **Importar N movimientos seleccionados** guarda el lote.

Los nombres de bancos y categorías deben coincidir con los existentes. No se crean cuentas automáticamente. Los importes deben ser positivos, menores a 10^13 y tener hasta dos decimales. Los IDs de origen ayudan a detectar coincidencias; cada registro importado recibe un ID nuevo. La importación no actualiza ni reemplaza movimientos existentes.

La opción **Permitir fechas anteriores a hoy** incorpora registros históricos que puedes consultar con **Todos los movimientos**, sin modificar la proyección desde hoy. Corrige las filas con errores en el archivo o tabla de origen y vuelve a cargarlas. Un error de validación o almacenamiento conserva la revisión y no guarda una parte del lote.

Límites: 10 MiB por archivo, 5,000 filas de datos de la hoja elegida y 50 columnas; el lector también limita la expansión del archivo, la cantidad de hojas/celdas y el tiempo de lectura. Excel se lee localmente en un Worker con una copia fija de SheetJS CE. Las fórmulas solo aportan su valor guardado, con un aviso; no se recalculan ni se siguen enlaces. No se admiten `.xls`, libros con macros ni libros cifrados.

### Duplicar un movimiento

Usa **Duplicar** en la lista de captura o en la tabla. Se abre el editor con una copia de los datos, sin guardar nada todavía. Cambia concepto, importe, fecha, estatus y los campos aplicables al tipo de movimiento; pulsa **Agregar copia** para crear otro registro con ID nuevo. El original permanece intacto. **Cancelar** y Escape descartan la copia.

La fecha original se mantiene en el borrador. Si ya pasó, elige una fecha desde hoy para poder guardar la copia. Un traspaso se duplica como un solo movimiento con origen y destino. La función está disponible en Base personal y sus simulaciones, no en la vista de ejemplo.

### Escenarios de simulación guardados

**Base personal** es la proyección principal. En **Escenarios guardados** puedes crear hasta 10 simulaciones con nombres únicos. Elige si partes de Base o del escenario actual; cada simulación recibe su propia copia de bancos, saldos y movimientos. En **Más opciones** puedes duplicarla, renombrarla, eliminarla o volver a Base.

La captura, importación, edición, duplicación, eliminación y gestión de bancos afectan únicamente al escenario activo. Al cambiar se reinician filtros, selección y borradores de edición/importación; una captura pendiente solicita confirmar su descarte. El último escenario personal activo se recuerda al recargar, aunque la página conserva su apertura en **Ver ejemplo**.

**Comparar escenarios** muestra saldo inicial, saldo mínimo y fecha, saldo final y primer faltante. Las diferencias se calculan contra Base con el mismo día inicial, horizonte y opción de movimientos por confirmar. Los filtros de la tabla no alteran esta comparación.

**Usar este escenario como Base** muestra primero el impacto. Al confirmar, reemplaza bancos y movimientos de Base por la simulación y guarda automáticamente la Base anterior como otro escenario, en una sola escritura. Necesita un lugar libre entre las 10 simulaciones. Si falla el guardado, no se realiza ningún cambio. **Vaciar escenario** afecta únicamente al activo y conserva los demás.

Base y simulaciones se guardan en este navegador. La copia automática de Base no constituye un respaldo externo ni sincroniza datos entre dispositivos. Los datos existentes siguen siendo Base personal y conservan sus IDs y relaciones.

### Deshacer una eliminación

Al eliminar un movimiento de la proyección personal, aparece **Deshacer** durante **5 segundos**. Cada eliminación tiene su propio plazo. Deshacer recupera el mismo movimiento sin revertir otras ediciones realizadas después.

Esta recuperación es temporal en la sesión del navegador y corresponde al escenario donde se eliminó el movimiento. Cambiar de escenario no amplía su plazo ni permite restaurar el movimiento en otro destino. Al vencer el plazo, recargar la página o vaciar ese escenario, la opción deja de estar disponible. Para restaurar un traspaso, sus dos cuentas deben seguir existiendo.

### Vista compacta en pantallas pequeñas

A **680 px o menos**, las tablas de movimientos y bancos se presentan como tarjetas con sus etiquetas. Se conservan la selección de resultados visibles, las acciones y el mismo conjunto de registros. Los filtros, la captura y los diálogos ajustan sus columnas al espacio disponible.

## Verificación del cambio

Con Node.js instalado, ejecuta:

```bash
node --check app.js
node --check excel-export.js
node --check treasury-import.js
node --check treasury-import-worker.js
node --check accounting.js
node tests/movements.test.cjs
node tests/excel-export.test.cjs
node tests/treasury-import.test.cjs
node tests/accounting.test.cjs
```

No se necesitan dependencias para las pruebas. Consulta [la especificación](docs/movement-editing-spec.md) y [la evidencia de verificación](docs/movement-editing-verification.md) para conocer el alcance y los límites de las comprobaciones.

La ampliación de banco opcional tiene su [especificación](docs/optional-payment-bank-spec.md) y [evidencia de verificación](docs/optional-payment-bank-verification.md).

La ampliación de horizontes, categorías, traspasos, exportación y operación diaria se describe en [su especificación](docs/treasury-expansion-spec.md). Los resultados y límites de las comprobaciones se registran en [la evidencia de esta ampliación](docs/treasury-expansion-verification.md).

La importación, duplicación y simulación guardada tienen [especificación](docs/import-duplicate-scenarios-spec.md) y [evidencia de verificación](docs/import-duplicate-scenarios-verification.md).

El formato contable tiene [especificación](docs/accounting-format-spec.md) y [evidencia de verificación](docs/accounting-format-verification.md).

## Diseño

- **Sora:** títulos, encabezados, cifras, indicadores y métricas.
- **Public Sans:** textos, tablas, etiquetas, formularios, botones y navegación.
- **Titular dividido:** primera frase en tinta oscura y segunda frase en azul.

## Tecnologías

- HTML5
- CSS3
- JavaScript sin frameworks
- SVG generado con JavaScript para la gráfica
- `localStorage` para persistencia local
- Generación local de Excel mediante OOXML/ZIP, sin dependencias adicionales
- Lectura local de Excel en Worker con SheetJS CE 0.20.3 vendorizado; [licencia y procedencia](vendor/README.md)

## Ejecución

No requiere compilación.

1. Clona o descarga el repositorio.
2. Abre la carpeta en tu editor.
3. Ejecuta `index.html` con un servidor local, por ejemplo **Live Server**.

También puede publicarse mediante GitHub Pages.

## Estructura

```text
.
├── index.html
├── styles.css
├── app.js
├── excel-export.js
├── treasury-import.js
├── treasury-import-worker.js
├── accounting.js
├── vendor/
├── README.md
├── docs/
└── tests/
```

## Autor

**Iván Mota Cruz**  
Tesorería · Gestión financiera · Automatización


## Escala de la gráfica

La escala vertical se construye a partir del **saldo mínimo y máximo acumulado de la proyección**, no del tamaño aislado de cada cobro o pago.

- **Automática:** agrega un margen visual aproximado de 12 %, redondea límites e intervalos a cifras financieras legibles y muestra el cero únicamente cuando aporta contexto de riesgo o los saldos son pequeños.
- **Desde cero:** mantiene el cero como referencia para dimensionar la magnitud total de la caja.
- Utiliza entre cuatro y cinco marcas principales cuando el rango lo permite.
- No fuerza simetría entre valores positivos y negativos.
- Cuando el escenario personal no contiene saldos ni movimientos, muestra un estado vacío en lugar de una escala arbitraria.


