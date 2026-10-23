# Selección, filtros y edición de movimientos

## Objetivo y alcance

Permitir localizar, seleccionar y editar la fecha y el **estatus** (`confirmed` / Confirmado, `pending` / Por confirmar) de movimientos existentes, individualmente y en lote. Evitar que Enter en los campos de captura envíe o vacíe el formulario accidentalmente.

Base inspeccionada: GitHub `4211a938a89c0ed69dc81c56950583dd86bed7dc`. Aplicación estática HTML/CSS/JavaScript; datos personales exclusivamente en `localStorage`, clave `ivanTreasuryProjectionV2`. El usuario confirmó que «escenario» se refería a estatus.

Fuera de alcance: nuevos escenarios financieros, cambiar importes/conceptos/tipos mediante el editor, conciliación bancaria, backend, autenticación, importación de archivos, refactors de gráfica y cálculos.

## Requisitos y aceptación

| ID | Requisito | Criterio observable |
| --- | --- | --- |
| R1 | Seleccionar movimientos | Casilla por fila y cabecera para todos los resultados visibles; estado parcial y contador; selección por ID, nunca por índice. |
| R2 | Filtrar tabla | Concepto, tipo, estatus, fechas inclusivas y alcance (proyección actual / todos); los indicadores y gráfica no cambian al filtrar. Cambiar filtros, horizonte o modo limpia la selección para evitar ediciones ocultas. |
| R3 | Editar individual | Doble clic en la fila o botón Editar abre un diálogo accesible con valores actuales; casillas/botones de la fila no disparan doble edición. |
| R4 | Editar lote | Editar seleccionados muestra cantidad; solo se modifican campos activados; fechas/estatus distintos se conservan si no se activan. Validación de todo el lote antes de escribir. |
| R5 | Fecha y estatus válidos | Fecha real ISO, desde hoy al cambiarla; únicamente confirmed/pending. Un histórico permite cambiar solo estatus sin mover su fecha. IDs inexistentes o duplicados impiden guardar. |
| R6 | Persistencia y cálculo | En personal, preparar candidato y escribir una vez antes de actualizar memoria; si falla el almacenamiento, conservar datos y mostrar error. Recargar conserva los cambios. Recalcular gráfica, métricas y lista de captura después de guardar. |
| R7 | Cancelación y accesibilidad | Cancelar/Escape no modifica datos; foco inicial dentro del modal y restaurado al cerrar; alternativa táctil y de teclado para editar. |
| R8 | Captura y Enter | Enter en un input de captura conserva todos los valores y no agrega registros. Agregar movimiento continúa como acción explícita; si falla validación/guardado, conserva el borrador. |
| R9 | Ejemplo separado | Permitir probar edición en demo en memoria durante la sesión, sin tocar la proyección personal; comunicar que sus cambios son temporales. |

## Invariantes

- Mantener IDs, conceptos, tipos, importes, cuentas, saldos iniciales y movimientos no seleccionados.
- Seleccionar no confirma, elimina ni excluye movimientos de la proyección.
- Mantener el horizonte inclusivo desde hoy y el interruptor global de pendientes para cálculos.
- Conservar movimientos históricos y fuera del horizonte; ofrecer alcance Todos para editarlos.
- Conservar la clave y el esquema de persistencia existente; no requiere migración.
- No transmitir datos financieros a servidores, pruebas, capturas ni al repositorio. Pruebas solo con datos sintéticos.
- Cancelar o fallar validación/almacenamiento no produce cambios parciales.

## Diseño mínimo e impacto

Conservar `getFilteredMovements()` como entrada de cálculos. Añadir filtros exclusivos de tabla, `Set` de selección y editor compartido individual/lote. Mantener parches de demo separados en memoria. Usar un `<dialog>` nativo, validación de fechas reales y cambios limitados a date/status. La captura intercepta Enter en inputs; se mantiene la activación por teclado del botón de envío.

Archivos de implementación: `app.js`, `index.html`, `styles.css`. Documentación y pruebas acompañan el cambio. Ninguna dependencia de ejecución adicional.

## Plan de demostración

1. Pruebas Node del contrato de edición, filtros, selección, límite del horizonte, históricos, duplicados, cancelación y almacenamiento rechazado.
2. Verificar sintaxis de JavaScript y consistencia de IDs y enlaces de los controles HTML.
3. Navegador: selección parcial/todos, doble clic, lote de fecha/estatus, cancelar/Escape, captura con Enter, persistencia al recargar y datos de ejemplo separados.
4. Revisión independiente buscando regresiones y cambios fuera de alcance.
5. Registrar evidencia real con etiquetas VERIFICADO / INFERIDO / NO VERIFICADO / NO APLICA y enlazar requisito → prueba. Build y typecheck no aplican a esta aplicación sin compilación ni TypeScript.
