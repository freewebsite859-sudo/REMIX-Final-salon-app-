import React, { useState } from 'react';

const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
export function SalonOpeningHours({ hours, onSave, saving }: { hours: any[]; onSave: (hours: any[]) => Promise<void>; saving: boolean }) {
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState<any[]>([]);
  const [error,setError]=useState('');
  const open = () => {
    setDraft(days.map((_,day_of_week)=>{
      const saved=hours.find(h=>h.day_of_week===day_of_week);
      return {day_of_week,is_closed:saved?.is_closed ?? true,opens_at:saved?.opens_at?.slice(0,5)||'',closes_at:saved?.closes_at?.slice(0,5)||''};
    }));setError('');setEditing(true);
  };
  return <section className="bg-white border rounded-2xl p-4">
    <div className="flex items-center justify-between gap-3"><h2 className="font-bold">Salon Opening Hours</h2><button onClick={open} className="underline">{hours.length ? 'Edit hours' : 'Set opening hours'}</button></div>
    {!hours.length && <p className="text-amber-800 text-sm">Set opening hours before scheduling appointments. Times use the salon timezone. Staff without a schedule inherit these hours.</p>}
    {!editing && hours.length > 0 && <p className="text-sm mt-2">{days.map((day,index)=>{const h=hours.find(h=>h.day_of_week===index);return `${day}: ${!h?'Not set':h.is_closed?'Closed':`${h.opens_at.slice(0,5)}–${h.closes_at.slice(0,5)}`}`;}).join(' · ')}</p>}
    {editing && <p className="text-sm mt-2">Staff without a schedule will use these hours; existing staff schedules stay unchanged.</p>}
    {editing && <form onSubmit={async e=>{e.preventDefault();try{setError('');await onSave(draft);setEditing(false);}catch(e:any){setError(e.message);}}} className="mt-3 space-y-2">
      {draft.map((h,index)=><div key={h.day_of_week} className="flex flex-wrap items-center gap-3"><span className="w-24">{days[h.day_of_week]}</span>
        <label><input type="checkbox" checked={h.is_closed} onChange={e=>setDraft(old=>old.map((row,i)=>i===index?{...row,is_closed:e.target.checked}:row))}/> Closed</label>
        <input aria-label={`${days[h.day_of_week]} opens`} type="time" disabled={h.is_closed} required={!h.is_closed} value={h.opens_at} onChange={e=>setDraft(old=>old.map((row,i)=>i===index?{...row,opens_at:e.target.value}:row))}/>
        <input aria-label={`${days[h.day_of_week]} closes`} type="time" disabled={h.is_closed} required={!h.is_closed} value={h.closes_at} onChange={e=>setDraft(old=>old.map((row,i)=>i===index?{...row,closes_at:e.target.value}:row))}/>
      </div>)}
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <button disabled={saving} type="submit" className="bg-slate-900 text-white rounded-lg px-3 py-2">Save opening hours</button>
      <button type="button" onClick={()=>setEditing(false)} className="ml-3">Cancel</button>
    </form>}
  </section>;
}
