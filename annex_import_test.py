import sys, unittest, tempfile, os
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.platypus import Table,TableStyle
from reportlab.lib import colors
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from smart_import import detect_pdf,total_cents
class AnnexTest(unittest.TestCase):
    def test_annex_not_added(self):
        with tempfile.TemporaryDirectory() as td:
            path=Path(td)/'test.pdf';c=canvas.Canvas(str(path),pagesize=(1000,600))
            def table(rows,y):
                t=Table(rows,colWidths=[940/len(rows[0])]*len(rows[0]));t.setStyle(TableStyle([('GRID',(0,0),(-1,-1),.5,colors.black)]));w,h=t.wrap(940,500);t.drawOn(c,30,y-h)
            c.drawString(30,570,'PAGOS 28 DE ENERO 2026');table([['N°Or','Concepto','Comprobante','Monto','N° Orden'],['1','Materiales','Varios','S/ 100.00','1570'],['','','TOTAL A PAGAR','S/ 100.00','']],540);c.showPage()
            c.drawString(30,570,'INFORME DE DINERO');table([['ORDEN N°','1570 - Telebanking','CAJA CHICA N°','001-2026'],['MONTO S/','S/ 100.00','Informe realizado por:','Persona A'],['Fecha del Informe:','10 de febrero 2026','','']],540)
            table([['ITEM','CONCEPTO','COMPROBANTE','FECHA','MONTO S/'],['1','Materiales','F001-1','28 de enero','S/ 80.00'],['','Pasajes','sin comprobante','28 de enero','S/ 20.02'],['','','','','S/ 100.02']],440);c.save()
            d=detect_pdf(path,path.name);self.assertEqual(total_cents(d['rows']),10000);self.assertEqual(len(d['rows']),1);a=d['annexes'][0];self.assertEqual(len(a['rows']),2);self.assertEqual(a['difference'],.02);self.assertTrue(a['matched']);self.assertEqual(a['declared'],100.02)
if __name__=='__main__':
    if len(sys.argv)>1:
        root=Path(sys.argv.pop(1));d=detect_pdf(root/'PAGOS 28 DE ENERO 2026.pdf','PAGOS 28 DE ENERO 2026.pdf');assert len(d['rows'])==3 and total_cents(d['rows'])==2487811; a=d['annexes'][0];assert len(a['rows'])==9 and a['spent']==2850.02 and a['matched'] and a['difference']==.02
        d=detect_pdf(root/'PAGOS 12 DE ENERO 2026(1).pdf','PAGOS 12 DE ENERO 2026(1).pdf');assert len(d['rows'])==7 and total_cents(d['rows'])==1626650;assert [r['order'] for r in d['rows'][-3:]]==['1524']*3
        print('Dos PDF adjuntos: comprobación correcta')
    unittest.main()
