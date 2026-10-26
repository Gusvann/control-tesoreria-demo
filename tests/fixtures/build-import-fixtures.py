"""Regenerate synthetic importer fixtures with the independent XlsxWriter writer.

This optional helper is not used by the browser or the Node test suite. No
personal data or remote inputs are used. Run from any working directory.
"""
from datetime import datetime
from pathlib import Path
import xlsxwriter

folder = Path(__file__).resolve().parent

with xlsxwriter.Workbook(folder / "import-normal.xlsx") as book:
    book.set_properties({"title": "Synthetic treasury import fixture", "created": datetime(2026, 10, 26)})
    dates = book.add_format({"num_format": "dd/mm/yyyy"})
    money = book.add_format({"num_format": '"MXN" #,##0.00'})
    sheet = book.add_worksheet("Pagos y nómina")
    sheet.write_row(0, 0, ["Concepto", "Fecha", "Importe (MXN)", "Tipo", "Estatus", "Banco", "Categoría", "ID"])
    sheet.write_string(1, 0, "Nómina Águila & asociados <A>")
    sheet.write_datetime(1, 1, datetime(2026, 10, 26), dates)
    sheet.write_number(1, 2, 45000.50, money)
    sheet.write_row(1, 3, ["Pago", "Por confirmar", "Banco A", "Nómina", "src-001"])
    sheet.write_string(2, 0, '=HYPERLINK("https://invalid.example", "texto")')
    sheet.write_datetime(2, 1, datetime(2026, 10, 27), dates)
    sheet.write_number(2, 2, 0.01, money)
    sheet.write_row(2, 3, ["Pago", "Confirmado", "", "", "src-002"])
    sheet.write_string(3, 0, "Importe calculado")
    sheet.write_datetime(3, 1, datetime(2026, 10, 28), dates)
    sheet.write_formula(3, 2, "=1200.25+34.25", money, 1234.50)
    sheet.write_row(3, 3, ["Pago", "Confirmado", "Banco A", "Gastos", "src-003"])
    sheet.write_string(4, 0, "Error de fórmula")
    sheet.write_datetime(4, 1, datetime(2026, 10, 29), dates)
    sheet.write_formula(4, 2, "=1/0", money, "#DIV/0!")
    sheet.write_row(4, 3, ["Pago", "Confirmado", "", "", "src-004"])
    sheet.write_url(5, 0, "https://invalid.example/never-request", string="Proveedor con enlace")
    sheet.write_datetime(5, 1, datetime(2026, 10, 30), dates)
    sheet.write_number(5, 2, 99.99, money)
    sheet.write_row(5, 3, ["Pago", "Confirmado", "Banco B", "Costos", "src-005"])
    transfers = book.add_worksheet("Traspasos")
    transfers.write_row(0, 0, ["Fecha", "Concepto", "Tipo", "Estatus", "Importe", "Banco origen", "Banco destino"])
    transfers.write_datetime(1, 0, datetime(2026, 10, 28), dates)
    transfers.write_row(1, 1, ["Entre cuentas", "Traspaso", "Confirmado", 1250.75, "Banco A", "Banco B"])
    hidden = book.add_worksheet("Auxiliar")
    hidden.write_string(0, 0, "Hoja auxiliar sintética")
    hidden.hide()

with xlsxwriter.Workbook(folder / "import-1904.xlsx", {"date_1904": True}) as book:
    book.set_properties({"title": "Synthetic 1904 epoch fixture", "created": datetime(2026, 10, 26)})
    dates = book.add_format({"num_format": "yyyy-mm-dd"})
    sheet = book.add_worksheet("Fechas 1904")
    sheet.write_row(0, 0, ["Fecha", "Concepto", "Importe"])
    sheet.write_datetime(1, 0, datetime(2028, 2, 29), dates)
    sheet.write_row(1, 1, ["Día bisiesto", 0.01])
    sheet.write_number(2, 0, 0, dates)
    sheet.write_row(2, 1, ["Inicio del sistema 1904", 999999.99])

print("Synthetic XLSX fixtures generated with XlsxWriter", xlsxwriter.__version__)
