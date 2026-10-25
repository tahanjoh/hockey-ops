'use client';
/* eslint-disable @next/next/no-img-element -- Uploaded, resized data URLs are rendered directly. */
import {useState} from 'react';
import type {LeagueLink} from '@/lib/hockey/showcaseMedia';
async function resizePhoto(file: File): Promise<string> {
 if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG or WebP photo. Export HEIC photos as JPG first.');
 if (file.size > 20 * 1024 * 1024) throw new Error('Choose a photo smaller than 20 MB.');
 const url = URL.createObjectURL(file);
 try {
  const image = new Image();
  image.src = url;
  await image.decode();
  let width = image.naturalWidth * Math.min(1, 1200 / Math.max(image.naturalWidth,image.naturalHeight));
  for (let attempt = 0; attempt < 7; attempt++) {
   const canvas = document.createElement('canvas');
   canvas.width = Math.max(1,Math.round(width));
   canvas.height = Math.max(1,Math.round(width * image.naturalHeight / image.naturalWidth));
   const ctx = canvas.getContext('2d');
   if (!ctx) throw new Error('Photo processing is unavailable in this browser.');
   ctx.fillStyle='#06152d'; ctx.fillRect(0,0,canvas.width,canvas.height);
   ctx.drawImage(image,0,0,canvas.width,canvas.height);
   const data = canvas.toDataURL('image/jpeg',Math.max(.45,.82-attempt*.07));
   if (data.length <= 160000) return data;
   width *= .8;
  }
  throw new Error('Unable to resize this photo. Try a smaller image.');
 } finally { URL.revokeObjectURL(url); }
}
export default function MediaFields({images,setImages,leagues,setLeagues,onProcessing}:{images:string[];setImages:(images:string[])=>void;leagues:LeagueLink[];setLeagues:(leagues:LeagueLink[])=>void;onProcessing:(busy:boolean)=>void}) {
 const [error,setError]=useState('');const [processing,setProcessing]=useState(false);
 return <>
 <input type="hidden" name="images" value={JSON.stringify(images)}/><input type="hidden" name="leagues" value={JSON.stringify(leagues)}/>
 <fieldset className="rounded-2xl border p-4"><legend className="px-2 text-xl font-bold">Player hero photos</legend><p className="mb-3 text-sm text-gray-600">Add up to two photos. The first is the hero image; visitors can switch to the alternate. Photos are resized automatically.</p><div className="grid grid-cols-2 gap-3">{images.map((src,index)=><div key={src} className="overflow-hidden rounded-xl border"><img src={src} alt={index===0?'Main player photo':'Alternate player photo'} className="aspect-[4/3] w-full object-cover"/><div className="space-y-2 p-3"><p className="text-sm font-bold">{index===0?'Hero photo':'Alternate photo'}</p>{index>0&&<button type="button" className="block text-sm underline" onClick={()=>setImages([src,...images.filter((_,i)=>i!==index)])}>Make hero image</button>}<button type="button" className="text-sm underline" onClick={()=>setImages(images.filter((_,i)=>i!==index))}>Remove photo</button></div></div>)}</div>
 <label className="mt-4 block text-sm font-semibold">{images.length?'Add alternate or replacement photo':'Add player photo'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={processing||images.length>=2} className="mt-2 block w-full text-sm" onChange={async event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;setProcessing(true);onProcessing(true);setError('');try{const photo=await resizePhoto(file);setImages([...images,photo]);}catch(error){setError(error instanceof Error?error.message:'Unable to load photo.');}finally{setProcessing(false);onProcessing(false);}}}/></label><p className="mt-2 text-sm text-gray-500">{processing?'Preparing photo…':'To replace a photo, remove it and select another.'}</p>{error&&<p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}</fieldset>
 <fieldset className="rounded-2xl border p-4"><legend className="px-2 text-xl font-bold">Leagues & player stats</legend><p className="mb-3 text-sm text-gray-600">Link directly to the player’s stats page in each league. These open in a new tab.</p><div className="space-y-3">{leagues.map((league,index)=><div key={index} className="rounded-xl bg-gray-50 p-3"><label className="block text-sm font-semibold">League name<input aria-label={`League ${index+1} name`} maxLength={80} value={league.name} onChange={e=>setLeagues(leagues.map((item,i)=>i===index?{...item,name:e.target.value}:item))} className="mt-1 w-full rounded-lg border bg-white p-2"/></label><label className="mt-2 block text-sm font-semibold">Player stats link<input aria-label={`League ${index+1} stats link`} type="url" placeholder="https://…" maxLength={2000} value={league.url} onChange={e=>setLeagues(leagues.map((item,i)=>i===index?{...item,url:e.target.value}:item))} className="mt-1 w-full rounded-lg border bg-white p-2"/></label><button type="button" className="mt-2 text-sm underline" onClick={()=>setLeagues(leagues.filter((_,i)=>i!==index))}>Remove league</button></div>)}</div><button type="button" disabled={leagues.length>=8} className="mt-3 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50" onClick={()=>setLeagues([...leagues,{name:'',url:''}])}>+ Add league</button></fieldset>
 </>;
}
