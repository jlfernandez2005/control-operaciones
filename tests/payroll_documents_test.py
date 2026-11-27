"""Synthetic fixtures only. No real employee data in the repository."""
import unittest,sys,io,base64,zipfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from payroll_io import Book,parse,metadata,export
from openpyxl import Workbook,load_workbook

def xlsx():
    w=Workbook();s=w.active;s.title='CALCULO';s.append(['Periodo : 11/2026']);s.append(['No.','DNI','CARGO','BANCO','BASE','COMPUTABLE','REMUNERACION','DESCUENTO','PAGAR','DEPOSITAR','C']); # intentionally invalid structure, standard sheet below
    a=w.create_sheet('Noviembre');a.append(['Periodo : 11/2026']);a.append(['codigo','nombre','cargo','area','banco','sistema pensionario','sueldo base','bruto','descuentos','neto','deposito','essalud']);a.append(['EMP001','=1+1','Docente','Académica','Scotiabank','ONP',1500,1600,208,1392,1392,144]);a['B3'].data_type='s';a.append(['EMP002','Persona ficticia','Administrativo','Gestión','BBVA','AFP',1000,1000,100,900,900,90]);b=w.create_sheet('Auxiliar');b.append(['codigo','concepto','monto','unidades','nota']);b.append(['EMP001','Préstamo otorgado',500,'5 cuotas','Prueba']);buf=io.BytesIO();w.save(buf);return {'name':'test.xlsx','data':base64.b64encode(buf.getvalue()).decode()}
class TestPayroll(unittest.TestCase):
    def test_selected_sheet_and_month(self):
        p=xlsx();b=Book(p);d=parse(b,{**p,'sheet':'Noviembre','period':'2026-11','kind':'planilla'});self.assertEqual(len(d['rows']),2);self.assertEqual(sum(r['deposit'] for r in d['rows']),229200);self.assertEqual(metadata(b.rows('Noviembre',True))['period'],'2026-11');self.assertRaises(ValueError,parse,b,{**p,'sheet':'Noviembre','period':'2026-10','kind':'planilla'})
    def test_auxiliary_no_cash_total(self):
        p=xlsx();b=Book(p);d=parse(b,{**p,'sheet':'Auxiliar','period':'2026-11','kind':'prestamos'});self.assertEqual(d['rows'][0]['components'][0]['cents'],50000);self.assertEqual(d['rows'][0]['gross'],0)
    def test_csv_and_signature(self):
        p={'name':'test.csv','data':base64.b64encode(b'codigo,concepto,monto\nEMP001,AFP,150.25\n').decode()};self.assertEqual(parse(Book(p),{**p,'sheet':'CSV','period':'2026-11','kind':'afp'})['rows'][0]['components'][0]['cents'],15025);self.assertRaises(ValueError,Book,{**p,'name':'bad.xlsx'})
    def test_reports_literal_cells_and_pdf(self):
        p=xlsx();d=parse(Book(p),{**p,'sheet':'Noviembre','period':'2026-11','kind':'planilla'});rows=[{**r,'period':d['period'],'kind':d['kind']} for r in d['rows']];g={k:sum(r[k] for r in rows) for k in ['gross','discount','net','deposit','essalud','base']};payload={'period':'2026-11','group':'bank','rows':rows,'groups':[{'label':'Todos','count':2,**g}],'concepts':[],'detail':True};out=export(payload,'xlsx');wb=load_workbook(io.BytesIO(out));self.assertEqual(wb['Detalle']['D4'].value,'=1+1');self.assertEqual(wb['Detalle']['D4'].data_type,'s');self.assertTrue(export(payload,'pdf').startswith(b'%PDF'))
if __name__=='__main__':unittest.main()
