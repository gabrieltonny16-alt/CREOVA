import { requireSupabase } from '../../lib/supabase';

const STORY_BUCKET = 'creova-stories';
const HIGHLIGHT_BUCKET = 'creova-highlights';
export type HighlightSourceStory = { id: string; media_path: string; media_type: 'image'|'video'; caption: string; duration_seconds: number|null; created_at: string };
export type StoryHighlightItem = { id: string; highlight_id: string; user_id: string; media_path: string; media_type: 'image'|'video'; caption: string; duration_seconds: number|null; position: number; created_at: string; signedUrl: string };
export type StoryHighlight = { id: string; user_id: string; title: string; position: number; created_at: string; items: StoryHighlightItem[] };

const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r=Math.floor(Math.random()*16); return (c==='x'?r:(r&3)|8).toString(16); });
function mimeFor(path:string, type:'image'|'video') {
  const ext=path.split('.').pop()?.toLowerCase();
  const map:Record<string,string>={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',mp4:'video/mp4',mov:'video/quicktime',webm:'video/webm'};
  const mime=ext?map[ext]:undefined;
  if(!mime || !mime.startsWith(type+'/')) throw new Error('This story format cannot be saved to Highlights.');
  return mime;
}
async function currentUser() {
  const c=requireSupabase(); const {data,error}=await c.auth.getUser();
  if(error) throw error; if(!data.user) throw new Error('Sign in to manage Highlights.');
  return {client:c,user:data.user};
}
export async function getMyActiveStories():Promise<HighlightSourceStory[]> {
  const {client,user}=await currentUser();
  const {data,error}=await client.from('stories').select('id,media_path,media_type,caption,duration_seconds,created_at').eq('user_id',user.id).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false});
  if(error) throw error; return (data??[]) as HighlightSourceStory[];
}
export async function getProfileHighlights(profileId:string):Promise<StoryHighlight[]> {
  const {client}=await currentUser();
  const {data:hs,error}=await client.from('story_highlights').select('id,user_id,title,position,created_at').eq('user_id',profileId).order('position').order('created_at');
  if(error) throw error; if(!hs?.length) return [];
  const {data:items,error:ie}=await client.from('story_highlight_items').select('id,highlight_id,user_id,media_path,media_type,caption,duration_seconds,position,created_at').in('highlight_id',hs.map(h=>h.id)).order('position').order('created_at');
  if(ie) throw ie;
  const rows=items??[]; const signed=new Map<string,string>();
  if(rows.length){const {data,error:se}=await client.storage.from(HIGHLIGHT_BUCKET).createSignedUrls(rows.map(x=>x.media_path),3600);if(se)throw se;(data??[]).forEach(x=>{if(x.path&&x.signedUrl)signed.set(x.path,x.signedUrl);});}
  return hs.map(h=>({...h,items:rows.filter(x=>x.highlight_id===h.id).flatMap(x=>{const signedUrl=signed.get(x.media_path);return signedUrl?[{...x,signedUrl} as StoryHighlightItem]:[];})})) as StoryHighlight[];
}
export async function createStoryHighlight(title:string):Promise<string>{
  const clean=title.trim(); if(!clean||clean.length>30)throw new Error('Highlight names must be 1–30 characters.');
  const {client,user}=await currentUser(); const {data,error}=await client.from('story_highlights').insert({user_id:user.id,title:clean}).select('id').single();
  if(error)throw error;return data.id as string;
}
export async function addStoryToHighlight(storyId:string,highlightId:string):Promise<void>{
  const {client,user}=await currentUser();
  const [{data:story,error:se},{data:highlight,error:he}]=await Promise.all([
    client.from('stories').select('id,media_path,media_type,caption,duration_seconds').eq('id',storyId).eq('user_id',user.id).gt('expires_at',new Date().toISOString()).single(),
    client.from('story_highlights').select('id').eq('id',highlightId).eq('user_id',user.id).single()
  ]);
  if(se)throw se;if(he)throw he;
  const {data:rows,error:le}=await client.from('story_highlight_items').select('id').eq('highlight_id',highlightId);
  if(le)throw le;if((rows??[]).length>=100)throw new Error('A Highlight can contain up to 100 Stories.');
  const mime=mimeFor(story.media_path,story.media_type);const ext=story.media_path.split('.').pop()||'jpg';const id=uuid();const path=`${user.id}/${highlightId}/${id}.${ext}`;
  const {data:file,error:de}=await client.storage.from(STORY_BUCKET).download(story.media_path);if(de)throw de;if(!file)throw new Error('Could not read the original Story.');
  const {error:ie}=await client.from('story_highlight_items').insert({id,highlight_id:highlightId,user_id:user.id,media_path:path,media_type:story.media_type,caption:story.caption??'',duration_seconds:story.media_type==='video'?story.duration_seconds:null,position:(rows??[]).length});
  if(ie)throw ie;
  const {error:ue}=await client.storage.from(HIGHLIGHT_BUCKET).upload(path,file,{contentType:mime,cacheControl:'3600',upsert:false});
  if(ue){await client.from('story_highlight_items').delete().eq('id',id).eq('user_id',user.id);throw ue;}
}
export async function deleteStoryHighlightItem(id:string):Promise<void>{
  const {client,user}=await currentUser();const {data:item,error:le}=await client.from('story_highlight_items').select('media_path').eq('id',id).eq('user_id',user.id).single();if(le)throw le;
  const {error:re}=await client.storage.from(HIGHLIGHT_BUCKET).remove([item.media_path]);if(re)throw re;
  const {error}=await client.from('story_highlight_items').delete().eq('id',id).eq('user_id',user.id);if(error)throw error;
}
export async function deleteStoryHighlight(id:string):Promise<void>{
  const {client,user}=await currentUser();const {data:items,error:le}=await client.from('story_highlight_items').select('media_path').eq('highlight_id',id).eq('user_id',user.id);if(le)throw le;
  if(items?.length){const {error:re}=await client.storage.from(HIGHLIGHT_BUCKET).remove(items.map(x=>x.media_path));if(re)throw re;}
  const {error}=await client.from('story_highlights').delete().eq('id',id).eq('user_id',user.id);if(error)throw error;
}