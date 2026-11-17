/** Editorial features. Source: Adrian-Website origin/main About.tsx and FULL_ARCHIVE (2026-11-17). */
export interface FeaturedWork {
  id: string;
  title: string;
  year: string;
  medium: string;
  image: string;
  artistSiteUrl: string;
}

export interface FeaturedArtist {
  slug: string;
  name: string;
  summary: string;
  medium: string;
  location?: string;
  primarySite: string;
  portfolioUrl: string;
  instagram?: string;
  portrait?: string;
  hero: FeaturedWork;
  introduction: string[];
  biography: string[];
  practice: string[];
  selectedWorks: FeaturedWork[];
  featureDate: string;
}

const medium = 'Laser-cut wood, acrylic, gemstones';
const work = (id: string, title: string, image: string): FeaturedWork => ({
  id, title, image, year: '2024', medium,
  artistSiteUrl: `https://www.adrianrasmussen.com/creations/${id}`,
});

export const featuredArtists: FeaturedArtist[] = [{
  slug: 'adrian-rasmussen',
  name: 'Adrian Rasmussen',
  summary: 'Adrian Rasmussen makes layered wooden mandalas, bringing painted geometry, gemstones, and light into sculptural form.',
  medium: 'Layered wooden mandalas and installation',
  primarySite: 'https://www.adrianrasmussen.com/about',
  portfolioUrl: 'https://www.adrianrasmussen.com/creations/multidimensional-art/mandala',
  instagram: 'https://www.instagram.com/adrianrasmussen',
  hero: work('MAN-024', 'Midnight Sunrise - Black Gold', 'adrian-website/creations/mandala/midnight-sunrise-black-gold'),
  introduction: [
    'Adrian Rasmussen works across wooden sculpture, painted geometry, jewelry, and spaces made for gathering. His mandalas begin with cut layers of wood and become distinct objects through painting, assembly, and, in some works, gemstones and light. The depth of the layers matters: the geometry is something the viewer can move around, rather than an image confined to a flat surface.',
    'The mandala series sits within a wider practice. Rasmussen has also made large installations, tea houses, stages, and a 64-work Universal Language series. Across those formats, he describes art as a way to make room for presence and connection. The six works below offer a close look at the color and geometric variations in his wooden mandalas.',
  ],
  biography: [
    'Rasmussen describes a path through graffiti, one-of-a-kind painted hats, and canvas before discovering laser cutting. He brought painting, digital design, airbrushing, and other techniques into a practice that can move between small pieces and immersive environments.',
    'His own account connects art with tea and gathering. He began exploring Asia in 2009, and later designed spaces for people to meet. He is also the artist and editor behind Mandala Codes and the Universal Language Oracle. His first-person account and current portfolio remain on his own site.',
  ],
  practice: [
    'These mandalas bring together laser-cut wood, acrylic paint, and gemstones. Their construction involves stacked and painted wood, with stone inlays in some pieces. Repeated forms appear in different palettes, so color and finish become part of how each version is read.',
    'Rasmussen writes about making as a practice of attention. He draws on multiple skills, including digital design and airbrushing, while allowing a piece to develop during the work. His broader practice brings the same materials and visual language into illuminated objects and environments. The artist’s site gives the fuller first-person account of this process.',
  ],
  selectedWorks: [
    work('MAN-024', 'Midnight Sunrise - Black Gold', 'adrian-website/creations/mandala/midnight-sunrise-black-gold'),
    work('MAN-007', 'Boundless Flower - Blue Purple', 'adrian-website/creations/mandala/boundless-flower-blue-purple'),
    work('MAN-012', 'Circle Of Existance - Remix Orange', 'adrian-website/creations/mandala/circle-of-existance-remix-orange'),
    work('MAN-013', "Emergence - Metatron's Cube Brown", 'adrian-website/creations/mandala/emergence-metatrons-cube-brown'),
    work('MAN-021', 'Infinite Zoom', 'adrian-website/creations/mandala/infinite-zoom'),
    work('MAN-029', 'Secret Garden', 'adrian-website/creations/mandala/secret-garden'),
  ],
  featureDate: '2026-11-17',
}];

export const artistBySlug = (slug: string) => featuredArtists.find((artist) => artist.slug === slug);
