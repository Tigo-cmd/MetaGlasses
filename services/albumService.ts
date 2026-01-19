import { Album, MediaItem } from '@/types';

// Auto-organize media into albums by criteria
export function organizeIntoAlbums(media: MediaItem[]): Album[] {
  const albums: Album[] = [];

  // 1. Organize by date (month/year)
  const dateGroups = new Map<string, MediaItem[]>();
  media.forEach(item => {
    const date = new Date(item.timestamp);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthName = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    
    if (!dateGroups.has(key)) {
      dateGroups.set(key, []);
    }
    dateGroups.get(key)!.push(item);
  });

  dateGroups.forEach((items, key) => {
    const date = new Date(items[0].timestamp);
    const monthName = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    
    albums.push({
      id: `date-${key}`,
      name: monthName,
      type: 'date',
      coverUri: items[0].thumbnail || items[0].uri,
      itemCount: items.length,
      metadata: { dateKey: key },
      createdAt: items[0].timestamp,
      items,
    });
  });

  // 2. Organize by location
  const locationGroups = new Map<string, MediaItem[]>();
  media.forEach(item => {
    if (item.location) {
      if (!locationGroups.has(item.location)) {
        locationGroups.set(item.location, []);
      }
      locationGroups.get(item.location)!.push(item);
    }
  });

  locationGroups.forEach((items, location) => {
    albums.push({
      id: `location-${location.toLowerCase().replace(/\s+/g, '-')}`,
      name: location,
      type: 'location',
      coverUri: items[0].thumbnail || items[0].uri,
      itemCount: items.length,
      metadata: { location },
      createdAt: items[0].timestamp,
      items,
    });
  });

  // 3. Organize by AI-detected content
  const tagGroups = new Map<string, MediaItem[]>();
  media.forEach(item => {
    if (item.aiTags && item.aiTags.length > 0) {
      item.aiTags.forEach(tag => {
        if (!tagGroups.has(tag)) {
          tagGroups.set(tag, []);
        }
        tagGroups.get(tag)!.push(item);
      });
    }
  });

  tagGroups.forEach((items, tag) => {
    // Only create albums for tags with 3+ items
    if (items.length >= 3) {
      albums.push({
        id: `ai-${tag.toLowerCase().replace(/\s+/g, '-')}`,
        name: tag,
        type: 'ai_content',
        coverUri: items[0].thumbnail || items[0].uri,
        itemCount: items.length,
        metadata: { tag },
        createdAt: items[0].timestamp,
        items,
      });
    }
  });

  // Sort albums by item count (descending)
  return albums.sort((a, b) => b.itemCount - a.itemCount);
}

export function filterMediaByAlbum(media: MediaItem[], album: Album): MediaItem[] {
  if (album.items) {
    return album.items;
  }

  switch (album.type) {
    case 'date':
      return media.filter(item => {
        const date = new Date(item.timestamp);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return key === album.metadata?.dateKey;
      });

    case 'location':
      return media.filter(item => item.location === album.metadata?.location);

    case 'ai_content':
      return media.filter(item => 
        item.aiTags?.includes(album.metadata?.tag)
      );

    default:
      return [];
  }
}

export function searchMedia(media: MediaItem[], query: string): MediaItem[] {
  const lowerQuery = query.toLowerCase();
  
  return media.filter(item => {
    // Search in caption
    if (item.aiCaption?.toLowerCase().includes(lowerQuery)) return true;
    
    // Search in tags
    if (item.aiTags?.some(tag => tag.toLowerCase().includes(lowerQuery))) return true;
    
    // Search in location
    if (item.location?.toLowerCase().includes(lowerQuery)) return true;
    
    return false;
  });
}
