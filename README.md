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
- borrar la proyección y comenzar de nuevo.

## Criterios del proyecto

- La fecha inicial siempre corresponde al día en que se abre la aplicación.
- Los movimientos no pueden registrarse con fecha anterior al día actual.
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

### Importes con centavos

La captura y la edición admiten importes positivos con hasta dos decimales. El detalle de movimientos, las tablas bancarias, los totales seleccionados, los grupos de pagos y la exportación a Excel muestran centavos. Los indicadores principales y la gráfica mantienen sus formatos resumidos para facilitar la lectura.

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

### Deshacer una eliminación

Al eliminar un movimiento de la proyección personal, aparece **Deshacer** durante **5 segundos**. Cada eliminación tiene su propio plazo. Deshacer recupera el mismo movimiento sin revertir otras ediciones realizadas después.

Esta recuperación es temporal en la sesión del navegador. Al vencer el plazo, recargar la página o borrar toda la proyección, la opción deja de estar disponible. Para restaurar un traspaso, sus dos cuentas deben seguir existiendo.

### Vista compacta en pantallas pequeñas

A **680 px o menos**, las tablas de movimientos y bancos se presentan como tarjetas con sus etiquetas. Se conservan la selección de resultados visibles, las acciones y el mismo conjunto de registros. Los filtros, la captura y los diálogos ajustan sus columnas al espacio disponible.

## Verificación del cambio

Con Node.js instalado, ejecuta:

```bash
node --check app.js
node --check excel-export.js
node tests/movements.test.cjs
node tests/excel-export.test.cjs
```

No se necesitan dependencias para las pruebas. Consulta [la especificación](docs/movement-editing-spec.md) y [la evidencia de verificación](docs/movement-editing-verification.md) para conocer el alcance y los límites de las comprobaciones.

La ampliación de banco opcional tiene su [especificación](docs/optional-payment-bank-spec.md) y [evidencia de verificación](docs/optional-payment-bank-verification.md).

La ampliación de horizontes, categorías, traspasos, exportación y operación diaria se describe en [su especificación](docs/treasury-expansion-spec.md). Los resultados y límites de las comprobaciones se registran en [la evidencia de esta ampliación](docs/treasury-expansion-verification.md).

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


