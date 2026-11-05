import {Link} from 'react-router';
import {genreDestination} from './detailPresentation';

export function GenreLinks({genres = []}: {genres?: string[]}) {
  const labels = [...new Set(genres.filter(label => label.trim()))];
  if (!labels.length) return null;
  return <nav className="title-genres" aria-label="Browse by genre">{labels.map(genre =>
    <Link key={genre} to={genreDestination(genre)}><span className="genre-dot" aria-hidden="true"/>{genre}</Link>
  )}</nav>;
}
