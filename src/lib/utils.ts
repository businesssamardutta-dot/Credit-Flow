export const THEMES = {
  ocean:    { label:'Ocean',    font:'Outfit',         color:'#1a6fbb', dot:'linear-gradient(135deg,#1a6fbb,#0ea5e9)' },
  sakura:   { label:'Sakura',   font:'Playfair Display',color:'#be185d', dot:'linear-gradient(135deg,#be185d,#fb7185)' },
  forest:   { label:'Forest',   font:'Nunito',         color:'#166534', dot:'linear-gradient(135deg,#166534,#16a34a)' },
  amber:    { label:'Amber',    font:'Space Grotesk',  color:'#92400e', dot:'linear-gradient(135deg,#92400e,#f59e0b)' },
  slate:    { label:'Slate',    font:'IBM Plex Serif', color:'#1e40af', dot:'linear-gradient(135deg,#1e40af,#64748b)' },
  lavender: { label:'Lavender', font:'Crimson Pro',    color:'#6b21a8', dot:'linear-gradient(135deg,#6b21a8,#c084fc)' },
};

const MLbl = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export function mkLabel(mk: string){ if(!mk) return ''; const p=mk.split('-'); return (MLbl[parseInt(p[1])]||p[1])+' '+p[0]; }
export function fmt(n: number){ return (n||0).toLocaleString('en-IN'); }
export function fmtRs(n: number){ return n < 0 ? '-₹'+fmt(Math.abs(n)) : '₹'+fmt(n); }

export type ThemeKey = keyof typeof THEMES;
