# Ampliación de tesorería: categorías, traspasos y operación diaria

Base: `317cf73d8d57057e66b2f42fa2270cf46bb6526e`. Fecha de definición: 25 de octubre de 2026.

## Objetivo y alcance

Extender la proyección hasta 90 días; organizar pagos por categorías; permitir traspasos programados; mejorar corrección, selección, exportación, recuperación tras borrar y uso en teléfono/zoom. Mantener la aplicación estática y los datos exclusivamente en el navegador.

Se planteó al usuario la diferencia entre traspasos programados y actualización inmediata de saldos. No se recibió selección en el control de pregunta; se comunicó la opción conservadora adoptada: **programados**, con fecha, origen y destino, sin modificar saldos iniciales ni el efectivo consolidado. Los horizontes 2/3 meses equivalen a 60/90 días y se explican en la interfaz.

Fuera de alcance: cierre diario/fecha de corte, registrar pagos efectivamente ejecutados, conciliación, autenticación/backend, cobros asignados a banco, proyección completa por cuenta, recurrencias, respaldo/restauración e importación de archivos. Exportar Excel no constituye un respaldo completo.

## Requisitos y aceptación

| ID | Requisito | Criterio de aceptación |
| --- | --- | --- |
| E1 | Horizonte | Opciones 7 días, 14 días, 30 días, 2 meses y 3 meses, con valores 7/14/30/60/90. El límite inclusivo existente se conserva. Gráfica y selección responden a cada horizonte. |
| E2 | Categorías | Pagos admiten Costos, Gastos, Nómina, Financieros, Impuestos y Otros. Sin categoría es válido. Captura, edición individual/lote y filtro permiten asignar o quitar. Debajo de movimientos se muestran grupos de los pagos filtrados; Sin categoría siempre es el último y nunca se omiten pagos por faltar categoría. |
| E3 | Centavos | Importe del movimiento, editor, captura, bancos, totales seleccionados, categorías y Excel presentan dos decimales. La gráfica y KPIs conservan su formato compacto/entero donde ya se utiliza. |
| E4 | Excel | Descargar .xlsx real para resultados filtrados, seleccionados o todos. Una fila por movimiento, incluidos traspasos una sola vez; campos de banco/categoría/origen/destino; importe y fecha tipados; conceptos que empiezan con símbolos de fórmula permanecen texto. No se envían datos a servidores. |
| E5 | Traspasos programados | Tipo Traspaso con fecha, concepto, importe positivo, estatus y dos cuentas existentes distintas. El importe sale del origen y entra al destino en el resumen de traspasos del período. Efecto consolidado cero; no aumenta cobros, pagos ni categorías. Saldos iniciales intactos. Individual permite corregir concepto/importe/cuentas; lote solo campos compatibles. |
| E6 | Retirar banco | Acción explícita por banco abre modal con saldo inicial, cantidad/importe nominal de traspasos vinculados y pagos asignados. Último banco no se retira. Mientras haya traspasos vinculados se indica que deben reasignarse o eliminarse antes; no se producen referencias de traspaso incompletas. Pagos sobreviven a la retirada como Banco no disponible. Persistir antes de modificar memoria. |
| E7 | Teléfono/zoom | La tabla de movimientos usa tarjetas en pantallas pequeñas, con casilla, concepto, importe y acción juntos. No hay duplicación de registros/checkboxes. Grids pueden contraerse sin desbordar la página; conservar labels, selección visible y navegación por teclado. |
| E8 | Deshacer 5 s | Cada eliminación individual persistida muestra una alerta flotante con Deshacer durante 5 segundos. Cada borrado tiene plazo independiente. Restaurar reinserta el mismo ID en los datos actuales, sin deshacer otras ediciones. Vencimiento, ID ya existente, cuentas de traspaso inexistentes o fallo de almacenamiento no producen cambios parciales. |
| E9 | Total seleccionado | Mostrar cobros, pagos, traspasos y neto de las filas seleccionadas. Traspasos se suman una vez en su apartado y tienen efecto neto cero. Cambio de filtros/horizonte limpia selección como antes. |
| E10 | Filtro por banco | Filtrar por cuenta incluye pagos asignados y traspasos donde participa como origen o destino. Pagos sin banco y Banco no disponible tienen opciones propias. Los filtros solo afectan tabla, selección, agrupación y exportación de resultados; no alteran KPIs/proyección. |
| E11 | Edición individual | Modal permite concepto de 1–70 caracteres e importe positivo con hasta dos decimales. Solo una fila; se rechazan cambios masivos de estos campos. Fecha, estatus, banco y categoría mantienen las reglas de campos activados y validación atómica. |

## Invariantes y contratos

- La clave de persistencia permanece `ivanTreasuryProjectionV2`. Datos anteriores sin categoría/banco siguen siendo válidos, sin migración destructiva.
- Pagos usan `categoryId` opcional con claves estables: costos/gastos/nomina/financieros/impuestos/otros; ausente o vacío significa Sin categoría. Cobros y traspasos no llevan categoría de gasto.
- Traspaso es **un movimiento** `type: transfer`, con `fromBankId`, `toBankId`, importe positivo y campos comunes. No se generan dos movimientos independientes ni se modifica un saldo bancario capturado.
- El resumen bancario añade Traspasos netos y Saldo tras traspasos: saldo inicial más entradas menos salidas por traspasos incluidos. La interfaz aclara que esta columna ajusta solo traspasos, no es una proyección completa de cobros/pagos por banco.
- IDs estables, asignaciones por ID, etiquetas escapadas y ninguna transmisión de información financiera. Excel usa cadenas explícitas, sin fórmulas generadas desde datos capturados.
- Cambiar categoría/banco/concepto no modifica importes ni fechas. Un histórico conserva su fecha cuando solo se cambia otro campo. Una nueva fecha sigue siendo hoy o posterior.
- Operaciones nuevas, eliminación/restauración y retiro de bancos persisten candidato antes de cambiar memoria. Cancelar o fallo no modifica datos. Restablecer toda la proyección conserva su confirmación y elimina notificaciones de deshacer pendientes.
- Enter en inputs conserva el borrador, incluidos categoría/cuentas. El botón explícito continúa siendo la acción de alta.

## Diseño mínimo e impacto

Ampliar el estado y funciones existentes en `app.js`; añadir controles y CSS responsive en `index.html`/`styles.css`. Exportador independiente `excel-export.js` que produce OOXML/ZIP en memoria y se descarga mediante Blob; sin dependencias externas. Toasts de deshacer mantienen cada registro/index/plazo en un Map temporal. La retirada usa un diálogo nativo con impacto y restricciones explícitos.

## Plan de demostración

1. Mantener las 60 pruebas anteriores y ampliar contratos de horizonte, categorías legacy, filtros/selección, neutralidad de traspasos, cuentas inválidas, edición masiva prohibida, retirada y deshacer concurrente/caducado/fallo de almacenamiento.
2. Verificar .xlsx mediante pruebas del escritor y lector independiente: ZIP válido, XML, tipos, precisión, caracteres especiales y texto similar a fórmulas.
3. Verificar sintaxis, IDs/labels/ARIA y diff. No hay compilación ni TypeScript.
4. Chrome con datos ficticios: captura/edición/categorías/traspasos, selección y exportación, eliminación/restauración, retirada e impacto, y vistas adaptables mediante las capacidades disponibles. Registrar por separado lo no verificable en dispositivo físico o Excel de escritorio.
5. Revisión independiente y evidencia requisito → implementación → prueba → resultado. Publicación solo después de verificar el incremento y conservar el resto del árbol remoto.
