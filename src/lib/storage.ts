import { newWorkspace, type Workspace } from './records';

const KEY = 'fueltill-demo-workspace-v1';
/** Browser-only demo persistence: not encrypted, authenticated, synced or tamper-proof. */
export function loadWorkspace(): Workspace {
  try {
    const data = localStorage.getItem(KEY);
    if (!data) return newWorkspace();
    const parsed: unknown = JSON.parse(data);
    if (!parsed || typeof parsed !== 'object') throw Error('Invalid saved file');
    const w = parsed as Workspace;
    if (w.version!==1 || !Array.isArray(w.stations) || !Array.isArray(w.safeDrops)||!Array.isArray(w.closings)||!w.drawerCounts||!w.profile||!w.stations.length) throw Error('Unknown format');
    return w;
  } catch { return newWorkspace(); }
}
export function saveWorkspace(w: Workspace): void {localStorage.setItem(KEY, JSON.stringify(w));}
export function exportWorkspace(w:Workspace):string {return JSON.stringify({format:'fueltill-demo-export-v1',exportedAt:new Date().toISOString(),workspace:w},null,2);}
export function importWorkspace(raw:string):Workspace {
  const parsed:unknown=JSON.parse(raw);
  if(!parsed||typeof parsed!=='object')throw Error('Invalid backup file.');
  const p=parsed as {format?:string,workspace?:Workspace};
  const w=p.workspace;
  if(p.format!=='fueltill-demo-export-v1'||!w||w.version!==1||!Array.isArray(w.stations)||!Array.isArray(w.safeDrops)||!Array.isArray(w.closings)||!w.drawerCounts)throw Error('Not a supported FuelTill demo backup.');
  return w;
}
