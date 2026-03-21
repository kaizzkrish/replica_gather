export interface StylePreset {
    id: string;
    name: string;
    gender: 'male' | 'female';
    skinColor: string;
    hairColor: string;
    outfitColor: string;
    previewEmoji: string;
    textureKey?: string;
}

export const MALE_STYLES: StylePreset[] = [
    { id: 'm1', name: 'Original', gender: 'male', skinColor: '#ffffff', hairColor: '#ffffff', outfitColor: '#ffffff', previewEmoji: '👦', textureKey: 'charBase' },
    { id: 'm2', name: 'Executive Suit', gender: 'male', skinColor: '#ffffff', hairColor: '#ffffff', outfitColor: '#ffffff', previewEmoji: '👔', textureKey: 'char_m_suit' },
    { id: 'm3', name: 'Street Hoodie', gender: 'male', skinColor: '#ffffff', hairColor: '#ffffff', outfitColor: '#ffffff', previewEmoji: '🎧', textureKey: 'char_m_casual' },
    { id: 'm4', name: 'Summer Hit', gender: 'male', skinColor: '#c68642', hairColor: '#f1c40f', outfitColor: '#1abc9c', previewEmoji: '☀️', textureKey: 'charBase' },
    { id: 'm5', name: 'Noir Detective', gender: 'male', skinColor: '#ffffff', hairColor: '#ffffff', outfitColor: '#ffffff', previewEmoji: '🕵️', textureKey: 'char_m_suit' },
    { id: 'm6', name: 'Red Suit', gender: 'male', skinColor: '#ffffff', hairColor: '#ffffff', outfitColor: '#ff0000', previewEmoji: '🤵', textureKey: 'char_m_suit' },
    { id: 'm7', name: 'Sporty Blue', gender: 'male', skinColor: '#ffffff', hairColor: '#4b2c20', outfitColor: '#3498db', previewEmoji: '⚽', textureKey: 'char_m_casual' },
    { id: 'm8', name: 'Goth Style', gender: 'male', skinColor: '#fdf3e1', hairColor: '#000000', outfitColor: '#1e272e', previewEmoji: '🎸', textureKey: 'char_m_casual' },
    { id: 'm9', name: 'Nordic Gold', gender: 'male', skinColor: '#ffffff', hairColor: '#d4af37', outfitColor: '#546e7a', previewEmoji: '❄️', textureKey: 'char_m_suit' },
    { id: 'm10', name: 'Cyberpunk', gender: 'male', skinColor: '#e0ac69', hairColor: '#9b59b6', outfitColor: '#e67e22', previewEmoji: '🦾', textureKey: 'char_m_casual' },
];

export const FEMALE_STYLES: StylePreset[] = [
    { id: 'f1', name: 'Original', gender: 'female', skinColor: '#ffffff', hairColor: '#ffffff', outfitColor: '#ffffff', previewEmoji: '👧', textureKey: 'charBase_female' },
    { id: 'f2', name: 'Floral Dress', gender: 'female', skinColor: '#ffffff', hairColor: '#ffffff', outfitColor: '#ffffff', previewEmoji: '👗', textureKey: 'char_f_dress' },
    { id: 'f3', name: 'Smart Blazer', gender: 'female', skinColor: '#ffffff', hairColor: '#ffffff', outfitColor: '#ffffff', previewEmoji: '💼', textureKey: 'char_f_casual' },
    { id: 'f4', name: 'Evening Violet', gender: 'female', skinColor: '#ffffff', hairColor: '#ffffff', outfitColor: '#9b59b6', previewEmoji: '✨', textureKey: 'char_f_dress' },
    { id: 'f5', name: 'Streetwear', gender: 'female', skinColor: '#8d5524', hairColor: '#1e272e', outfitColor: '#e17055', previewEmoji: '🏙️', textureKey: 'char_f_casual' },
    { id: 'f6', name: 'Golden Royal', gender: 'female', skinColor: '#f3e5ab', hairColor: '#d4af37', outfitColor: '#d63031', previewEmoji: '🛡️', textureKey: 'char_f_dress' },
    { id: 'f7', name: 'Active Green', gender: 'female', skinColor: '#ffffff', hairColor: '#795548', outfitColor: '#00b894', previewEmoji: '🏃', textureKey: 'char_f_casual' },
    { id: 'f8', name: 'Snow White', gender: 'female', skinColor: '#ffdbac', hairColor: '#f1c40f', outfitColor: '#ffffff', previewEmoji: '🌼', textureKey: 'char_f_dress' },
    { id: 'f9', name: 'Midnight', gender: 'female', skinColor: '#8d5524', hairColor: '#000000', outfitColor: '#2d3436', previewEmoji: '🌑', textureKey: 'char_f_casual' },
    { id: 'f10', name: 'Stardust', gender: 'female', skinColor: '#fdf3e1', hairColor: '#6c5ce7', outfitColor: '#a29bfe', previewEmoji: '🌌', textureKey: 'char_f_casual' },
];
