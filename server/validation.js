import { z } from 'zod';
import { requestShapeOK } from './request-shape.js';
export const text = (max=200) => z.string().trim().min(1).max(max);
export const optionalText = (max=200) => z.string().trim().max(max).optional().default('');
export const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>{const d=new Date(s+'T00:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===s;},'Fecha inválida');
export const money = z.number().finite().positive().max(999999999).refine(n=>Math.abs(n*100-Math.round(n*100))<0.0001,'Máximo dos decimales');
export const password = z.string().min(12).refine(p=>Buffer.byteLength(p)<=72,'Máximo 72 bytes');
export const doc = z.string().regex(/^(\d{8}|\d{11})$/,'RUC de 11 o DNI de 8 dígitos');
export function validate(schema,req,res){if(!requestShapeOK(req.body)){res.status(413).json({error:'Estructura de solicitud demasiado grande o compleja'});return null;}const r=schema.safeParse(req.body);if(!r.success){res.status(400).json({error:r.error.issues.slice(0,20).map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')});return null;}return r.data;}
