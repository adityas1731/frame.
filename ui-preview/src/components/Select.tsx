import {headingCase} from './headingCase';
import {optionLabel} from './optionLabels';
import {Children,isValidElement,useEffect,useId,useLayoutEffect,useRef,useState,type ReactNode,type KeyboardEvent,type SelectHTMLAttributes} from 'react';
import {createPortal} from 'react-dom';
import {Check,ChevronDown} from 'lucide-react';
import './select.css';
type Props=Omit<SelectHTMLAttributes<HTMLSelectElement>,'onChange'|'multiple'|'size'> & {onValueChange?:(value:string)=>void;menuClassName?:string;titleCase?:boolean};
interface Option{value:string;label:string;disabled:boolean}
function text(children:ReactNode):string{return Children.toArray(children).map(child=>isValidElement<{children?:ReactNode}>(child)?text(child.props.children):String(child)).join('');}
function options(children:ReactNode):Option[]{return Children.toArray(children).flatMap(child=>{if(!isValidElement<{children?:ReactNode;value?:string|number;disabled?:boolean}>(child))return[];return child.type==='option'?[{value:String(child.props.value??text(child.props.children)),label:optionLabel(text(child.props.children),String(child.props.value??text(child.props.children))),disabled:!!child.props.disabled}]:options(child.props.children);});}
/** Single-select combobox. The trigger owns focus; options use aria-activedescendant. */
export function Select({children,value,defaultValue,onValueChange,disabled,className='',menuClassName='',titleCase=false,id,...props}:Props){
 const generated=useId(),listId=`${generated}-list`,trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null);
 const entries=options(children).map(option=>titleCase?{...option,label:headingCase(option.label)}:option),[fallback,setFallback]=useState(String(defaultValue??entries[0]?.value??''));
 const selected=String(value??fallback),selectedIndex=entries.findIndex(option=>option.value===selected);
 const [positionRevision,setPositionRevision]=useState(0);const [open,setOpen]=useState(false),[active,setActive]=useState(0),[position,setPosition]=useState({top:0,left:0,width:0,maxHeight:260});
 const typeahead=useRef({text:'',at:0});
 function close(){setOpen(false);}
 useEffect(()=>{if(disabled)setOpen(false);setActive(index=>Math.max(0,Math.min(index,entries.length-1)));},[disabled,entries.length]);
 function show(){if(disabled||!entries.some(option=>!option.disabled))return;setActive(Math.max(0,selectedIndex));setOpen(true);}
 function choose(index:number){const option=entries[index];if(!option||option.disabled)return;setFallback(option.value);onValueChange?.(option.value);close();trigger.current?.focus();}
 useLayoutEffect(()=>{if(!open)return;const rect=trigger.current!.getBoundingClientRect();const below=innerHeight-rect.bottom-16,above=rect.top-16;const desired=Math.min(280,(menu.current?.scrollHeight??entries.length*42+12)+2);const height=Math.max(0,Math.min(desired,Math.max(below,above)));const width=Math.min(innerWidth-24,Math.max(rect.width,220));setPosition({left:Math.max(12,Math.min(rect.left,innerWidth-width-12)),top:below>=height?rect.bottom+8:Math.max(12,rect.top-height-8),width,maxHeight:height});},[open,selected,positionRevision]);
 useEffect(()=>{if(!open)return;const outside=(event:PointerEvent)=>{if(!trigger.current?.contains(event.target as Node)&&!menu.current?.contains(event.target as Node))close();};const reposition=(event:Event)=>{if(!menu.current?.contains(event.target as Node))setPositionRevision(revision=>revision+1);};document.addEventListener('pointerdown',outside);window.addEventListener('resize',close);window.addEventListener('scroll',reposition,true);return()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',close);window.removeEventListener('scroll',reposition,true);};},[open]);
 useEffect(()=>{if(open)menu.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({block:'nearest'});},[active,open]);
 function key(event:KeyboardEvent<HTMLButtonElement>){
  if(['ArrowDown','ArrowUp','Home','End','Escape','Enter',' '].includes(event.key)){event.preventDefault();event.stopPropagation();}
  const enabled=entries.map((option,i)=>option.disabled?-1:i).filter(i=>i>=0);
  if(event.key==='Escape'){close();return;}
  if(event.key==='Tab'){close();return;}
  if(event.key==='Enter'||event.key===' '){if(open)choose(active);else show();return;}
  if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){if(!open){show();return;}const index=enabled.indexOf(active);setActive(event.key==='Home'?enabled[0]:event.key==='End'?enabled.at(-1)!:enabled[(index+(event.key==='ArrowDown'?1:-1)+enabled.length)%enabled.length]??0);return;}
  if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){event.preventDefault();event.stopPropagation();const now=Date.now();const prefix=(now-typeahead.current.at>700?'':typeahead.current.text)+event.key.toLowerCase();typeahead.current={text:prefix,at:now};const index=entries.findIndex(option=>!option.disabled&&option.label.toLowerCase().startsWith(prefix));if(index>=0){if(!open)setOpen(true);setActive(index);}}
 }
 const portalHost=typeof document==='undefined'?null:trigger.current?.closest('dialog')??trigger.current?.closest('.frame-player')??document.body;
 return <><button type="button" ref={trigger} id={id} className={`frame-select ${className}`} role="combobox" aria-label={props['aria-label']} aria-labelledby={props['aria-labelledby']} aria-describedby={props['aria-describedby']} aria-expanded={open} aria-haspopup="listbox" aria-controls={open?listId:undefined} aria-activedescendant={open?`${listId}-${active}`:undefined} disabled={disabled||entries.every(option=>option.disabled)} aria-required={props.required||undefined} title={props.title} onClick={()=>open?close():show()} onKeyDown={key} onBlur={close}><span>{entries[selectedIndex]?.label??'Choose an option'}</span><ChevronDown size={15}/></button>{props.name&&<input type="hidden" name={props.name} value={selected}/>} {open&&portalHost&&createPortal(<div ref={menu} id={listId} role="listbox" aria-label={props['aria-label']??'Options'} className={`frame-select-menu ${menuClassName}`} style={position} onPointerDown={event=>event.preventDefault()}>{entries.map((option,index)=><div key={`${option.value}:${index}`} id={`${listId}-${index}`} role="option" aria-selected={option.value===selected} aria-disabled={option.disabled} data-index={index} data-active={index===active} className="frame-select-option" onPointerMove={()=>!option.disabled&&setActive(index)} onClick={()=>choose(index)}><span>{option.label}</span>{option.value===selected&&<Check size={16}/>}</div>)}</div>,portalHost)}</>;
}

/** Settings-only label treatment. Values and stored preferences stay unchanged. */
export function SettingsSelect(props:Props){return <Select {...props} titleCase/>;}
