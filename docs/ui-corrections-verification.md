# Verificación de las correcciones de interfaz

Fecha: 28 de octubre de 2026. Especificación: [ui-corrections-spec.md](ui-corrections-spec.md).

## Base y alcance de la evidencia

La copia de trabajo se reconstruyó desde `8de447dd68534a246e1d2cfe608dc222ca7ffc01`. Los 29 archivos descargados de código, documentación, dependencias locales y fixtures coinciden por SHA de blob con el árbol remoto. Los recursos gráficos existentes se conservan mediante el árbol base al crear el commit.

Antes de editar pasaron **211 casos**: contabilidad 11, Excel 12, movimientos 158 e importación 30. El ejecutor local usa Node 24.22.1; GitHub Actions configura Node 22. `node --test tests/*.test.cjs` puede presentar los cuatro archivos como unidades; el total de casos se obtiene ejecutando cada archivo individualmente.

Después de las correcciones pasan **234/234 casos**: contabilidad 11, Excel 12, movimientos 181 e importación 30. Se añadieron 23 casos. Al ejecutar exactamente esas regresiones contra el código base en una copia aislada, los 158 casos previos de movimientos siguen pasando y 20 casos nuevos fallan; los otros tres protegen comportamientos que ya eran correctos. Esto demuestra detección de los defectos sin exigir cambios a la lógica contable.

## Cobertura de regresión

| Requisito | Evidencia automatizada o inspección | Límite |
| --- | --- | --- |
| UI1 | `minmax(0, 1fr)`, ancho mínimo cero y división de palabras en el contenido de las alertas | La contención final se comprueba con el concepto de 70 letras en la página publicada. |
| UI2 | Borrador inválido → vacío, saldo anterior intacto, cero escrituras y mensajes de otras operaciones conservados | El adaptador DOM prueba eventos delegados; no sustituye eventos nativos del navegador. |
| UI3 | Dos pagos del mismo día y mes de 2025/2026 se distinguen en tabla, captura y grupos; ISO intacto | Las etiquetas del eje usan el formato corto separado. |
| UI4 | Cálculo de luminancia de colores declarados, incluidos fondos de selección | No es una auditoría completa de todas las combinaciones de la aplicación. |
| UI5 | El contorno del interruptor se aplica a la pista visible; contraste calculado | La aparición de `:focus-visible` se comprueba con teclado en la página publicada. |
| UI6 | Borradores sin escrituras, espacios/vacío, límite, fallo de almacenamiento, escenario obsoleto y nombres heredados | Las filas existentes se actualizan por `textContent`; la geometría de un clic requiere navegador. |
| UI7 | Pago de hoy reduce el mínimo y el texto deja de llamarlo saldo inicial; caso sin movimientos conserva su significado | No cambia el cálculo de la serie. |
| UI8 | El adaptador respeta controles/ancestros ocultos, deshabilitados y diálogos cerrados; transición, error, reintento y lectura cancelada | No modela el atrapamiento nativo del foco ni las dimensiones de un diálogo. |
| UI9 | Inicio sin registros frente a filtro sin coincidencias | La proyección mantiene sus filtros y horizontes. |
| UI10 | Selección automática excluye duplicados, incluso seleccionados manualmente; texto y ayuda explican el resultado | No modifica validación ni confirmación de importación. |
| R1 | Dimensiones estrechas y amplias, `viewBox` proporcional, menos etiquetas, posiciones dentro del lienzo; resize conserva estado y captura | Las pruebas geométricas no miden el ancho real de las letras ni sustituyen un dispositivo móvil. |
| R2 | Una columna para captura y acciones con salto de línea hasta 680 px | Inspección de CSS; render móvil pendiente de comprobación visual. |
| R3 | Hasta 480 px de altura, el diálogo completo permite desplazamiento | Inspección de CSS; paisaje móvil pendiente de comprobación visual. |

## Contraste verificado por cálculo

| Elemento | Blanco | Canvas `#f4f6f9` | Selección `#e4eeff` |
| --- | ---: | ---: | ---: |
| Texto rojo `#b13e42` | 5.774:1 | 5.333:1 | 4.941:1 |
| Texto secundario/ejes `#58677b` | 5.768:1 | 5.327:1 | 4.936:1 |
| Foco `#184da9` | 7.855:1 | 7.256:1 | 6.723:1 |

Los colores decorativos permanecen separados del texto. El texto blanco al 70 % del KPI oscuro conserva aproximadamente 8.336:1 sobre `#14233b`.

## Comandos reproducibles

```sh
node --check accounting.js
node --check app.js
node --check excel-export.js
node --check treasury-import.js
node --check treasury-import-worker.js
node --test tests/*.test.cjs
node tests/accounting.test.cjs
node tests/excel-export.test.cjs
node tests/movements.test.cjs
node tests/treasury-import.test.cjs
```

## Comprobación en la versión publicada

1. En el ejemplo, editar un concepto de pago con 70 letras sin espacios. Verificar que la señal permanece dentro de la tarjeta y la página no crece horizontalmente. Recargar restaura el ejemplo.
2. En una cuenta de prueba, escribir un saldo inválido, salir, vaciar y salir otra vez: debe volver el saldo previo sin una alerta persistente en captura. Un nombre formado por espacios también debe restaurarse.
3. Usar Tab hasta el interruptor de pendientes y comprobar el contorno visible.
4. Abrir el importador, pegar una tabla ficticia y avanzar: Columnas debe recibir el foco; en Revisar, comprobar el nombre del botón y la exclusión de duplicados sin confirmar la importación.
5. Comprobar año en movimientos, texto de inicio vacío, etiquetas del mínimo y gráfica sin deformación.

Los resultados de CI y de la comprobación publicada se verifican sobre el commit desplegado y se comunican con la entrega. Las comprobaciones de escritorio, geometría y CSS no se presentan como pruebas visuales en teléfono físico. Sin backend o migración de datos, esas verificaciones son **NO APLICA** en este incremento.
