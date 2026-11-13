import {useState} from 'react';
import {SlidersHorizontal} from 'lucide-react';
import {Modal,Toggle} from './Primitives';
import {Select} from './Select';
import type {useCollectionLayout} from '../state/collectionLayout';
type Layout=ReturnType<typeof useCollectionLayout>;
export function CollectionLayoutButton({layout,onPageSizeChange}:{layout:Layout;onPageSizeChange:()=>void}) {
 const [open,setOpen]=useState(false);const {value,change}=layout;
 return <><button className="button secondary collection-layout-trigger" onClick={()=>setOpen(true)} aria-haspopup="dialog" aria-expanded={open}><SlidersHorizontal size={17}/>Layout</button>{open&&<Modal className="collection-layout-drawer" title="Layout" onClose={()=>setOpen(false)}>
 <p className="collection-layout-note">Just for this section. Changes save as you go.</p>
 <section><h3>Cards</h3>
 <label>Card Size <output>{value.width}px</output><input aria-label="Card size" type="range" min={120} max={320} step={4} value={value.width} onChange={e=>change({width:Number(e.target.value)})}/></label>
 <label>Spacing <output>{value.gap}px</output><input aria-label="Card spacing" type="range" min={8} max={40} step={2} value={value.gap} onChange={e=>change({gap:Number(e.target.value)})}/></label>
 <label>Rounded Corners <output>{value.radius}px</output><input aria-label="Card rounded corners" type="range" min={0} max={32} step={2} value={value.radius} onChange={e=>change({radius:Number(e.target.value)})}/></label></section>
 <section><h3>Display</h3><label>Presentation<Select aria-label="Collection presentation" value={value.view} onValueChange={view=>change({view:view as 'grid'|'list'})}><option value="grid">Grid</option><option value="list">List</option></Select></label>
 <label>Items Per Page<Select aria-label="Items per page" value={value.pageSize} onValueChange={size=>{change({pageSize:Number(size)});onPageSizeChange();}}>{[12,24,40].map(size=><option key={size} value={size}>{size}</option>)}</Select></label>
 <div className="collection-layout-toggle"><span>Title Labels</span><Toggle label="Collection title labels" checked={value.titles} onChange={titles=>change({titles})}/></div>
 <div className="collection-layout-toggle"><span>Ratings</span><Toggle label="Collection ratings" checked={value.ratings} onChange={ratings=>change({ratings})}/></div></section>
 {layout.error&&<p role="status">{layout.error}</p>}<footer><button className="text-link" onClick={()=>{layout.reset();onPageSizeChange();}}>Reset Layout</button><button className="button secondary" onClick={()=>setOpen(false)}>Done</button></footer>
 </Modal>}</>;
}
export function collectionGridClass(value:Layout['value']){return `media-grid collection-card-grid ${value.view==='list'?'collection-list':''} ${!value.titles?'collection-hide-titles':''} ${!value.ratings?'collection-hide-ratings':''}`;}
