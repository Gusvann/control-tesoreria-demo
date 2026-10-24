# Banco opcional en los pagos

## Objetivo y alcance

Permitir que cada pago indique uno de los bancos registrados o se guarde sin banco. Ampliación de la captura y del editor individual/lote existentes, sobre la versión `0eadd7902898bfabe85d5cbd1824910dc1fc34ba`.

El campo se llama **Banco (opcional)**. Su valor inicial es **Sin banco asignado**. La edición en lote del banco está disponible cuando todos los movimientos seleccionados son pagos. Fecha y estatus mantienen su comportamiento anterior para cualquier selección.

Fuera de alcance: asignación de cobros, filtros nuevos, saldos/proyección por banco, transferencias, conciliación, ejecución de pagos, cambios de arquitectura o refactor de la gestión de bancos.

## Aceptación

| ID | Requisito | Criterio observable |
| --- | --- | --- |
| B1 | Captura opcional | Elegir Pago muestra Banco (opcional); guardar con Sin banco asignado crea un pago válido. Elegir un banco guarda su ID. El campo nunca es obligatorio. |
| B2 | Edición | Un pago permite asignar, cambiar o quitar banco. En lote de pagos solo se cambia si se activa Cambiar banco; una selección con cobros no permite ese campo. Cancelar no guarda. |
| B3 | Persistencia compatible | Los pagos anteriores sin bankId siguen cargando y editándose. La asignación se conserva al recargar, con la misma clave localStorage; no requiere migración. |
| B4 | Identidad y visualización | Mostrar el banco bajo el concepto y en la lista de captura. Referenciar account.id: renombrar actualiza la etiqueta; eliminar un banco conserva el pago y su referencia como Banco no disponible, sin reasignarlo por posición. Se puede quitar o cambiar esa referencia. |
| B5 | Validación y atomicidad | Vacío siempre válido para pagos. Una nueva asignación no vacía debe corresponder a un único banco existente. Validar todo el lote antes de escribir; error de almacenamiento conserva datos y borrador. |
| B6 | Invariantes | Asignar banco no altera fecha, estatus, concepto, importe, ID, saldos ni cálculos. Enter en un input conserva también el banco del borrador. El modo demo mantiene sus cambios solo en memoria. |

## Diseño e impacto

- Añadir `bankId` opcional en movimientos de tipo `outflow`; ausente y cadena vacía representan Sin banco asignado. Los cobros no reciben asignaciones bancarias.
- Resolver nombres desde las cuentas actuales; no copiar nombres dentro del pago. Preservar referencias huérfanas ya guardadas para no modificar datos silenciosamente. En captura, retirar de las opciones un banco eliminado deja el borrador sin banco.
- Ampliar la lista de campos permitidos del editor a date/status/bankId. Comparar ausencia y vacío como equivalentes, evitando cambios artificiales y permitiendo editar fecha/estatus de pagos cuyo banco ya no existe.
- Usar selectores nativos sin required. No añadir columnas a la tabla ni dependencias.
- Implementación: `app.js`, `index.html`, `styles.css`. Guía en `README.md`; pruebas de contrato en `tests/movements.test.cjs`.

## Verificación prevista

Pruebas Node de captura vacía/asignada, recarga compatible, asignar/cambiar/quitar, lotes y guardado atómico, identidad tras renombrar/eliminar, Enter y cálculos intactos. Navegador con datos sintéticos: captura con/sin banco, edición y recarga, revisión visual. Revisar sintaxis, referencias HTML y diferencias. Documentar resultados observados y límites sin confundir revisión estática con pruebas de navegador.
