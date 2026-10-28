# Correcciones de interfaz de Forecast minimalista

Base auditada: `8de447dd68534a246e1d2cfe608dc222ca7ffc01`. Fecha: 28 de octubre de 2026.

## Objetivo y alcance

Resolver los diez fallos reproducidos en la auditoría de diseño y los tres riesgos de adaptación a pantalla identificados en el código. Mantener la aplicación estática, su identidad visual y la arquitectura actual. Repositorio único: `Gusvann/forecast-minimalista` (ID 1143020541).

## Invariantes

- No cambiar cálculos de saldos, proyección, horizontes, movimientos, traspasos, categorías ni escala financiera.
- Conservar `ivanTreasuryProjectionV2`, esquema e IDs, escenarios, separación entre ejemplo y datos personales, importación atómica y exportación.
- Persistir los cambios válidos antes de cambiar el estado; un borrador vacío o fallido no puede perder el valor anterior.
- No enviar información financiera a servidores ni incorporar dependencias.
- Fechas guardadas e importadas siguen en ISO; el año adicional es presentación.
- La selección automática de importación sigue excluyendo posibles duplicados.
- Los nombres vacíos ya guardados reciben la etiqueta de presentación «Banco sin nombre». Renderizar o salir de ese texto intacto no migra datos ni cambia los nombres exportados.

## Requisitos y aceptación

| ID | Problema | Resultado aceptable |
| --- | --- | --- |
| UI1 | Concepto largo desborda una alerta del panel | Un concepto válido de 70 caracteres sin espacios se contiene y puede leerse completo, sin ampliar la página. |
| UI2 | Error de saldo permanece al cancelar el borrador | Después de un saldo inválido, vaciar y salir restaura el saldo anterior, limpia el error de ese saldo y no escribe ni borra errores de otras operaciones. |
| UI3 | Históricos de distintos años son indistinguibles | Tabla, captura y grupos de categorías muestran el año. Las etiquetas cortas de la gráfica permanecen legibles. |
| UI4 | Texto con contraste insuficiente | Egresos, errores, ejes y texto secundario alcanzan 4.5:1 respecto de su fondo; los colores decorativos pueden conservarse. |
| UI5 | Interruptor sin foco visible | El foco de teclado se ve en la pista del interruptor; el indicador tiene contraste de al menos 3:1. |
| UI6 | Nombres vacíos o de espacios producen cuentas sin etiqueta | Escribir es un borrador. Al confirmar la salida, se recortan espacios y se conserva el límite de 50 caracteres. Vacío cancela; fallo de persistencia restaura lo guardado. Input, estado y selectores concuerdan después del cierre del borrador. |
| UI7 | Mínimo de hoy se describe incorrectamente como saldo inicial | El texto describe el saldo estimado de hoy cuando la proyección incluye movimientos de hoy. |
| UI8 | Foco del importador no pasa al nuevo paso | Tras mostrar y habilitar Columnas, el foco llega a su primer control; Revisar recibe un foco válido y los errores conservan un destino accesible. Cancelar una lectura pendiente no enfoca un diálogo cerrado. |
| UI9 | Inicio vacío atribuido a filtros inexistentes | Un escenario sin registros invita a agregar o importar; una búsqueda o período sin resultados conserva instrucciones para ajustar filtros. |
| UI10 | Acción de importación oculta que excluye duplicados | El botón dice «Seleccionar válidas sin duplicados» y la ayuda explica qué ocurre con duplicados seleccionados manualmente. La política no cambia. |
| R1 | SVG deforma texto y círculos en pantallas estrechas | Geometría y viewBox mantienen la proporción real del contenedor, con etiquetas adaptadas al ancho y sin cambiar cifras. Redimensionar solo actualiza la gráfica. |
| R2 | Acciones de captura ocupan el ancho del texto en 320 px | En pantalla estrecha, texto, importe y las tres acciones disponen de espacio mediante apilado o ajuste de línea; no se ocultan acciones. |
| R3 | Modal de importación deja casi sin contenido en paisaje | En poca altura, contenido y botones son alcanzables por desplazamiento, sin bloquear la navegación por teclado. |

## Diseño mínimo e impacto

Cambios limitados a `app.js`, `styles.css`, `index.html`, regresiones de `tests/` y esta documentación. Separar el formato de fecha operacional del eje de la gráfica. Cerrar los borradores de nombres al salir del campo para evitar que normalizar interrumpa la escritura. Mantener errores de banco asociados al campo. Aplicar el foco del importador una vez completado su render final. Calcular las dimensiones de dibujo a partir del SVG y actualizar únicamente la gráfica ante cambios de tamaño.

Fuera de alcance: backend, conciliación o cambios contables; renovación visual general; redacción histórica de README; duración de Deshacer; rename de otros repositorios.

## Plan de verificación

1. Confirmar que el árbol remoto y la copia de trabajo coinciden por SHA de blob; ejecutar la suite previa antes de editar.
2. Añadir pruebas de los estados defectuosos, cancelación y almacenamiento fallido, fechas, foco, duplicados y geometría. Mantener las regresiones financieras, de escenarios, importador y exportador.
3. Comprobar sintaxis, diferencias completas, contraste calculado y CI del commit que se publica.
4. Reproducir en la página publicada los estados accesibles desde el navegador autorizado y capturar evidencia visual.
5. Distinguir VERIFICADO, INFERIDO y NO VERIFICADO. La inspección de CSS y las pruebas de geometría no equivalen a una prueba visual en un dispositivo móvil; declarar esa limitación si la herramienta no permite cambiar el viewport.
