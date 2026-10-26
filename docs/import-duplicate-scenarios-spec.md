# Importación, duplicación y escenarios guardados

Fecha: 26 de octubre de 2026. Base: `6ce924321cbf0a4d2195a00671dd95d997723823`.

## Objetivo

Incorporar los tres elementos solicitados: importar Excel o pegar una tabla, duplicar un movimiento y guardar/comparar simulaciones. Mantener la captura sencilla, el almacenamiento local y las funciones existentes. No incluye cierre diario, pagos realizados, conciliación, recurrencias, usuarios ni sincronización.

## Reglas acordadas para el incremento

### Importación

- Añade al escenario personal activo; nunca sustituye su contenido durante una importación.
- Fuente: Excel `.xlsx`, texto pegado delimitado por tabuladores, o archivo CSV/TSV UTF-8. No se anuncian `.xls`, macros ni archivos cifrados.
- Tres pasos: fuente, hoja/columnas/formato, revisión. La lectura y la revisión no guardan datos.
- El usuario puede seleccionar hoja y fila de encabezados, revisar el mapeo y elegir orden de fecha y separadores numéricos. Predeterminado explícito: día/mes/año y `1,234.56` (México). ISO y fechas tipadas de Excel se reconocen sin depender de la zona horaria.
- Campos principales: fecha, concepto, importe; tipo y estatus admiten valores por defecto visibles. Banco/categoría opcionales para pagos, origen/destino obligatorios y distintos para traspasos.
- Los nombres de bancos/categorías deben resolver a registros existentes sin ambigüedad. No se crean ni se asignan cuentas por posición. Los campos sin asignar siguen siendo válidos para pagos.
- Importe positivo, hasta dos decimales y menor a 10^13, compatible con el exportador. No se redondea ni se cambia el signo silenciosamente.
- Las fechas anteriores a hoy requieren activar expresamente la opción de históricos. Se advierte que quedan fuera de la proyección actual y se consultan con Todos los movimientos. Las altas normales y duplicados conservan su validación desde hoy.
- Revisión por fila: errores, avisos y posibles duplicados. Filas válidas sin coincidencias seleccionadas inicialmente; posibles duplicados desmarcados y seleccionables de forma explícita. Filas inválidas no se pueden importar.
- La única escritura ocurre al pulsar Importar N movimientos seleccionados. Las filas seleccionadas se validan juntas y se anexan en una escritura; cualquier error del lote o de almacenamiento conserva datos y borrador.
- Cada fila recibe un ID nuevo. Los IDs del archivo sirven para detectar coincidencias, no para actualizar registros existentes.
- El borrador recuerda el escenario de destino y la versión de sus datos. Cancelar, cambiar de vista/escenario o terminar una lectura antigua no puede insertar en otro destino.
- Lector XLSX local en Worker, dependencia oficial fija y vendorizada; límites de tamaño, filas/columnas y tiempo, cancelación y errores explícitos. Fórmulas aportan únicamente su valor guardado con aviso; no se evalúan ni se siguen enlaces.

### Duplicación

- Acción Duplicar en captura y tabla de movimientos personales, incluida cualquier simulación.
- Abre un borrador en el modal individual; muestra el tipo original, datos editables y botón Agregar copia. Abrir/cancelar no añade registros.
- La fecha original permanece visible. Si es anterior a hoy, se solicita elegir una nueva fecha; no se desplaza silenciosamente.
- La copia conserva los datos válidos que no se cambien, recibe otro ID y deja intacto el original. Traspasos mantienen un solo registro con sus dos cuentas.
- Las copias se validan y persisten atómicamente en el escenario de origen del borrador. Cambios de contexto invalidan el envío.

### Escenarios guardados

