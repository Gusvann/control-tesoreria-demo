# Formato contable de cantidades monetarias

Fecha: 26 de octubre de 2026. Base publicada: `81f1a600e020badbac787d0819c01c2f8dc9b086`.

## Solicitud y alcance

Aplicar formato contable a los campos y cifras monetarias del proyecto: saldos bancarios, captura, edición y duplicación, indicadores, detalle, selección, categorías, revisión de importación, comparación de escenarios y Excel exportado.

- MXN: coma de miles y punto decimal; dos decimales visibles. Ejemplo: `$1,234.50`.
- Negativos calculados y salidas en las filas de movimientos: paréntesis, por ejemplo `($1,234.50)`, sin añadir otro signo. Los pagos siguen almacenándose como importes positivos con su tipo separado.
- Cero monetario: `$—`. Un campo de captura vacío permanece vacío; no equivale a cero.
- Campos editables con símbolo de moneda separado a la izquierda, cifras a la derecha y teclado decimal en teléfono. Durante la edición se permite escribir el número sin separadores; al salir se aplica el formato.
- Los saldos bancarios válidos se guardan al terminar la edición. Un texto inválido, agrupación incorrecta, importe negativo, milésimas o fallo de almacenamiento conserva los datos anteriores y el borrador; nunca se convierte en cero silenciosamente.
- Pegado de cantidades MXN: `1234.5`, `1,234.50`, `$1,234.50` y `MXN 1,234.50` conservan el mismo número. No se adivinan separadores europeos ambiguos.
- Valores anteriores con precisión o rango no admitidos se conservan sin redondear al cargar, enfocar o editar otros campos.
- La gráfica mantiene abreviaturas para millones, con dos decimales y el mismo criterio de negativos; sus indicadores y tablas muestran la cantidad completa.
- Excel conserva celdas numéricas, valores y signos originales; cambia el formato monetario a contabilidad con secciones positiva, negativa, cero y texto.
- Fechas, porcentajes, conteos, horizonte, números de fila/columna y paginación conservan su formato. La vista del archivo de origen conserva el texto original para revisar errores.

## Invariantes

No cambia la moneda, los cálculos, los IDs, la selección, el aislamiento de escenarios ni los valores persistidos por el solo hecho de mostrarlos. Enter en captura sigue conservando el borrador. La importación mantiene sus reglas explícitas de fecha y separador numérico. No hay migración ni escritura automática al abrir la página.

## Criterios de aceptación

1. Capturar, pegar, editar y duplicar `1,234.50` guarda exactamente `1234.5` y vuelve a mostrar dos decimales.
2. Saldos vacíos o inválidos no sobrescriben el último valor guardado; un fallo de almacenamiento no pierde el texto capturado.
3. Los indicadores conservan centavos, los negativos aparecen entre paréntesis y no se produce cero negativo ni doble signo.
4. Editar solo fecha/estatus/concepto no redondea un importe anterior intacto.
5. El XLSX exportado mantiene sus cantidades numéricas y puede leerse de vuelta conservando los centavos.
6. El símbolo y las cifras caben en escritorio y vista compacta; el cursor no se reescribe en cada pulsación.
