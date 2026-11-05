import {formatMinutes} from '../platform/duration.ts';
export type MediaKind = 'movie' | 'show';
export type ArtKind = 'orbit' | 'coast' | 'city' | 'desert' | 'forest' | 'mountain' | 'garden' | 'moon';
export interface MediaItem {
  id: string;
  title: string;
  tagline: string;
  kind: MediaKind;
  year: number;
  rating: string;
  score: number;
  runtime: number;
  genres: string[];
  overview: string;
  art: ArtKind;
  colors: [string, string, string];
  director: string;
  cast: string[];
  seasons?: number;
  progress?: number;
  new?: boolean;
}

// Entirely fictional titles, people and metadata. This module performs no requests.
export const media: MediaItem[] = [
  { id: 'beyond-the-silence', title: 'Beyond the Silence', tagline: 'Somewhere out there, everything begins.', kind: 'movie', year: 2025, rating: 'PG-13', score: 8.7, runtime: 148, genres: ['Science Fiction', 'Adventure'], overview: 'A cartographer follows a signal across an uncharted world. Beneath its quiet skies, she discovers that the greatest journey is the one that brings us back to each other.', art: 'orbit', colors: ['#15232d', '#d6b18b', '#c0d6d0'], director: 'Mara Ellison', cast: ['Elena Hart', 'Jonah Vale', 'Amir Chen'], new: true },
  { id: 'the-last-light', title: 'The Last Light', tagline: 'Every shore has a story.', kind: 'movie', year: 2025, rating: 'PG', score: 8.2, runtime: 112, genres: ['Drama', 'Adventure'], overview: 'A lighthouse keeper and a young radio engineer find an unlikely friendship during the longest winter their coastal town has ever known.', art: 'coast', colors: ['#142e3b', '#9aaea0', '#f1d9a3'], director: 'Theo Mercer', cast: ['Nora Ellis', 'Samuel Reed', 'June Park'], progress: 42 },
  { id: 'after-hours', title: 'After Hours', tagline: 'The city keeps its own secrets.', kind: 'show', year: 2025, rating: 'TV-14', score: 8.6, runtime: 48, genres: ['Thriller', 'Drama'], overview: 'A night-shift photographer becomes the only witness to a mystery that unfolds across the sleeping city, one photograph at a time.', art: 'city', colors: ['#211b38', '#b56d7b', '#e5c29b'], director: 'Iris Bennett', cast: ['Alex Kim', 'Lena Frost', 'Daniel Moss'], seasons: 2, progress: 67, new: true },
  { id: 'a-place-between', title: 'A Place Between', tagline: 'Take the road you never planned.', kind: 'movie', year: 2024, rating: 'PG-13', score: 7.9, runtime: 126, genres: ['Adventure', 'Drama'], overview: 'Two estranged siblings cross a vast desert to return a box of letters. Along the way, the landscape gives them room to finally listen.', art: 'desert', colors: ['#593f37', '#dfae7f', '#e5cfb3'], director: 'Oliver Shaw', cast: ['Mia Rivers', 'Evan West', 'Clara Hale'], progress: 23 },
  { id: 'wild-earth', title: 'Wild Earth', tagline: 'A world worth getting lost in.', kind: 'show', year: 2025, rating: 'TV-G', score: 9.1, runtime: 52, genres: ['Documentary', 'Nature'], overview: 'From mist-covered forests to the furthest mountain peaks, discover the extraordinary little stories that keep our living planet in balance.', art: 'forest', colors: ['#132d27', '#6c9975', '#d3dfbc'], director: 'Sofia Lane', cast: ['Rowan Blake', 'Isla Green', 'Leo Woods'], seasons: 3, new: true },
  { id: 'north-of-nowhere', title: 'North of Nowhere', tagline: 'Find your way by letting go.', kind: 'movie', year: 2024, rating: 'PG-13', score: 8.4, runtime: 134, genres: ['Adventure', 'Drama'], overview: 'An expedition guide returns to the valley she once called home, where a missing trail and an old promise lead her deeper into the mountains.', art: 'mountain', colors: ['#1d3443', '#85a5ad', '#e1d6be'], director: 'Felix Hart', cast: ['Ava North', 'Miles Ash', 'Celia Fox'] },
  { id: 'small-wonders', title: 'Small Wonders', tagline: 'Life happens in the in-between.', kind: 'show', year: 2025, rating: 'TV-PG', score: 8.3, runtime: 29, genres: ['Comedy', 'Drama'], overview: 'A neighborhood bookshop becomes a gathering place for a wonderfully imperfect group of people learning to start over.', art: 'garden', colors: ['#485243', '#c3bc89', '#eedfc7'], director: 'Emma Quinn', cast: ['Oscar Bell', 'Ruby Finch', 'Luca Gray'], seasons: 2, progress: 36 },
  { id: 'lunar-tide', title: 'Lunar Tide', tagline: 'Nothing stays hidden forever.', kind: 'movie', year: 2025, rating: 'PG-13', score: 8.1, runtime: 119, genres: ['Science Fiction', 'Thriller'], overview: 'When the ocean on a remote moon begins to retreat, a research crew finds a structure that should not exist.', art: 'moon', colors: ['#16233a', '#8196ba', '#d2d3dd'], director: 'Ada Wells', cast: ['Kai Stone', 'Eva Brooks', 'Noah Lake'], new: true },
  { id: 'ocean-days', title: 'Ocean Days', tagline: 'The best things arrive with the tide.', kind: 'movie', year: 2023, rating: 'PG', score: 7.8, runtime: 104, genres: ['Comedy', 'Drama'], overview: 'A chef trades the noise of the city for a small seaside café, discovering a recipe for a very different kind of life.', art: 'coast', colors: ['#28515b', '#b9c7ae', '#f5d6a1'], director: 'Isabel Reed', cast: ['Freya Moss', 'Ben Archer', 'Nina Day'] },
  { id: 'night-train', title: 'Night Train', tagline: 'One journey. A thousand lives.', kind: 'movie', year: 2024, rating: 'PG-13', score: 8.0, runtime: 121, genres: ['Thriller', 'Drama'], overview: 'On the final overnight train of the season, a conductor discovers that every passenger is carrying a piece of the same story.', art: 'city', colors: ['#15313b', '#6e9c9b', '#dfab77'], director: 'Jonas Cole', cast: ['Ivy James', 'Finn Clarke', 'Rose Adler'] },
  { id: 'the-long-way-home', title: 'The Long Way Home', tagline: 'There is more than one way back.', kind: 'show', year: 2024, rating: 'TV-14', score: 8.8, runtime: 46, genres: ['Drama', 'Adventure'], overview: 'A family scattered across three continents makes a promise to meet in the place where their story began.', art: 'mountain', colors: ['#343e40', '#c2ab90', '#e1d9c8'], director: 'Julian Rowe', cast: ['Alice Kerr', 'Theo Lane', 'Sara June'], seasons: 3 },
  { id: 'golden-hour', title: 'Golden Hour', tagline: 'A summer to remember.', kind: 'movie', year: 2025, rating: 'PG', score: 7.7, runtime: 108, genres: ['Romance', 'Drama'], overview: 'An illustrator spends a summer restoring her grandmother’s garden and rediscovers the person she had almost forgotten she could be.', art: 'garden', colors: ['#6c5941', '#d9b96f', '#f4e4bc'], director: 'Lucy Fern', cast: ['Willa Rose', 'Sam Cove', 'Ella Reid'], new: true },
  { id: 'red-horizon', title: 'Red Horizon', tagline: 'What will we leave behind?', kind: 'show', year: 2025, rating: 'TV-14', score: 8.5, runtime: 55, genres: ['Science Fiction', 'Drama'], overview: 'The first settlement on a distant planet confronts a choice between the mission they were sent to complete and the future they want to build.', art: 'desert', colors: ['#462b32', '#bd745d', '#f0ba87'], director: 'Ari Quinn', cast: ['Zara Wren', 'Eli Frost', 'Milo Bell'], seasons: 1, new: true },
  { id: 'still-waters', title: 'Still Waters', tagline: 'Listen a little closer.', kind: 'movie', year: 2022, rating: 'PG-13', score: 8.0, runtime: 116, genres: ['Drama', 'Thriller'], overview: 'A sound recordist arrives at a quiet lakeside town and hears a melody that no one else seems to remember.', art: 'forest', colors: ['#1f3d3c', '#89a7a0', '#cad4bb'], director: 'Esme Hill', cast: ['Ada Shaw', 'Reed Parker', 'Cleo Brook'] },
  { id: 'blue-distance', title: 'Blue Distance', tagline: 'Beyond the edge of the map.', kind: 'show', year: 2023, rating: 'TV-G', score: 8.9, runtime: 44, genres: ['Documentary', 'Nature'], overview: 'Travel with a small team of oceanographers as they uncover the surprising connections between distant coastlines.', art: 'coast', colors: ['#0e354c', '#528f9e', '#d8dfcd'], director: 'River Cole', cast: ['Maya West', 'Leon Vale', 'Iris Shore'], seasons: 2 },
  { id: 'the-quiet-orbit', title: 'The Quiet Orbit', tagline: 'Even the stars need a little company.', kind: 'movie', year: 2024, rating: 'PG', score: 8.6, runtime: 128, genres: ['Science Fiction', 'Adventure'], overview: 'An orbital gardener is about to finish her longest solo mission when an unexpected visitor changes the meaning of home.', art: 'orbit', colors: ['#24364c', '#ab978f', '#d4cfae'], director: 'Milo Finch', cast: ['Aria Keene', 'Jon Reed', 'Elise Ford'] },
];
export const genres = [...new Set(media.flatMap(item => item.genres))].sort();
export const featured = [media[0], media[4], media[5]];
export function findMedia(id: string | undefined) { return media.find(item => item.id === id); }
export function duration(minutes: number) { return formatMinutes(minutes); }