- Base personal permanece como escenario principal. Hasta 10 simulaciones, nombres únicos de 1–60 caracteres, ID estable e independiente del nombre.
- Crear desde Base o desde el escenario actual, duplicar, renombrar, cambiar y eliminar una simulación. Base no se renombra ni se elimina con estas acciones.
- Cada simulación conserva una copia profunda de cuentas, saldos y movimientos, con fecha de creación/actualización. Los IDs internos se conservan para mantener relaciones; la identidad efectiva incluye el escenario.
- Toda captura, importación, duplicación, edición, eliminación y retirada de banco afecta solo al escenario activo. La demo continúa siendo temporal y separada.
- Se restaura el último escenario personal activo al recargar; la página sigue abriendo con Ver ejemplo, como antes. Al elegir Crear mi proyección se muestra ese escenario.
- Comparación contra Base bajo el mismo día actual, horizonte y opción de movimientos por confirmar. Incluye saldo inicial, saldo mínimo/fecha, saldo final, primer faltante y diferencias contra Base. Los filtros de la tabla no modifican la comparación.
- Usar como Base es una acción explícita con resumen y confirmación. Reemplaza bancos y movimientos de Base por la simulación y guarda primero una copia de la Base anterior dentro de la misma escritura atómica. Si no hay espacio para otro escenario o falla el almacenamiento, no cambia nada.
- Selección, filtros, editores e importaciones se reinician al cambiar de contexto. Un formulario de captura pendiente requiere confirmar que se descarta al cambiar de escenario.
- Deshacer sigue disponible cinco segundos y se vincula al escenario de origen; cambiar de escenario no reinicia su plazo ni permite restaurar en otro. Solo se muestran alertas del contexto activo.
- Vaciar una proyección con escenarios guardados vacía únicamente el escenario activo y conserva los demás; el texto de confirmación identifica el destino.

## Persistencia e invariantes

La clave `ivanTreasuryProjectionV2` conserva en su raíz `accounts` y `movements` de Base para compatibilidad. Cuando hay simulaciones incorpora `savedScenarios`, `activeScenarioId` y `scenarioVersion: 1`. Sin simulaciones conserva la forma anterior. Una sola escritura precede a cada cambio de memoria. Escenarios con estructura inválida no se sobrescriben automáticamente.

- Los datos anteriores siguen siendo Base, sin pérdida de IDs, centavos, bancos opcionales, categorías ni traspasos.
- Los traspasos conservan efecto consolidado cero.
- Cancelar, fallo de lectura, validación o guardado no altera cuentas ni movimientos.
- Ningún archivo o dato financiero se envía a un servidor para importarlo, exportarlo o comparar escenarios.
- La copia automática de Base no es un respaldo fuera del navegador ni una sincronización.

## Criterios de aceptación

| ID | Criterio |
| --- | --- |
| I1 | Leer nuestro Excel exportado y un XLSX comprimido normal, elegir hoja y conservar fechas/centavos. |
| I2 | Pegar TSV/CSV con comillas, separadores y saltos de línea; reconocer encabezados y permitir corregirlos. |
| I3 | Mostrar errores y duplicados; confirmar solo filas seleccionadas; persistir de forma atómica con IDs nuevos. |
| I4 | Cancelar, caducar una lectura o cambiar de escenario no importa en un contexto diferente. |
| D1 | Duplicar abre borrador; cancelar no crea nada y guardar añade una copia válida sin cambiar el original. |
| S1 | Crear/duplicar escenarios no comparte referencias ni modifica Base; operaciones posteriores quedan aisladas. |
| S2 | Guardar y recargar conserva Base, simulaciones y escenario activo; carga anterior sigue compatible. |
| S3 | Comparaciones iguales dan diferencia cero; cambios de fechas/importes se reflejan con horizonte y pendientes comunes. |
| S4 | Usar como Base genera la copia anterior y reemplaza Base en una única operación; fallo conserva todo. |
| S5 | Eliminar/renombrar/vaciar respetan el escenario elegido; Deshacer nunca cruza escenarios ni amplía cinco segundos. |
| U1 | Importación, escenarios y duplicación operables con teclado y en vista compacta; errores y destino visibles. |

## Verificación proporcional

Conservar las 95 pruebas de la aplicación y 9 del exportador. Añadir contratos del lector/formatos y del aislamiento, persistencia, importación atómica y duplicación. Verificar sintaxis, IDs/ARIA y diferencias del código. Chrome con archivos/datos ficticios: importar, pegar, duplicar, crear/cambiar/comparar/aplicar/recargar escenarios y vista compacta. Publicar preservando los archivos remotos no modificados; comprobar GitHub Pages y la versión pública.
