import { randomBytes, createHash, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt=promisify(scryptCallback);
export const token=()=>randomBytes(32).toString('base64url');
export const digest=value=>createHash('sha256').update(String(value)).digest('hex');
export async function hashPassword(password){const salt=randomBytes(16).toString('hex');const key=await scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});return `scrypt:${salt}:${key.toString('hex')}`}
export async function verifyPassword(password,hash){const [kind,salt,key]=hash.split(':');if(kind!=='scrypt'||!salt||!key)return false;const actual=await scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});const expected=Buffer.from(key,'hex');return expected.length===actual.length&&timingSafeEqual(expected,actual)}
export function cookieOptions(production){return {httpOnly:true,secure:production,sameSite:'strict',path:'/'}}
export function csvCell(value){let s=typeof value==='object'?JSON.stringify(value):String(value??'');if(/^[\s]*[=+\-@\t\r]/.test(s))s=`'${s}`;return `"${s.replaceAll('"','""')}"`}
