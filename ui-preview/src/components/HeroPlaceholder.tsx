/** Reserve the same banner geometry while the featured query resolves. */
export function HeroPlaceholder({collection=false}:{collection?:boolean}) {
 return <section className={`${collection?'collection-spotlight collection-spotlight-hero':'cinema-hero'} hero-placeholder`} role="status" aria-label="Loading featured titles">
  <div className={collection?'collection-spotlight-copy':'cinema-copy'} aria-hidden="true">
   <div className="hero-placeholder-title"/><div className="hero-placeholder-description"/><div className="hero-placeholder-action"/>
  </div>
 </section>;
}
