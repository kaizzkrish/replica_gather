export interface StylePreset {
    id: string;
    name: string;
    gender: 'male' | 'female';
    skinColor: string;
    hairColor: string;
    outfitColor: string;
    previewEmoji: string;
}

export const MALE_STYLES: StylePreset[] = [
    { id: 'm1', name: 'Executive', gender: 'male', skinColor: '#ffdbac', hairColor: '#2b1a12', outfitColor: '#2c3e50', previewEmoji: '👔' },
    { id: 'm2', name: 'Casual Blue', gender: 'male', skinColor: '#f1c27d', hairColor: '#4b2c20', outfitColor: '#3498db', previewEmoji: '👕' },
    { id: 'm3', name: 'Cyberpunk', gender: 'male', skinColor: '#e0ac69', hairColor: '#9b59b6', outfitColor: '#e67e22', previewEmoji: '🦾' },
    { id: 'm4', name: 'Streetwear', gender: 'male', skinColor: '#8d5524', hairColor: '#000000', outfitColor: '#2d3436', previewEmoji: '👟' },
    { id: 'm5', name: 'Summer Hit', gender: 'male', skinColor: '#c68642', hairColor: '#f1c40f', outfitColor: '#1abc9c', previewEmoji: '☀️' },
    { id: 'm6', name: 'Goth Rock', gender: 'male', skinColor: '#fdf3e1', hairColor: '#000000', outfitColor: '#1e272e', previewEmoji: '🎸' },
    { id: 'm7', name: 'Preppy', gender: 'male', skinColor: '#f3e5ab', hairColor: '#795548', outfitColor: '#ef5350', previewEmoji: '🎓' },
    { id: 'm8', name: 'Noir Detective', gender: 'male', skinColor: '#ffdbac', hairColor: '#424242', outfitColor: '#212121', previewEmoji: '🕵️' },
    { id: 'm9', name: 'Nordic', gender: 'male', skinColor: '#ffffff', hairColor: '#e0e0e0', outfitColor: '#546e7a', previewEmoji: '❄️' },
    { id: 'm10', name: 'Gold King', gender: 'male', skinColor: '#ffdbac', hairColor: '#d4af37', outfitColor: '#f4b400', previewEmoji: '👑' },
];

export const FEMALE_STYLES: StylePreset[] = [
    { id: 'f1', name: 'Elegant', gender: 'female', skinColor: '#ffdbac', hairColor: '#4b2c20', outfitColor: '#9b59b6', previewEmoji: '👗' },
    { id: 'f2', name: 'Business', gender: 'female', skinColor: '#f1c27d', hairColor: '#2d3436', outfitColor: '#34495e', previewEmoji: '💼' },
    { id: 'f3', name: 'Neon Vibes', gender: 'female', skinColor: '#e0ac69', hairColor: '#fd79a8', outfitColor: '#00cec9', previewEmoji: '✨' },
    { id: 'f4', name: 'Urban Chic', gender: 'female', skinColor: '#8d5524', hairColor: '#1e272e', outfitColor: '#e17055', previewEmoji: '🏙️' },
    { id: 'f5', name: 'Daisy', gender: 'female', skinColor: '#ffdbac', hairColor: '#f1c40f', outfitColor: '#ffffff', previewEmoji: '🌼' },
    { id: 'f6', name: 'Royal', gender: 'female', skinColor: '#f3e5ab', hairColor: '#4b2c20', outfitColor: '#d63031', previewEmoji: '🛡️' },
    { id: 'f7', name: 'Active', gender: 'female', skinColor: '#c68642', hairColor: '#795548', outfitColor: '#00b894', previewEmoji: '🏃' },
    { id: 'f8', name: 'Stardust', gender: 'female', skinColor: '#fdf3e1', hairColor: '#6c5ce7', outfitColor: '#a29bfe', previewEmoji: '🌌' },
    { id: 'f9', name: 'Eco Style', gender: 'female', skinColor: '#ffdbac', hairColor: '#27ae60', outfitColor: '#81ecec', previewEmoji: '🌱' },
    { id: 'f10', name: 'Shadow', gender: 'female', skinColor: '#8d5524', hairColor: '#000000', outfitColor: '#2d3436', previewEmoji: '🌑' },
];
