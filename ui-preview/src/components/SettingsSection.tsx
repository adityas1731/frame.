import {headingCase} from '../components/headingCase';
import type {ReactNode} from 'react';
export function SettingsSection({id,title,aside,className='',children}:{id:string;title:string;aside?:ReactNode;className?:string;children:ReactNode}){return <section className={`settings-section ${className}`} aria-labelledby={id}><div className="settings-section-title"><h2 id={id}>{headingCase(title)}</h2>{aside}</div>{children}</section>;}
export function Field({label,children,hint}:{label:string;children:ReactNode;hint?:string}){return <label className="studio-field"><span>{headingCase(label)}</span>{children}{hint&&<small>{hint}</small>}</label>;}
