from pathlib import Path

path = Path("app.js")
text = path.read_text(encoding="utf-8")
old = '''    let tickValues = buildTickValues(yMin, yMax, step);
    while (tickValues.length < 4) {
      if (Math.abs(rawMin) > Math.abs(rawMax)) {
        yMin -= step;
      } else {
        yMax += step;
      }
      tickValues = buildTickValues(yMin, yMax, step);
    }

    return { yMin, yMax, step, tickValues, includesZero: true };'''
new = '''    const tickValues = buildTickValues(yMin, yMax, step);
    return { yMin, yMax, step, tickValues, includesZero: true };'''
if old not in text:
    raise SystemExit("No se encontró el bloque de escala pequeña esperado")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
