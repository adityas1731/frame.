import {visibleSettingsSection} from '../studio/activeSection';
import {useEffect,useState} from 'react';
import '../styles/settings-refinement.css';
import {DevicesSettings} from '../components/DevicesSettings';
import {SkippingSettings} from '../playback/SkippingSettings';
import {SettingsSection} from '../components/SettingsSection';
import {ConnectionSettings} from '../components/ConnectionSettings';
import {LayoutSettings} from '../components/LayoutSettings';
import '../build/flags';
import {FeaturedSettings} from '../components/FeaturedSettings';
import {Link} from 'react-router';
import {AppearanceStudio} from '../studio/AppearanceStudio';
import {HomeStudio} from '../studio/HomeStudio';
import {ProviderSettings} from '../providers/ProviderSettings';
import {usePreview} from '../state/PreviewContext';
export function Settings(){const {preferences:p}=usePreview();const [activeSection,setActiveSection]=useState('connection-heading');
 useEffect(()=>{
  let frame=0;
  const measure=()=>{
   frame=0;
   const sections=[...document.querySelectorAll<HTMLElement>('.settings-main>.settings-section')].flatMap(section=>{
    const heading=section.querySelector<HTMLElement>('.settings-section-title h2[id]');
    if(!heading)return [];const bounds=section.getBoundingClientRect();return [{id:heading.id,top:bounds.top,bottom:bounds.bottom}];
   });
   const header=document.querySelector('.topbar')?.getBoundingClientRect().bottom??80;
   const current=visibleSettingsSection(sections,Math.max(0,header),window.innerHeight);
   if(current)setActiveSection(current);
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(measure);};
  schedule();window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);const observer=new ResizeObserver(schedule);const main=document.querySelector('.settings-main');if(main)observer.observe(main);
  return()=>{cancelAnimationFrame(frame);window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);observer.disconnect();};
 },[]);
 return <div className="content-page settings-page"><header className="page-heading"><span className="eyebrow">frame.</span><h1>Make Yourself At Home.</h1><p>A personal canvas for your collection.</p></header><div className="studio-settings-layout"><div className="settings-main"><ConnectionSettings/>
 <AppearanceStudio/>
 <LayoutSettings/>
 <SkippingSettings/>
 <DevicesSettings/>
 <FeaturedSettings/>
 <HomeStudio/>
 <ProviderSettings/>
 {__FRAME_DIAGNOSTICS__&&<SettingsSection id="advanced-heading" title="Advanced"><div className="studio-panel"><Link className="button secondary" to="/settings/advanced/diagnostics">Diagnostics</Link><p className="studio-footnote">Internal playback and streaming information. No credentials or private server details are recorded.</p></div></SettingsSection>}
 </div><nav className="studio-settings-nav" aria-label="Settings sections"><span className="eyebrow">ON THIS PAGE</span>{[{id:'connection-heading',label:'Connection'},{id:'appearance-heading',label:'Appearance'},{id:'layout-heading',label:'Layout & Navigation'},{id:'playback-heading',label:'Playback'},{id:'devices-heading',label:'Devices'},{id:'featured-settings-heading',label:'Featured Banners'},{id:'home-heading',label:'Home Sections'},{id:'online-heading',label:'Online Metadata'},...(__FRAME_DIAGNOSTICS__?[{id:'advanced-heading',label:'Advanced'}]:[])].map((section,index)=><a key={section.id} href={`#${section.id}`} aria-current={activeSection===section.id?'location':undefined} onClick={e=>{e.preventDefault();setActiveSection(section.id);document.getElementById(section.id)?.scrollIntoView({behavior:p.reducedMotion?'instant':'smooth',block:'start'});}}><span>{String(index+1).padStart(2,'0')}</span>{section.label}</a>)}<Link className="settings-preview-link" to="/">Preview Your Home →</Link><p>Saved locally for this server and account. Your Jellyfin library remains unchanged.</p></nav></div></div>;}

