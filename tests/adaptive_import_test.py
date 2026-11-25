"""Synthetic format variants, without institutional or personal data."""
import sys, unittest, tempfile, os
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.platypus import Table, TableStyle
from reportlab.lib import colors
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from smart_import import detect_pdf, detect_tabular, total_cents

class AdaptiveImportTest(unittest.TestCase):
    def pdf(self,rows):
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/'variant.pdf'
            c=canvas.Canvas(str(path),pagesize=(1000,600));c.drawString(20,560,'OPERACIONES 19 DE NOVIEMBRE 2026')
            table=Table(rows,colWidths=[950/len(rows[0])]*len(rows[0]));table.setStyle(TableStyle([('GRID',(0,0),(-1,-1),.5,colors.black)]));w,h=table.wrap(950,500);table.drawOn(c,20,540-h);c.showPage();c.drawString(30,500,'ANEXO - Factura');c.drawString(30,480,'Total a pagar S/ 999.99');c.save()
            return detect_pdf(path,'variant.pdf')
    def test_dual_currency(self):
        d=self.pdf([['N°Or','Concepto','Comprobante','monto S/','Monto Dólares','Cuenta Bancaria - CCI','Banco Dest.','Empresa / Persona','RUC / DNI'],['1','Servicio A','F001-1','S/ 120.00','$ 30.00','000123','BCP','Proveedor A','01234567'],['2','Servicio B','F001-2','','$ 50.00','000456','BBVA','Proveedor B','20123456789'],['','TOTAL A PAGAR','','120.00','80.00','','','','']])
        self.assertEqual(len(d['rows']),2);self.assertEqual(d['declared'],120);self.assertEqual(d['meta']['declared_usd'],80);self.assertEqual(d['rows'][0]['usd'],30);self.assertIsNone(d['rows'][1]['amount']);self.assertEqual(d['rows'][1]['usd'],50);self.assertEqual(d['rows'][0]['cci'],'000123');self.assertEqual(d['rows'][1]['bank'],'BBVA');self.assertEqual(d['rows'][0]['date'],'2026-11-19')
    def test_reordered_optional(self):
        d=self.pdf([['N°','Beneficiario','Importe en soles','Descripción','Fecha de pago','Nro. comprobante'],['1','A','12,50','Servicio','19/11/2026','B001-1'],['2','B','S/ 30.00','Compra','20/11/2026','B001-2'],['','','42.50','TOTAL GENERAL','','']]);self.assertEqual(len(d['rows']),2);self.assertEqual(total_cents(d['rows']),4250);self.assertEqual(d['declared'],42.5);self.assertEqual(d['rows'][1]['date'],'2026-11-20');self.assertEqual(d['rows'][1]['provider'],'B');self.assertEqual(d['rows'][1]['receipt'],'B001-2');self.assertEqual(d['rows'][1]['bank'],'')
    def test_only_usd(self):
        d=self.pdf([['N°','Concepto','Proveedor','Importe USD'],['1','Servicio','A','USD 20.00'],['','TOTAL A PAGAR','','20.00']]);self.assertEqual(len(d['rows']),1);self.assertIsNone(d['rows'][0]['amount']);self.assertEqual(d['rows'][0]['usd'],20);self.assertEqual(d['meta']['declared_usd'],20)
    def test_tabular_variant(self):
        rows=[['PAGOS 19 DE NOVIEMBRE 2026'],['Descripción','Monto en dólares','Monto (S/)','Beneficiario','N° comprobante'],['Compra',20,80,'A','B001-1'],['TOTAL A PAGAR',20,80,'','']];d=detect_tabular({'name':'Pagos','rows':[{'cells':r,'ref':str(i)} for i,r in enumerate(rows)]},'test.xlsx');self.assertEqual(len(d['rows']),1);self.assertEqual(d['rows'][0]['amount'],80);self.assertEqual(d['rows'][0]['usd'],20);self.assertEqual(d['declared'],80)
    def test_generic_currency_column(self):
        d=self.pdf([['N°','Concepto','Proveedor','Monto','Moneda'],['1','Servicio','A','20.00','USD'],['2','Compra','B','30.00','PEN']]);self.assertIsNone(d['rows'][0]['amount']);self.assertEqual(d['rows'][0]['usd'],20);self.assertEqual(d['rows'][1]['amount'],30)
    def test_real_attachment(self):
        path=Path(os.environ.get('SISFIA_SAMPLE_PDF','nonexistent.pdf'))
        if not path.is_file():self.skipTest('Archivo real no incluido en el proyecto')
        d=detect_pdf(path,path.name);self.assertEqual(len(d['rows']),7);self.assertEqual(total_cents(d['rows']),1736809);self.assertEqual(d['declared'],17368.09)
if __name__=='__main__':unittest.main()
